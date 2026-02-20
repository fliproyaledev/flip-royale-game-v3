/**
 * ReplyCorp Fee Router Contract Integration
 * 
 * Akış:
 * 1. Satın alma olduğunda ReplyCorp API'den feeDistribution bilgisi alınır
 * 2. Hemen bir kere startDistribution denenır
 * 3. Başarısızsa pending queue'ya kaydedilir (KV)
 * 4. Cron job (/api/cron/process-distributions) pending'leri tekrar dener
 * 
 * NOT: Attribution verisi ReplyCorp'un attribution updater'ı tarafından
 * on-chain'e yazılır. Bu işlem zaman alabilir, bu yüzden ilk denemede
 * başarısız olursa pending queue kullanılır.
 */

import { ethers } from 'ethers';
import { kv } from '@vercel/kv';

// Fee Router kontrat adresi
export const FEE_ROUTER_ADDRESS = process.env.FEE_ROUTER_CONTRACT || '';

// VIRTUAL token adresi (Base chain)
export const VIRTUAL_TOKEN_ADDRESS = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';

// Base RPC
export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

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
 * Convert conversion ID to bytes32 format expected by ReplyCorp contracts
 * ReplyCorp takes the 128-bit UUID (without hyphens) and applies keccak256
 */
export function toBytes32(conversionId: string): string {
    const cleanId = conversionId.replace(/-/g, '');
    return ethers.keccak256(`0x${cleanId}`);
}

/**
 * Pending distribution interface
 */
interface PendingDistribution {
    conversionId: string;
    totalAmount: number;
    attributionHash: string;
    createdAt: string;
    retryCount: number;
    lastError?: string;
    status: 'pending' | 'completed' | 'failed';
}

async function savePendingDistribution(dist: PendingDistribution): Promise<void> {
    try {
        const key = `feerouter:pending:${dist.conversionId}`;
        await kv.set(key, dist);

        // Add to pending list
        const listKey = 'feerouter:pending_list';
        const list = await kv.get<string[]>(listKey) || [];
        if (!list.includes(dist.conversionId)) {
            list.push(dist.conversionId);
            await kv.set(listKey, list);
        }
        console.log(`[FeeRouter] 💾 Saved pending distribution: ${dist.conversionId}`);
    } catch (e) {
        console.error('[FeeRouter] Failed to save pending:', e);
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
        console.error('[FeeRouter] Failed to remove pending:', e);
    }
}

/**
 * Try to execute the full distribution flow on-chain
 * Returns success/failure without long waits
 */
async function executeDistribution(
    conversionId: string,
    totalAmount: number,
    attributionHash: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const privateKey = process.env.DISTRIBUTION_WALLET_PRIVATE_KEY;
    if (!privateKey) {
        return { success: false, error: 'Private key not configured' };
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const feeRouter = new ethers.Contract(FEE_ROUTER_ADDRESS, FEE_ROUTER_ABI, wallet);
    const token = new ethers.Contract(VIRTUAL_TOKEN_ADDRESS, ERC20_ABI, wallet);

    const amountWei = toWei(totalAmount);
    const conversionIdBytes = toBytes32(conversionId);

    // 1. Check balance
    const balance = await token.balanceOf(wallet.address);
    if (balance < amountWei) {
        return { success: false, error: `Insufficient balance: ${ethers.formatEther(balance)} VIRTUAL` };
    }

    // 2. Ensure approval (max approve once)
    const allowance = await token.allowance(wallet.address, FEE_ROUTER_ADDRESS);
    if (allowance < amountWei) {
        console.log('[FeeRouter] 📝 Approving tokens (max)...');
        const approveTx = await token.approve(FEE_ROUTER_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
        console.log(`[FeeRouter] ✅ Approved: ${approveTx.hash}`);
    }

    // 3. Try startDistribution - this is where it fails if attribution not on-chain
    console.log('[FeeRouter] 📤 Calling startDistribution...');
    const startTx = await feeRouter.startDistribution(
        conversionIdBytes,
        amountWei,
        attributionHash
    );
    await startTx.wait();
    console.log(`[FeeRouter] ✅ Distribution started: ${startTx.hash}`);

    // 4. Process Batches
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

    // 5. Finalize
    console.log('[FeeRouter] 🏁 Finalizing distribution...');
    const finalizeTx = await feeRouter.finalizeDistribution(conversionIdBytes);
    await finalizeTx.wait();
    console.log(`[FeeRouter] ✅ Distribution finalized: ${finalizeTx.hash}`);

    return { success: true, txHash: finalizeTx.hash };
}

/**
 * Main entry point: Try distribution, save to pending if fails
 * Called from verify-purchase.ts - MUST be fast, no long waits
 */
export async function distributeViaFeeRouter(
    conversionId: string,
    totalAmount: number,
    attributionHash: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        if (!FEE_ROUTER_ADDRESS) {
            console.log('[FeeRouter] ⏳ Contract not deployed yet, skipping');
            return { success: false, error: 'Contract not deployed' };
        }

        console.log(`[FeeRouter] 🚀 Attempting distribution for ${conversionId}`);
        console.log(`[FeeRouter]   Amount: ${totalAmount} VIRTUAL`);

        // Try once immediately
        const result = await executeDistribution(conversionId, totalAmount, attributionHash);

        if (result.success) {
            console.log(`[FeeRouter] ✅ Distribution completed: ${result.txHash}`);
            await removePendingDistribution(conversionId);
            return result;
        }

        // Failed - likely "attribution data not found"
        // Save to pending queue for cron retry
        console.log(`[FeeRouter] ⏳ Distribution failed, saving to pending queue for retry`);
        await savePendingDistribution({
            conversionId, totalAmount, attributionHash,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            lastError: result.error?.substring(0, 200),
            status: 'pending'
        });

        return { success: false, error: `Queued for retry: ${result.error}` };

    } catch (error: any) {
        const errorMsg = error.reason || error.shortMessage || error.message || 'Unknown error';
        console.error(`[FeeRouter] ❌ Error: ${errorMsg}`);

        // Save to pending queue
        await savePendingDistribution({
            conversionId, totalAmount, attributionHash,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            lastError: errorMsg.substring(0, 200),
            status: 'pending'
        });

        return { success: false, error: `Queued for retry: ${errorMsg}` };
    }
}

/**
 * Process all pending distributions (called by cron)
 */
export async function processPendingDistributions(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    details: string[];
}> {
    const listKey = 'feerouter:pending_list';
    const list = await kv.get<string[]>(listKey) || [];
    const details: string[] = [];

    if (list.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, details: ['No pending distributions'] };
    }

    let processed = 0, succeeded = 0, failed = 0;

    for (const conversionId of list) {
        const pending = await kv.get<PendingDistribution>(`feerouter:pending:${conversionId}`);
        if (!pending || pending.status === 'completed' || pending.status === 'failed') {
            continue;
        }

        // Max 15 retries before giving up
        if (pending.retryCount >= 15) {
            pending.status = 'failed';
            await kv.set(`feerouter:pending:${conversionId}`, pending);
            details.push(`❌ ${conversionId}: gave up after ${pending.retryCount} retries`);
            continue;
        }

        console.log(`[FeeRouter Cron] 🔄 Retrying: ${conversionId} (attempt #${pending.retryCount + 1})`);
        processed++;

        try {
            const result = await executeDistribution(
                pending.conversionId,
                pending.totalAmount,
                pending.attributionHash
            );

            if (result.success) {
                succeeded++;
                await removePendingDistribution(conversionId);
                details.push(`✅ ${conversionId}: completed (tx: ${result.txHash})`);
                console.log(`[FeeRouter Cron] ✅ ${conversionId} completed: ${result.txHash}`);
            } else {
                failed++;
                pending.retryCount += 1;
                pending.lastError = result.error?.substring(0, 200);
                await kv.set(`feerouter:pending:${conversionId}`, pending);
                details.push(`⏳ ${conversionId}: retry ${pending.retryCount} - ${result.error?.substring(0, 80)}`);
                console.log(`[FeeRouter Cron] ⏳ ${conversionId}: will retry later (${pending.retryCount})`);
            }
        } catch (error: any) {
            failed++;
            const errMsg = error.reason || error.shortMessage || error.message || 'Unknown';
            pending.retryCount += 1;
            pending.lastError = errMsg.substring(0, 200);
            await kv.set(`feerouter:pending:${conversionId}`, pending);
            details.push(`⏳ ${conversionId}: retry ${pending.retryCount} - ${errMsg.substring(0, 80)}`);
        }
    }

    return { processed, succeeded, failed, details };
}

/**
 * Get distribution status from on-chain
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

/**
 * Get all pending distributions status (for admin panel)
 */
export async function getPendingDistributions(): Promise<PendingDistribution[]> {
    const listKey = 'feerouter:pending_list';
    const list = await kv.get<string[]>(listKey) || [];
    const results: PendingDistribution[] = [];

    for (const conversionId of list) {
        const pending = await kv.get<PendingDistribution>(`feerouter:pending:${conversionId}`);
        if (pending) results.push(pending);
    }

    return results;
}
