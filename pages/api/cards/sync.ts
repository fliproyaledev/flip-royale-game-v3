// pages/api/cards/sync.ts
// Sync cards from Oracle to local KV for inventory display
// Oracle stores: user.inventory = { tokenId: count, btc: 2, eth: 1, ... }
// Local expects: CardInstance[] with full metadata

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { createCardInstance, parseCardType, CardInstance, CardType } from '../../../lib/cardInstance';
import { TOKENS } from '../../../lib/tokens';

const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

// Pack keys to exclude from card sync
const PACK_KEYS = ['common_pack', 'rare_pack', 'unicorn_pack', 'genesis_pack', 'sentient_pack', 'common', 'rare', 'unicorn', 'genesis', 'sentient'];

// Get cardType from tokenId by looking up in TOKENS array
function getCardTypeFromToken(tokenId: string): CardType {
    const token = TOKENS.find(t => t.id.toLowerCase() === tokenId.toLowerCase());
    if (token && token.about) {
        return parseCardType(token.about);
    }
    return 'pegasus'; // Default
}

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

        // Fetch user data from Oracle using GET endpoint
        const oracleRes = await fetch(`${ORACLE_URL}/api/users/get?address=${cleanWallet}`, {
            headers: {
                'Authorization': `Bearer ${ORACLE_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        if (!oracleRes.ok) {
            // Try alternate endpoint format
            const altRes = await fetch(`${ORACLE_URL}/api/users/${cleanWallet}`, {
                headers: {
                    'Authorization': `Bearer ${ORACLE_SECRET}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!altRes.ok) {
                return res.status(altRes.status).json({ ok: false, error: 'Failed to fetch from Oracle' });
            }
            return handleOracleResponse(await altRes.json(), cleanWallet, res);
        }

        return handleOracleResponse(await oracleRes.json(), cleanWallet, res);

    } catch (error: any) {
        console.error('Sync cards error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

async function handleOracleResponse(oracleData: any, cleanWallet: string, res: NextApiResponse) {
    const user = oracleData.user || oracleData;

    if (!user || !user.inventory) {
        return res.status(200).json({
            ok: true,
            message: 'No inventory found in Oracle',
            synced: 0,
            total: 0
        });
    }

    // Get existing local cards
    const cardsKey = `cards:${cleanWallet}`;
    const existingCards = await kv.get<CardInstance[]>(cardsKey) || [];

    // ORACLE FORMAT: inventory = { tokenId: count } (e.g. { btc: 2, eth: 1 })
    // We need to convert this to CardInstance array
    const inventory = user.inventory;
    const newCardInstances: CardInstance[] = [];

    // Track existing tokenIds to avoid duplicates
    const existingTokenIdCounts: Record<string, number> = {};
    for (const card of existingCards) {
        existingTokenIdCounts[card.tokenId] = (existingTokenIdCounts[card.tokenId] || 0) + 1;
    }

    for (const [key, value] of Object.entries(inventory)) {
        // Skip pack entries
        if (PACK_KEYS.includes(key.toLowerCase()) || key.includes('_pack')) {
            continue;
        }

        // Value is the count of this card
        const count = typeof value === 'number' ? value : 0;
        if (count <= 0) continue;

        // Check if this is a valid token
        const token = TOKENS.find(t => t.id.toLowerCase() === key.toLowerCase());
        if (!token) {
            console.log(`[Sync] Skipping unknown token: ${key}`);
            continue;
        }

        // Get card type from token's about field
        const cardType = getCardTypeFromToken(key);

        // How many we already have locally?
        const existingCount = existingTokenIdCounts[key] || 0;
        const newCardsNeeded = count - existingCount;

        // Create new card instances for difference
        for (let i = 0; i < newCardsNeeded; i++) {
            const cardInstance = createCardInstance(key, cardType, cleanWallet);
            newCardInstances.push(cardInstance);
        }
    }

    if (newCardInstances.length === 0) {
        return res.status(200).json({
            ok: true,
            message: 'Cards already synced',
            synced: 0,
            total: existingCards.length,
            existing: existingCards.length
        });
    }

    // Combine existing + new cards
    const allCards = [...existingCards, ...newCardInstances];

    // Save to KV
    await kv.set(cardsKey, allCards);

    console.log(`[Sync] ✅ Synced ${newCardInstances.length} new cards for ${cleanWallet.slice(0, 10)}... (${existingCards.length} existed, ${allCards.length} total)`);

    return res.status(200).json({
        ok: true,
        synced: newCardInstances.length,
        total: allCards.length,
        existing: existingCards.length
    });
}

