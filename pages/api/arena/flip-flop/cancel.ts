/**
 * POST /api/arena/flip-flop/cancel - Remove room from KV (Frontend helper)
 * Note: Real refund must happen on-chain. This just cleans the UI list.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { cancelTasoGame } from '../../../../lib/tasoGame';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { wallet, gameId } = req.body;

    if (!wallet || !gameId) {
        return res.status(400).json({ ok: false, error: 'Missing wallet or gameId' });
    }

    try {
        const success = await cancelTasoGame(gameId, wallet);

        if (success) {
            return res.status(200).json({ ok: true });
        } else {
            return res.status(404).json({ ok: false, error: 'Room not found or not owner' });
        }
    } catch (error: any) {
        console.error('Cancel taso error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
