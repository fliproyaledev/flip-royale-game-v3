/**
 * POST /api/arena/taso/create - Yeni Taso odası oluştur
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createTasoGame, TASO_TIERS, TasoTier, TasoCard, selectRandomCard } from '../../../../lib/tasoGame';
import { getUser } from '../../../../lib/users';
import { getTokenById } from '../../../../lib/tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, tier } = req.body;

        if (!wallet) {
            return res.status(400).json({ ok: false, error: 'Wallet address required' });
        }

        if (!tier || !TASO_TIERS[tier as TasoTier]) {
            return res.status(400).json({ ok: false, error: 'Invalid tier' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Get user and check inventory
        const user = await getUser(cleanWallet);
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        // Get cards from inventory (legacy format)
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

        // Create game
        const game = await createTasoGame(cleanWallet, tier as TasoTier, tasoCard);

        return res.status(200).json({
            ok: true,
            game,
        });
    } catch (error: any) {
        console.error('Create taso error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
