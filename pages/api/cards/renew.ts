/**
 * POST /api/cards/renew - Renew expired card with $FLIP
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { CardInstance, renewCard, RENEWAL_PRICES, CardType } from '../../../lib/cardInstance';
import { getUser, updateUser } from '../../../lib/users';

const CARDS_KEY_PREFIX = 'cards:';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, cardId } = req.body;

        if (!wallet || !cardId) {
            return res.status(400).json({ ok: false, error: 'Wallet and cardId required' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Get user's $FLIP balance
        const user = await getUser(cleanWallet);
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const flipBalance = user.flip || 0;

        // Get user's cards
        const cardsKey = `${CARDS_KEY_PREFIX}${cleanWallet}`;
        const cards = await kv.get<CardInstance[]>(cardsKey) || [];

        // Find the card to renew
        const cardIndex = cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) {
            return res.status(404).json({ ok: false, error: 'Card not found' });
        }

        const card = cards[cardIndex];

        // Check if card is wrecked (cannot renew)
        if (card.status === 'wrecked') {
            return res.status(400).json({ ok: false, error: 'Wrecked cards cannot be renewed' });
        }

        // Get renewal cost
        const renewalCost = RENEWAL_PRICES[card.cardType as CardType] || 15000;

        // Check if user has enough $FLIP
        if (flipBalance < renewalCost) {
            return res.status(400).json({
                ok: false,
                error: `Insufficient $FLIP balance. Need ${renewalCost.toLocaleString()}, have ${flipBalance.toLocaleString()}`
            });
        }

        // Renew the card
        const renewedCard = renewCard(card);
        cards[cardIndex] = renewedCard;

        // Save updated cards
        await kv.set(cardsKey, cards);

        // Deduct $FLIP from user
        await updateUser(cleanWallet, {
            flip: flipBalance - renewalCost
        });

        return res.status(200).json({
            ok: true,
            card: renewedCard,
            cost: renewalCost,
            newBalance: flipBalance - renewalCost,
        });
    } catch (error: any) {
        console.error('Renew card error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
