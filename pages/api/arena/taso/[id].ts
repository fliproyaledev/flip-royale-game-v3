/**
 * GET /api/arena/taso/[id] - Taso game replay/detay
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getTasoGame } from '../../../../lib/tasoGame';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ ok: false, error: 'Game ID required' });
        }

        const game = await getTasoGame(id);

        if (!game) {
            return res.status(404).json({ ok: false, error: 'Game not found' });
        }

        return res.status(200).json({
            ok: true,
            game,
        });
    } catch (error: any) {
        console.error('Get taso game error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
