// pages/api/cards/sync.ts
// Sync cards from Oracle to local KV for inventory display

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { createCardInstance, parseCardType, CardInstance, CardType } from '../../../lib/cardInstance';

const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet } = req.body;

        if (!wallet || typeof wallet !== 'string') {
            return res.status(400).json({ ok: false, error: 'Wallet address required' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Check if Oracle is configured
        if (!ORACLE_URL || !ORACLE_SECRET) {
            return res.status(400).json({ ok: false, error: 'Oracle not configured' });
        }

        // Fetch user data from Oracle (which has their cards)
        const oracleRes = await fetch(`${ORACLE_URL}/api/users/${cleanWallet}`, {
            headers: {
                'Authorization': `Bearer ${ORACLE_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        if (!oracleRes.ok) {
            return res.status(oracleRes.status).json({ ok: false, error: 'Failed to fetch from Oracle' });
        }

        const oracleData = await oracleRes.json();
        const user = oracleData.user || oracleData;

        // Get existing local cards
        const cardsKey = `cards:${cleanWallet}`;
        const existingCards = await kv.get<CardInstance[]>(cardsKey) || [];

        // Oracle cards come from inventory.cards or similar
        const oracleCards = user.inventory?.cards || user.cards || [];

        if (oracleCards.length === 0) {
            return res.status(200).json({
                ok: true,
                message: 'No cards found in Oracle',
                existing: existingCards.length
            });
        }

        // Convert Oracle cards to CardInstance format
        const newCardInstances: CardInstance[] = oracleCards.map((card: any) => {
            // Check if this card already exists in local KV (by tokenId match)
            const tokenId = card.tokenId || card.symbol || card.id || 'unknown';
            const cardType = card.cardType
                ? parseCardType(card.cardType)
                : (card.about ? parseCardType(card.about) : 'pegasus' as CardType);

            return createCardInstance(tokenId, cardType, cleanWallet);
        });

        // Merge: keep existing + add new (avoid duplicates by checking if similar tokenId exists)
        const existingTokenIds = new Set(existingCards.map(c => c.tokenId));
        const trulyNewCards = newCardInstances.filter(c => !existingTokenIds.has(c.tokenId));

        const allCards = [...existingCards, ...trulyNewCards];

        // Save to KV
        await kv.set(cardsKey, allCards);

        console.log(`[Migration] ✅ Synced ${trulyNewCards.length} new cards for ${cleanWallet.slice(0, 10)}... (${existingCards.length} existed)`);

        return res.status(200).json({
            ok: true,
            synced: trulyNewCards.length,
            total: allCards.length,
            existing: existingCards.length
        });

    } catch (error: any) {
        console.error('Sync cards error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
