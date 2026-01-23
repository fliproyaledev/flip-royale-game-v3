/**
 * POST /api/arena/taso/join - Taso oyununa katıl
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { joinTasoGame, getTasoGame, TasoCard } from '../../../../lib/tasoGame';
import { getUser } from '../../../../lib/users';
import { getTokenById } from '../../../../lib/tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, gameId } = req.body;

        if (!wallet || !gameId) {
            return res.status(400).json({ ok: false, error: 'Wallet and gameId required' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Verify game exists
        const existingGame = await getTasoGame(gameId);
        if (!existingGame) {
            return res.status(404).json({ ok: false, error: 'Game not found' });
        }
        if (existingGame.status !== 'open') {
            return res.status(400).json({ ok: false, error: 'Game is not open' });
        }

        // Get user and select card
        const user = await getUser(cleanWallet);
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const inventory = user.inventory || {};
        const cardTokenIds = Object.keys(inventory).filter(k => !k.includes('_pack') && inventory[k] > 0);

        if (cardTokenIds.length < 1) {
            return res.status(400).json({ ok: false, error: 'No cards available' });
        }

        // Random select one card
        const randomIndex = Math.floor(Math.random() * cardTokenIds.length);
        const selectedTokenId = cardTokenIds[randomIndex];
        const token = getTokenById(selectedTokenId);

        if (!token) {
            return res.status(400).json({ ok: false, error: 'Card not found' });
        }

        const tasoCard: TasoCard = {
            cardId: `${selectedTokenId}_${Date.now()}`,
            tokenId: selectedTokenId,
            symbol: token.symbol,
            name: token.name,
            logo: token.logo,
            cardType: token.about || 'common',
        };

        // Join game
        const game = await joinTasoGame(gameId, cleanWallet, tasoCard);
        if (!game) {
            return res.status(400).json({ ok: false, error: 'Failed to join game' });
        }

        return res.status(200).json({
            ok: true,
            game,
        });
    } catch (error: any) {
        console.error('Join taso error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
