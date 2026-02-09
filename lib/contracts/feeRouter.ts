/**
 * ReplyCorp Fee Router Contract Integration
 * 
 * Bu dosya Fee Router kontratı ile etkileşim için helper fonksiyonları içerir.
 * Kontrat kodu ReplyCorp'tan alındıktan sonra tamamlanacak.
 * 
 * Akış:
 * 1. ReplyCorp API'den feeDistribution bilgisi alınır
 * 2. approve() - Token izni verilir
 * 3. startDistribution() - Dağıtım başlatılır
 * 4. processBatch() - Batch'ler işlenir (>200 alıcı varsa)
 * 5. finalizeDistribution() - Tamamlanır
 */

import { ethers } from 'ethers';

// Fee Router kontrat adresi - Deploy sonrası eklenecek
export const FEE_ROUTER_ADDRESS = process.env.FEE_ROUTER_CONTRACT || '';

// VIRTUAL token adresi (Base chain)
export const VIRTUAL_TOKEN_ADDRESS = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';

// Base RPC
export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Fee Router ABI - Kontrat gelince güncellenecek
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
 * Fee Router ile token dağıtımı yap
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
            return { success: false, error: 'Insufficient balance' };
        }

        // 2. Approve kontrolü ve gerekirse approve yap
        const allowance = await token.allowance(wallet.address, FEE_ROUTER_ADDRESS);
        if (allowance < amountWei) {
            console.log('[FeeRouter] 📝 Approving tokens...');
            const approveTx = await token.approve(FEE_ROUTER_ADDRESS, amountWei);
            await approveTx.wait();
            console.log(`[FeeRouter] ✅ Approved: ${approveTx.hash}`);
        }

        // 3. Start Distribution
        console.log('[FeeRouter] 📤 Starting distribution...');
        const startTx = await feeRouter.startDistribution(
            conversionIdBytes,
            amountWei,
            attributionHash
        );
        await startTx.wait();
        console.log(`[FeeRouter] ✅ Distribution started: ${startTx.hash}`);

        // 4. Process Batches (varsa)
        const batchCount = await feeRouter.getBatchCount(conversionIdBytes);
        console.log(`[FeeRouter] 📦 Processing ${batchCount} batch(es)...`);

        for (let i = 0; i < batchCount; i++) {
            const completed = await feeRouter.isBatchCompleted(conversionIdBytes, i);
            if (!completed) {
                const batchTx = await feeRouter.processBatch(conversionIdBytes, i);
                await batchTx.wait();
                console.log(`[FeeRouter] ✅ Batch ${i + 1}/${batchCount} processed`);
            }
        }

        // 5. Finalize Distribution
        console.log('[FeeRouter] 🏁 Finalizing distribution...');
        const finalizeTx = await feeRouter.finalizeDistribution(conversionIdBytes);
        await finalizeTx.wait();
        console.log(`[FeeRouter] ✅ Distribution finalized: ${finalizeTx.hash}`);

        return { success: true, txHash: finalizeTx.hash };

    } catch (error: any) {
        console.error('[FeeRouter] ❌ Distribution error:', error);
        return { success: false, error: error.message };
    }
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
