/**
 * ReplyCorp Fee Router - Backend Direct Distribution
 *
 * ✅ ÇÖZÜM: startDistribution yerine doğrudan token.transfer kullanıyoruz.
 *
 * NEDEN? ReplyCorp API'ye satışı bildirdiğimiz anda bizim cüzdanları
 * (attribution listesi) bize döndürüyor. Ancak bu veriyi blockchain'e
 * (FeeRouter kontratına) yazmak için birkaç saniye/dakika geçiyor.
 * Bu yüzden hemen startDistribution çağırınca "attribution data not found"
 * hatası alıyorduk.
 *
 * YENİ AKIŞ:
 * 1. ReplyCorp API bize attribution (kim ne kadar alacak) + hash döndürür
 * 2. Biz bu veriyi kullanarak treasury cüzdanından doğrudan token.transfer yaparız
 * 3. FeeRouter kontratına hiç dokunmayız (onu sadece rapor olarak okurken kullanabiliriz)
 * 4. Ödenen conversionId'leri KV'ye kaydedip çift ödemeyi engelleriz
 */

import { ethers } from 'ethers';
import { kv } from '@vercel/kv';

// VIRTUAL token adresi (Base chain)
export const VIRTUAL_TOKEN_ADDRESS = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';

// Base RPC
export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// ERC20 ABI (transfer + balanceOf)
export const ERC20_ABI = [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
] as const;

// Fee Router ABI (eski kontrat - sadece okuma için tutuyoruz)
export const FEE_ROUTER_ADDRESS = process.env.FEE_ROUTER_CONTRACT || '';
export const FEE_ROUTER_ABI = [
    'function startDistribution(bytes32 conversionId, uint256 totalAmount, bytes32 expectedHash) external',
    'function processBatch(bytes32 conversionId, uint256 batchIndex) external',
    'function finalizeDistribution(bytes32 conversionId) external',
    'function getDistributionRoute(bytes32 conversionId) external view returns (tuple(uint256 totalAmount, bytes32 attributionHash, bool started, bool finalized, uint256 version))',
    'function getBatchCount(bytes32 conversionId) external view returns (uint256)',
    'function isBatchCompleted(bytes32 conversionId, uint256 batchIndex) external view returns (bool)',
    'function accumulatedDust() external view returns (uint256)',
    'function owner() external view returns (address)',
    'function attributionUpdater() external view returns (address)',
    'function distributionSigner() external view returns (address)',
] as const;

/**
 * Convert conversion ID to bytes32
 */
export function toBytes32(conversionId: string): string {
    const cleanId = conversionId.replace(/-/g, '');
    return ethers.keccak256(`0x${cleanId}`);
}

/**
 * Attribution entry from ReplyCorp API response
 */
export interface AttributionEntry {
    twitterId: string;
    twitterHandle?: string;
    walletAddress: string | null;
    attributedAmount: number;
    attributionPercentage: number;
    degree?: number;
}

/**
 * Pending distribution stored in KV
 */
export interface PendingDistribution {
    conversionId: string;
    totalAmount: string;    // WEI as string
    attributionHash: string;
    attributions: AttributionEntry[];   // Attribution list from API response
    replyCorpWallet?: string;           // ReplyCorp fee wallet
    replyCorpFee?: string;              // ReplyCorp fee in WEI
    createdAt: string;
    retryCount: number;
    lastError?: string;
    status: 'pending' | 'completed' | 'failed';
}

async function saveOrUpdatePending(dist: PendingDistribution): Promise<void> {
    try {
        const key = `feerouter:pending:${dist.conversionId}`;
        await kv.set(key, dist);
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

async function markPaid(conversionId: string): Promise<void> {
    try {
        await kv.del(`feerouter:pending:${conversionId}`);
        const listKey = 'feerouter:pending_list';
        const list = await kv.get<string[]>(listKey) || [];
        await kv.set(listKey, list.filter(id => id !== conversionId));
        await kv.set(`feerouter:paid:${conversionId}`, true);
    } catch (e) {
        console.error('[FeeRouter] Failed to mark paid:', e);
    }
}

/**
 * ✅ CORE FUNCTION: Direct token transfers to each influencer
 * Uses the attribution list from the ReplyCorp API response.
 * Does NOT interact with startDistribution at all.
 */
async function executeDirectTransfers(
    conversionId: string,
    attributions: AttributionEntry[],
    totalAmountVirtual: number,  // e.g. 3.75 (token units, not wei)
    replyCorpFeeVirtual?: number // e.g. 0.75 (token units, not wei)
): Promise<{ success: boolean; txHashes: string[]; error?: string }> {
    const privateKey = process.env.DISTRIBUTION_WALLET_PRIVATE_KEY;
    if (!privateKey) {
        return { success: false, txHashes: [], error: 'DISTRIBUTION_WALLET_PRIVATE_KEY not configured' };
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const token = new ethers.Contract(VIRTUAL_TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Check treasury balance
    const totalWei = ethers.parseEther(totalAmountVirtual.toString());
    const balance = await token.balanceOf(wallet.address);
    if (balance < totalWei) {
        return {
            success: false,
            txHashes: [],
            error: `Insufficient treasury balance: ${ethers.formatEther(balance)} VIRTUAL (need ${totalAmountVirtual})`
        };
    }

    const txHashes: string[] = [];
    const errors: string[] = [];

    // 1. Pay each influencer
    const validAttributions = attributions.filter(a => a.walletAddress && a.attributedAmount > 0);
    for (const attr of validAttributions) {
        try {
            const amountWei = ethers.parseEther(attr.attributedAmount.toString());
            console.log(`[FeeRouter] 💸 Sending ${attr.attributedAmount} VIRTUAL → ${attr.walletAddress} (${attr.twitterHandle || attr.twitterId})`);
            const tx = await token.transfer(attr.walletAddress!, amountWei);
            const receipt = await tx.wait();
            txHashes.push(receipt?.hash || tx.hash);
            console.log(`[FeeRouter] ✅ Sent to ${attr.walletAddress}: ${receipt?.hash || tx.hash}`);
        } catch (err: any) {
            const msg = err.reason || err.shortMessage || err.message || 'Unknown';
            errors.push(`${attr.walletAddress}: ${msg}`);
            console.error(`[FeeRouter] ❌ Failed to send to ${attr.walletAddress}:`, msg);
        }
    }

    // 2. Pay ReplyCorp fee if specified
    if (replyCorpFeeVirtual && replyCorpFeeVirtual > 0) {
        const REPLYCORP_FEE_WALLET = process.env.REPLYCORP_FEE_WALLET;
        if (REPLYCORP_FEE_WALLET) {
            try {
                const feeWei = ethers.parseEther(replyCorpFeeVirtual.toString());
                console.log(`[FeeRouter] 💸 Sending ${replyCorpFeeVirtual} VIRTUAL → ReplyCorp fee wallet`);
                const tx = await token.transfer(REPLYCORP_FEE_WALLET, feeWei);
                const receipt = await tx.wait();
                txHashes.push(receipt?.hash || tx.hash);
                console.log(`[FeeRouter] ✅ ReplyCorp fee sent: ${receipt?.hash || tx.hash}`);
            } catch (err: any) {
                errors.push(`ReplyCorp fee: ${err.reason || err.message}`);
            }
        } else {
            console.warn('[FeeRouter] ⚠️ REPLYCORP_FEE_WALLET not set, skipping ReplyCorp fee');
        }
    }

    if (errors.length > 0 && txHashes.length === 0) {
        return { success: false, txHashes, error: errors.join('; ') };
    }

    return { success: true, txHashes };
}

/**
 * Main entry point: Distribute fees directly using API attribution data.
 * Called immediately after ReplyCorp API responds - no waiting for on-chain write.
 */
export async function distributeViaFeeRouter(
    conversionId: string,
    totalToSendToContract: number,      // e.g. 3.75 VIRTUAL
    attributionHash: string,
    attributions: AttributionEntry[],   // from API response
    replyCorpFee?: number               // e.g. 0.75 VIRTUAL
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // 1. Check if already paid
    const alreadyPaid = await kv.get(`feerouter:paid:${conversionId}`);
    if (alreadyPaid) {
        console.log(`[FeeRouter] ⚠️ ${conversionId} already paid, skipping`);
        return { success: true, txHash: 'already-paid' };
    }

    const privateKey = process.env.DISTRIBUTION_WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.warn('[FeeRouter] ⚠️ DISTRIBUTION_WALLET_PRIVATE_KEY not set. Saving to pending queue.');
        await saveOrUpdatePending({
            conversionId,
            totalAmount: ethers.parseEther(totalToSendToContract.toString()).toString(),
            attributionHash,
            attributions,
            replyCorpFee: replyCorpFee ? ethers.parseEther(replyCorpFee.toString()).toString() : undefined,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            status: 'pending'
        });
        return { success: false, error: 'No private key - queued for later' };
    }

    console.log(`[FeeRouter] 🚀 Direct distributing ${conversionId}: ${totalToSendToContract} VIRTUAL to ${attributions.length} referrers`);

    try {
        const result = await executeDirectTransfers(
            conversionId,
            attributions,
            totalToSendToContract,
            replyCorpFee
        );

        if (result.success) {
            await markPaid(conversionId);
            console.log(`[FeeRouter] ✅ ${conversionId} fully paid (${result.txHashes.length} txs)`);
            return { success: true, txHash: result.txHashes.join(',') };
        } else {
            // Save to retry queue with attribution data
            await saveOrUpdatePending({
                conversionId,
                totalAmount: ethers.parseEther(totalToSendToContract.toString()).toString(),
                attributionHash,
                attributions,
                replyCorpFee: replyCorpFee ? ethers.parseEther(replyCorpFee.toString()).toString() : undefined,
                createdAt: new Date().toISOString(),
                retryCount: 0,
                lastError: result.error,
                status: 'pending'
            });
            return { success: false, error: `Queued for retry: ${result.error}` };
        }
    } catch (error: any) {
        const errorMsg = error.reason || error.shortMessage || error.message || 'Unknown error';
        console.error(`[FeeRouter] ❌ Exception: ${errorMsg}`);
        await saveOrUpdatePending({
            conversionId,
            totalAmount: ethers.parseEther(totalToSendToContract.toString()).toString(),
            attributionHash,
            attributions,
            replyCorpFee: replyCorpFee ? ethers.parseEther(replyCorpFee.toString()).toString() : undefined,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            lastError: errorMsg.substring(0, 200),
            status: 'pending'
        });
        return { success: false, error: `Queued for retry: ${errorMsg}` };
    }
}

/**
 * Process all pending distributions (called by cron every 5 minutes)
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
        if (!pending || pending.status === 'completed' || pending.status === 'failed') continue;

        if (pending.retryCount >= 15) {
            pending.status = 'failed';
            await kv.set(`feerouter:pending:${conversionId}`, pending);
            details.push(`❌ ${conversionId}: gave up after ${pending.retryCount} retries`);
            continue;
        }

        console.log(`[FeeRouter Cron] 🔄 Retrying: ${conversionId} (attempt #${pending.retryCount + 1})`);
        processed++;

        try {
            // Smart amount parser: handles 3 legacy formats in the KV store:
            // 1. WEI string: "3750000000000000000" (new format, correct)
            // 2. Decimal string: "3.75" (intermediate format, needs parseEther)
            // 3. Raw 10^4 int: 37500 (oldest format, needs × 10^14)
            const parseStoredAmount = (raw: string | number | undefined): number => {
                if (!raw) return 0;
                const s = raw.toString();
                if (s.includes('.')) {
                    // Format 2: decimal like "3.75" → already native token units
                    return Number(s);
                }
                const n = BigInt(s);
                if (n > BigInt('1000000000000000')) {
                    // Format 1: WEI string > 10^15, convert back to token units
                    return Number(ethers.formatEther(n));
                }
                // Format 3: raw 10^4 int like 37500 → divide by 10^4 to get 3.75
                return Number(n) / 10000;
            };

            const totalVirtual = parseStoredAmount(pending.totalAmount);
            const feeVirtual = pending.replyCorpFee ? parseStoredAmount(pending.replyCorpFee) : undefined;

            const result = await executeDirectTransfers(
                pending.conversionId,
                pending.attributions || [],
                totalVirtual,
                feeVirtual
            );

            if (result.success) {
                succeeded++;
                await markPaid(conversionId);
                details.push(`✅ ${conversionId}: completed (${result.txHashes.length} txs)`);
                console.log(`[FeeRouter Cron] ✅ ${conversionId} done`);
            } else {
                failed++;
                pending.retryCount += 1;
                pending.lastError = result.error?.substring(0, 200);
                await kv.set(`feerouter:pending:${conversionId}`, pending);
                details.push(`⏳ ${conversionId}: retry ${pending.retryCount} - ${result.error?.substring(0, 80)}`);
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
 * Admin: Get all pending distributions
 */
export async function getPendingDistributions(): Promise<PendingDistribution[]> {
    const listKey = 'feerouter:pending_list';
    const list = await kv.get<string[]>(listKey) || [];
    const results: PendingDistribution[] = [];
    for (const id of list) {
        const p = await kv.get<PendingDistribution>(`feerouter:pending:${id}`);
        if (p) results.push(p);
    }
    return results;
}
