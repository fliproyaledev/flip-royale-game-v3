/**
 * ReplyCorp Fee Router Contract Integration
 * 
 * Akış:
 * 1. ReplyCorp API'den feeDistribution bilgisi alınır
 * 2. Attribution verisi on-chain'e yazılmasını bekle (retry)
 * 3. approve() - Token izni verilir
 * 4. startDistribution() - Dağıtım başlatılır
 * 5. processBatch() - Batch'ler işlenir (>200 alıcı varsa)
 * 6. finalizeDistribution() - Tamamlanır
 */

import { ethers } from 'ethers';
import { kv } from '@vercel/kv';

// Fee Router kontrat adresi
export const FEE_ROUTER_ADDRESS = process.env.FEE_ROUTER_CONTRACT || '';

// VIRTUAL token adresi (Base chain)
export const VIRTUAL_TOKEN_ADDRESS = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';

// Base RPC
export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Retry config
const MAX_RETRIES = 5;
const RETRY_DELAYS = [10000, 20000, 30000, 60000, 120000]; // 10s, 20s, 30s, 1m, 2m

// Fee Router ABI
export const FEE_ROUTER_ABI = [
    // Owner Functions
    'function setAttributionUpdater(address newUpdater) external',
    'function setDistributionSigner(address newSigner) external',
    'function setReplyCorpWallet(address newWallet) external',
    'function withdrawDust(uint256 amount) external',
    'function rescueTokens(uint256 amount) external',

    // Distribution Signer Functions
    'function startDistribution(bytes32 conversionId, uint256 totalAmount, bytes32 expectedHash) external',
    'function processBatch(bytes32 conversionId, uint256 batchIndex) external',
    'function finalizeDistribution(bytes32 conversionId) external',

    // View Functions
    'function getDistributionRoute(bytes32 conversionId) external view returns (tuple(uint256 totalAmount, bytes32 attributionHash, bool started, bool finalized, uint256 version))',
    'function getBatchCount(bytes32 conversionId) external view returns (uint256)',
    'function isBatchCompleted(bytes32 conversionId, uint256 batchIndex) external view returns (bool)',
    'function accumulatedDust() external view returns (uint256)',
    'function owner() external view returns (address)',
    'function attributionUpdater() external view returns (address)',
    'function distributionSigner() external view returns (address)',
    'function replyCorpWallet() external view returns (address)',
    'function token() external view returns (address)',

    // Events
    'event DistributionStarted(bytes32 indexed conversionId, uint256 totalAmount)',
    'event BatchProcessed(bytes32 indexed conversionId, uint256 batchIndex, uint256 successCount)',
    'event DistributionFinalized(bytes32 indexed conversionId)',
    'event DustWithdrawn(address indexed to, uint256 amount)',
] as const;

// ERC20 ABI (approve için)
export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
] as const;

/**
 * Convert VIRTUAL amount to wei (18 decimals)
 */
export function toWei(amount: number): bigint {
    return ethers.parseEther(amount.toString());
}

/**
 * Convert conversion ID to bytes32 format
 */
export function toBytes32(conversionId: string): string {
    // UUID format'ı bytes32'ye çevir
    const cleanId = conversionId.replace(/-/g, '');
    return ethers.zeroPadValue(`0x${cleanId}`, 32);
}

/**
 * Helper: sleep for given milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Pending distribution'ı KV'ye kaydet (retry için)
 */
interface PendingDistribution {
    conversionId: string;
    totalAmount: number;
    attributionHash: string;
    createdAt: string;
    retryCount: number;
    lastError?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

async function savePendingDistribution(dist: PendingDistribution): Promise<void> {
    try {
        const key = `feerouter:pending:${dist.conversionId}`;
        await kv.set(key, dist);

        // Add to pending list for cron processing
        const listKey = 'feerouter:pending_list';
        const list = await kv.get<string[]>(listKey) || [];
        if (!list.includes(dist.conversionId)) {
            list.push(dist.conversionId);
            await kv.set(listKey, list);
        }
        console.log(`[FeeRouter] 💾 Saved pending distribution: ${dist.conversionId}`);
    } catch (e) {
        console.error('[FeeRouter] Failed to save pending distribution:', e);
    }
}

async function removePendingDistribution(conversionId: string): Promise<void> {
    try {
        await kv.del(`feerouter:pending:${conversionId}`);
        const listKey = 'feerouter:pending_list';
        const list = await kv.get<string[]>(listKey) || [];
        const updated = list.filter(id => id !== conversionId);
        await kv.set(listKey, updated);
    } catch (e) {
        console.error('[FeeRouter] Failed to remove pending distribution:', e);
    }
}

/**
 * Check if attribution data is available on-chain
 */
async function checkAttributionOnChain(
    feeRouter: ethers.Contract,
    conversionIdBytes: string
): Promise<boolean> {
    try {
        const route = await feeRouter.getDistributionRoute(conversionIdBytes);
        // If totalAmount > 0 or attributionHash is set, data exists
        return route.totalAmount > BigInt(0) || route.attributionHash !== ethers.ZeroHash;
    } catch {
        return false;
    }
}

/**
 * Fee Router ile token dağıtımı yap (retry mekanizması ile)
 * 
 * @param conversionId - ReplyCorp'tan gelen conversion ID
 * @param totalAmount - Toplam dağıtılacak miktar (VIRTUAL)
 * @param attributionHash - ReplyCorp'tan gelen attribution hash
 * @returns İşlem başarılı mı?
 */
export async function distributeViaFeeRouter(
    conversionId: string,
    totalAmount: number,
    attributionHash: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        // Kontrat adresi kontrolü
        if (!FEE_ROUTER_ADDRESS) {
            console.log('[FeeRouter] ⏳ Contract not deployed yet, skipping distribution');
            return { success: false, error: 'Contract not deployed' };
        }

        const privateKey = process.env.DISTRIBUTION_WALLET_PRIVATE_KEY;
        if (!privateKey) {
            console.error('[FeeRouter] ❌ Distribution wallet private key not configured');
            return { success: false, error: 'Private key not configured' };
        }

        // Provider ve wallet oluştur
        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);

        // Kontratları oluştur
        const feeRouter = new ethers.Contract(FEE_ROUTER_ADDRESS, FEE_ROUTER_ABI, wallet);
        const token = new ethers.Contract(VIRTUAL_TOKEN_ADDRESS, ERC20_ABI, wallet);

        // Miktarı wei'ye çevir
        const amountWei = toWei(totalAmount);
        const conversionIdBytes = toBytes32(conversionId);

        console.log(`[FeeRouter] 🚀 Starting distribution for conversion ${conversionId}`);
        console.log(`[FeeRouter]   Amount: ${totalAmount} VIRTUAL (${amountWei} wei)`);

        // 1. Token bakiyesi kontrol et
        const balance = await token.balanceOf(wallet.address);
        if (balance < amountWei) {
            console.error(`[FeeRouter] ❌ Insufficient balance: ${ethers.formatEther(balance)} VIRTUAL`);
            // Save as pending for later retry
            await savePendingDistribution({
                conversionId, totalAmount, attributionHash,
                createdAt: new Date().toISOString(),
                retryCount: 0,
                lastError: 'Insufficient balance',
                status: 'pending'
            });
            return { success: false, error: 'Insufficient balance - saved for retry' };
        }

        // 2. Approve - büyük miktar için bir kere approve yap (gas tasarrufu)
        const allowance = await token.allowance(wallet.address, FEE_ROUTER_ADDRESS);
        if (allowance < amountWei) {
            console.log('[FeeRouter] 📝 Approving tokens (max amount)...');
            // MAX approve - her seferinde tekrar approve gerek kalmasın
            const maxApproval = ethers.MaxUint256;
            const approveTx = await token.approve(FEE_ROUTER_ADDRESS, maxApproval);
            await approveTx.wait();
            console.log(`[FeeRouter] ✅ Approved (max): ${approveTx.hash}`);
        }

        // 3. Wait for attribution data on-chain (retry with backoff)
        let attributionReady = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            attributionReady = await checkAttributionOnChain(feeRouter, conversionIdBytes);

            if (attributionReady) {
                console.log(`[FeeRouter] ✅ Attribution data found on-chain (attempt ${attempt + 1})`);
                break;
            }

            const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
            console.log(`[FeeRouter] ⏳ Attribution not on-chain yet, waiting ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
            await sleep(delay);
        }

        // Attribution hala yazılmadıysa → pending queue'ya ekle
        if (!attributionReady) {
            console.log(`[FeeRouter] ⏳ Attribution still not on-chain after ${MAX_RETRIES} retries. Saving to pending queue.`);
            await savePendingDistribution({
                conversionId, totalAmount, attributionHash,
                createdAt: new Date().toISOString(),
                retryCount: MAX_RETRIES,
                lastError: 'Attribution data not found after retries',
                status: 'pending'
            });
            return { success: false, error: 'Attribution not yet on-chain - saved for retry' };
        }

        // 4. Start Distribution
        console.log('[FeeRouter] 📤 Starting distribution...');
        const startTx = await feeRouter.startDistribution(
            conversionIdBytes,
            amountWei,
            attributionHash
        );
        await startTx.wait();
        console.log(`[FeeRouter] ✅ Distribution started: ${startTx.hash}`);

        // 5. Process Batches (varsa)
        const batchCount = await feeRouter.getBatchCount(conversionIdBytes);
        console.log(`[FeeRouter] 📦 Processing ${batchCount} batch(es)...`);

        for (let i = 0; i < Number(batchCount); i++) {
            const completed = await feeRouter.isBatchCompleted(conversionIdBytes, i);
            if (!completed) {
                const batchTx = await feeRouter.processBatch(conversionIdBytes, i);
                await batchTx.wait();
                console.log(`[FeeRouter] ✅ Batch ${i + 1}/${batchCount} processed`);
            }
        }

        // 6. Finalize Distribution
        console.log('[FeeRouter] 🏁 Finalizing distribution...');
        const finalizeTx = await feeRouter.finalizeDistribution(conversionIdBytes);
        await finalizeTx.wait();
        console.log(`[FeeRouter] ✅ Distribution finalized: ${finalizeTx.hash}`);

        // Clean up pending if it was there
        await removePendingDistribution(conversionId);

        return { success: true, txHash: finalizeTx.hash };

    } catch (error: any) {
        console.error('[FeeRouter] ❌ Distribution error:', error);

        // Save to pending queue on any error
        await savePendingDistribution({
            conversionId, totalAmount, attributionHash,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            lastError: error.message?.substring(0, 200) || 'Unknown error',
            status: 'pending'
        });

        return { success: false, error: error.message };
    }
}

/**
 * Process pending distributions (cron job'dan çağrılır)
 */
export async function processPendingDistributions(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
}> {
    const listKey = 'feerouter:pending_list';
    const list = await kv.get<string[]>(listKey) || [];

    let processed = 0, succeeded = 0, failed = 0;

    for (const conversionId of list) {
        const pending = await kv.get<PendingDistribution>(`feerouter:pending:${conversionId}`);
        if (!pending || pending.status === 'completed') continue;

        console.log(`[FeeRouter Cron] Processing pending: ${conversionId} (retry #${pending.retryCount + 1})`);

        const result = await distributeViaFeeRouter(
            pending.conversionId,
            pending.totalAmount,
            pending.attributionHash
        );
        processed++;

        if (result.success) {
            succeeded++;
            await removePendingDistribution(conversionId);
            console.log(`[FeeRouter Cron] ✅ ${conversionId} completed: ${result.txHash}`);
        } else {
            failed++;
            // Update retry count
            pending.retryCount += 1;
            pending.lastError = result.error;
            if (pending.retryCount > 10) {
                pending.status = 'failed'; // Give up after 10 total retries
            }
            await kv.set(`feerouter:pending:${conversionId}`, pending);
            console.log(`[FeeRouter Cron] ❌ ${conversionId} failed (retry ${pending.retryCount}): ${result.error}`);
        }
    }

    return { processed, succeeded, failed };
}

/**
 * Distribution durumunu kontrol et
 */
export async function getDistributionStatus(conversionId: string): Promise<{
    exists: boolean;
    started: boolean;
    finalized: boolean;
    totalAmount?: string;
}> {
    try {
        if (!FEE_ROUTER_ADDRESS) {
            return { exists: false, started: false, finalized: false };
        }

        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
        const feeRouter = new ethers.Contract(FEE_ROUTER_ADDRESS, FEE_ROUTER_ABI, provider);

        const route = await feeRouter.getDistributionRoute(toBytes32(conversionId));

        return {
            exists: route.totalAmount > BigInt(0),
            started: route.started,
            finalized: route.finalized,
            totalAmount: ethers.formatEther(route.totalAmount)
        };
    } catch (error) {
        console.error('[FeeRouter] Status check error:', error);
        return { exists: false, started: false, finalized: false };
    }
}
