/**
 * POST /api/cards/create - Create card instances (called from openPack)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { CardInstance, createCardInstance, parseCardType } from '../../../lib/cardInstance';
import { getTokenById } from '../../../lib/tokens';

const CARDS_KEY_PREFIX = 'cards:';

export interface CreateCardsRequest {
    wallet: string;
    tokenIds: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, tokenIds } = req.body as CreateCardsRequest;

        if (!wallet || !tokenIds || !Array.isArray(tokenIds)) {
            return res.status(400).json({ ok: false, error: 'Wallet and tokenIds array required' });
        }

        const cleanWallet = wallet.toLowerCase();
        const cardsKey = `${CARDS_KEY_PREFIX}${cleanWallet}`;

        // Get existing cards
        const existingCards = await kv.get<CardInstance[]>(cardsKey) || [];

        // Create new card instances
        const newCards: CardInstance[] = [];
        for (const tokenId of tokenIds) {
            const token = getTokenById(tokenId);
            if (token) {
                const cardType = parseCardType(token.about || '');
                const cardInstance = createCardInstance(tokenId, cardType, cleanWallet);
                newCards.push(cardInstance);
            }
        }

        // Append to existing cards
        const allCards = [...existingCards, ...newCards];

        // Save to KV
        await kv.set(cardsKey, allCards);

        return res.status(200).json({
            ok: true,
            created: newCards.length,
            cards: newCards,
            totalCards: allCards.length,
        });
    } catch (error: any) {
        console.error('Create cards error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * Helper function to create cards - can be called directly from other API routes
 */
export async function createCardsForUser(wallet: string, tokenIds: string[]): Promise<CardInstance[]> {
    const cleanWallet = wallet.toLowerCase();
    const cardsKey = `${CARDS_KEY_PREFIX}${cleanWallet}`;

    // Get existing cards
    const existingCards = await kv.get<CardInstance[]>(cardsKey) || [];

    // Create new card instances
    const newCards: CardInstance[] = [];
    for (const tokenId of tokenIds) {
        const token = getTokenById(tokenId);
        if (token) {
            const cardType = parseCardType(token.about || '');
            const cardInstance = createCardInstance(tokenId, cardType, cleanWallet);
            newCards.push(cardInstance);
        }
    }

    // Append to existing cards
    const allCards = [...existingCards, ...newCards];

    // Save to KV
    await kv.set(cardsKey, allCards);

    return newCards;
}
