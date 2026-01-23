/**
 * GET /api/arena/duel/list - Açık Flip Duel odalarını listele
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listOpenDuels, DUEL_TIERS, DuelTier } from '../../../../lib/duelV2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const tier = req.query.tier as DuelTier | undefined;

        // Validate tier if provided
        if (tier && !DUEL_TIERS[tier]) {
            return res.status(400).json({ ok: false, error: 'Invalid tier' });
        }

        const duels = await listOpenDuels(tier);

        return res.status(200).json({
            ok: true,
            duels,
            tiers: DUEL_TIERS,
        });
    } catch (error: any) {
        console.error('List duels error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
