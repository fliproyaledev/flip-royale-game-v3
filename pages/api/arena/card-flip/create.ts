/**
 * POST /api/arena/card-flip/create - Create new Card Flip room
 * Room creator makes their choice (front/back)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { createTasoGame, TASO_TIERS, TasoTier, TasoCard, TasoChoice } from '../../../../lib/tasoGame';
import { CardInstance, isCardActive } from '../../../../lib/cardInstance';
import { getTokenById } from '../../../../lib/tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, tier, choice } = req.body;

        if (!wallet) {
            return res.status(400).json({ ok: false, error: 'Wallet address required' });
        }

        if (!tier || !TASO_TIERS[tier as TasoTier]) {
            return res.status(400).json({ ok: false, error: 'Invalid tier' });
        }

        // Validate choice
        if (!choice || (choice !== 'front' && choice !== 'back')) {
            return res.status(400).json({ ok: false, error: 'Choice must be front or back' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Get cards from KV storage (new format with proper IDs)
        const cardsKey = `cards:${cleanWallet}`;
        const userCards = await kv.get<CardInstance[]>(cardsKey) || [];

        // Filter to only active cards
        const activeCards = userCards.filter(isCardActive);

        if (activeCards.length < 1) {
            return res.status(400).json({ ok: false, error: 'No active cards available' });
        }

        // Random select one card
        const randomIndex = Math.floor(Math.random() * activeCards.length);
        const selectedCard = activeCards[randomIndex];
        const token = getTokenById(selectedCard.tokenId);

        const tasoCard: TasoCard = {
            cardId: selectedCard.id, // Use ACTUAL card ID from KV for proper wrecking
            tokenId: selectedCard.tokenId,
            symbol: token?.symbol || selectedCard.tokenId,
            name: token?.name || selectedCard.tokenId,
            logo: token?.logo || '',
            cardType: selectedCard.cardType || 'pegasus',
        };

        // Create game with choice
        const game = await createTasoGame(cleanWallet, tier as TasoTier, tasoCard, choice as TasoChoice);

        // Don't expose player1's choice in response
        const safeGame = {
            ...game,
            player1: {
                ...game.player1,
                choice: undefined, // Hide choice
            }
        };

        return res.status(200).json({
            ok: true,
            game: safeGame,
            yourChoice: choice, // Only tell creator their own choice
        });
    } catch (error: any) {
        console.error('Create taso error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

