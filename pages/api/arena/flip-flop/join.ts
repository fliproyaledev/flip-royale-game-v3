/**
 * POST /api/arena/flip-flop/join - Join Flip Flop game
 * Joining player makes their choice and game auto-resolves
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { joinTasoGame, getTasoGame, TasoCard, TasoChoice } from '../../../../lib/tasoGame';
import { CardInstance, isCardActive } from '../../../../lib/cardInstance';
import { getTokenById } from '../../../../lib/tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, gameId, choice } = req.body;

        if (!wallet || !gameId) {
            return res.status(400).json({ ok: false, error: 'Wallet and gameId required' });
        }

        // Validate choice
        if (!choice || (choice !== 'front' && choice !== 'back')) {
            return res.status(400).json({ ok: false, error: 'Choice must be front or back' });
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

        // Join game with choice - game auto-resolves
        const game = await joinTasoGame(gameId, cleanWallet, tasoCard, choice as TasoChoice);
        if (!game) {
            return res.status(400).json({ ok: false, error: 'Failed to join game' });
        }

        return res.status(200).json({
            ok: true,
            game, // Game is already resolved, can show results
            yourChoice: choice,
        });
    } catch (error: any) {
        console.error('Join taso error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

