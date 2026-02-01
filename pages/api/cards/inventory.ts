/**
 * GET /api/cards/inventory - Get user's card instances with durability
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { CardInstance, calculateDurability, checkAndUpdateExpiry, getDurabilityVisual } from '../../../lib/cardInstance';

const CARDS_KEY_PREFIX = 'cards:';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet } = req.query;

        if (!wallet || typeof wallet !== 'string') {
            return res.status(400).json({ ok: false, error: 'Wallet address required' });
        }

        const cleanWallet = wallet.toLowerCase();
        const cardsKey = `${CARDS_KEY_PREFIX}${cleanWallet}`;

        // Get user's card instances
        const cards = await kv.get<CardInstance[]>(cardsKey) || [];

        // Calculate current durability and check expiry for each card
        const updatedCards = cards.map(card => {
            const updated = checkAndUpdateExpiry(card);
            return {
                ...updated,
                durability: calculateDurability(updated),
                visualState: getDurabilityVisual(updated),
            };
        });

        // Separate by status
        const activeCards = updatedCards.filter(c => c.status === 'active' && c.durability > 0);
        const expiredCards = updatedCards.filter(c => c.status === 'expired' || (c.status === 'active' && c.durability === 0));
        const wreckedCards = updatedCards.filter(c => c.status === 'wrecked');

        return res.status(200).json({
            ok: true,
            cards: updatedCards,
            summary: {
                total: updatedCards.length,
                active: activeCards.length,
                expired: expiredCards.length,
                wrecked: wreckedCards.length,
            }
        });
    } catch (error: any) {
        console.error('Get cards inventory error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
