/**
 * GET /api/arena/taso/list - Açık Taso odalarını listele
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listOpenTasoGames, TASO_TIERS, TasoTier } from '../../../../lib/tasoGame';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const tier = req.query.tier as TasoTier | undefined;

        if (tier && !TASO_TIERS[tier]) {
            return res.status(400).json({ ok: false, error: 'Invalid tier' });
        }

        const games = await listOpenTasoGames(tier);

        return res.status(200).json({
            ok: true,
            games,
            tiers: TASO_TIERS,
        });
    } catch (error: any) {
        console.error('List taso games error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
