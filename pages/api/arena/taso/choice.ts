/**
 * POST /api/arena/taso/choice - Taso seçim gönder
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { submitChoice, getTasoGame, TasoChoice } from '../../../../lib/tasoGame';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, gameId, choice } = req.body;

        if (!wallet || !gameId || !choice) {
            return res.status(400).json({ ok: false, error: 'Wallet, gameId, and choice required' });
        }

        if (choice !== 'front' && choice !== 'back') {
            return res.status(400).json({ ok: false, error: 'Choice must be "front" or "back"' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Submit choice (may auto-resolve if both players chose)
        const game = await submitChoice(gameId, cleanWallet, choice as TasoChoice);

        if (!game) {
            return res.status(400).json({ ok: false, error: 'Failed to submit choice' });
        }

        return res.status(200).json({
            ok: true,
            game,
            resolved: game.status === 'resolved',
        });
    } catch (error: any) {
        console.error('Submit choice error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
