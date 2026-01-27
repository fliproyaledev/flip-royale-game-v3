/**
 * POST /api/arena/duel/create - Create new Flip Duel room
 * RULE: Cards with FDV=0 are NOT allowed in duels
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createFlipDuel, checkDailyLimit, DUEL_TIERS, DuelTier, CARDS_PER_DUEL, DuelCard, getTokenFDV } from '../../../../lib/duelV2';
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

        if (!tier || !DUEL_TIERS[tier as DuelTier]) {
            return res.status(400).json({ ok: false, error: 'Invalid tier' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Get user and check inventory
        const user = await getUser(cleanWallet);
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        // Count active cards (for now using legacy inventory)
        const inventory = user.inventory || {};
        const cardTokenIds = Object.keys(inventory).filter(k => !k.includes('_pack'));

        // First, filter out cards that don't have valid pair addresses
        // We need to verify FDV before allowing in duel
        const validCards: { tokenId: string; count: number; fdv: number }[] = [];
        const invalidCards: string[] = [];

        for (const tokenId of cardTokenIds) {
            const count = inventory[tokenId] || 0;
            if (count <= 0) continue;

            const token = getTokenById(tokenId);
            if (!token) continue;

            // STRICT RULE: Check if token has valid pair address and non-zero FDV
            if (!token.dexscreenerPair) {
                invalidCards.push(token.symbol);
                continue;
            }

            // Fetch FDV using ONLY the pair address from token-list.json
            const fdv = await getTokenFDV(token.dexscreenerPair);

            // STRICT RULE: Cards with FDV=0 are NOT allowed
            if (fdv === 0) {
                invalidCards.push(token.symbol);
                continue;
            }

            validCards.push({ tokenId, count, fdv });
        }

        // Count total valid cards
        const validCardCount = validCards.reduce((sum, c) => sum + c.count, 0);

        if (validCardCount < CARDS_PER_DUEL) {
            return res.status(400).json({
                ok: false,
                error: `Need at least ${CARDS_PER_DUEL} cards with valid FDV. You have ${validCardCount} valid cards.`,
                invalidCards: invalidCards.length > 0 ? invalidCards : undefined
            });
        }

        // Check daily limit
        const limitCheck = await checkDailyLimit(cleanWallet, validCardCount);
        if (!limitCheck.allowed) {
            return res.status(400).json({
                ok: false,
                error: `Daily duel limit reached. Limit: ${limitCheck.limit}`
            });
        }

        // Flatten and shuffle valid cards only
        const allCards: { tokenId: string; fdv: number }[] = [];
        for (const { tokenId, count, fdv } of validCards) {
            for (let i = 0; i < count; i++) {
                allCards.push({ tokenId, fdv });
            }
        }

        // Fisher-Yates shuffle
        for (let i = allCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }

        const selectedCards = allCards.slice(0, CARDS_PER_DUEL);

        // Build DuelCard objects with pre-fetched FDV
        const duelCards: DuelCard[] = [];
        for (const { tokenId, fdv } of selectedCards) {
            const token = getTokenById(tokenId);
            if (token) {
                duelCards.push({
                    cardId: `${tokenId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                    tokenId,
                    symbol: token.symbol,
                    name: token.name,
                    logo: token.logo,
                    cardType: token.about || 'common',
                    fdv, // Pre-fetched FDV from pair address
                });
            }
        }

        if (duelCards.length < CARDS_PER_DUEL) {
            return res.status(400).json({ ok: false, error: 'Could not build card set with valid FDV' });
        }

        // Create duel
        const duel = await createFlipDuel(cleanWallet, tier as DuelTier, duelCards);

        return res.status(200).json({
            ok: true,
            duel,
            remaining: limitCheck.remaining - 1,
            limit: limitCheck.limit,
        });
    } catch (error: any) {
        console.error('Create duel error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
