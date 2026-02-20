import type { NextApiRequest, NextApiResponse } from 'next';
import { processPendingDistributions } from '../../../lib/contracts/feeRouter';

/**
 * Cron endpoint: Process pending FeeRouter distributions
 * Bu endpoint, attribution verisi henüz on-chain'e yazılmamış olan
 * distribution'ları tekrar dener.
 * 
 * Vercel Cron ile dakikada 1 çağrılabilir veya manual trigger edilebilir.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Cron secret kontrolü
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[FeeRouter Cron] Starting pending distributions processing...');

        const result = await processPendingDistributions();

        console.log(`[FeeRouter Cron] Done: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);

        return res.status(200).json({
            ok: true,
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('[FeeRouter Cron] Error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
