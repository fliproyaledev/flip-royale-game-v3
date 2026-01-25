/**
 * POST /api/arena/duel/create - Yeni Flip Duel odası oluştur
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createFlipDuel, checkDailyLimit, DUEL_TIERS, DuelTier, CARDS_PER_DUEL, DuelCard } from '../../../../lib/duelV2';
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
        const activeCardCount = cardTokenIds.reduce((sum, id) => sum + (inventory[id] || 0), 0);

        if (activeCardCount < CARDS_PER_DUEL) {
            return res.status(400).json({
                ok: false,
                error: `Need at least ${CARDS_PER_DUEL} cards. You have ${activeCardCount}`
            });
        }

        // Check daily limit
        const limitCheck = await checkDailyLimit(cleanWallet, activeCardCount);
        if (!limitCheck.allowed) {
            return res.status(400).json({
                ok: false,
                error: `Daily duel limit reached. Limit: ${limitCheck.limit}`
            });
        }

        // Select random cards from inventory (exclude Virtual - no reliable FDV)
        const availableCards: { tokenId: string; count: number }[] = [];
        const EXCLUDED_TOKENS = ['virtual']; // Tokens to exclude from Duel

        for (const [tokenId, count] of Object.entries(inventory)) {
            if (!tokenId.includes('_pack') && count > 0 && !EXCLUDED_TOKENS.includes(tokenId.toLowerCase())) {
                availableCards.push({ tokenId, count: count as number });
            }
        }

        // Flatten and shuffle
        const allCards: string[] = [];
        for (const { tokenId, count } of availableCards) {
            for (let i = 0; i < count; i++) {
                allCards.push(tokenId);
            }
        }

        // Fisher-Yates shuffle
        for (let i = allCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }

        const selectedTokenIds = allCards.slice(0, CARDS_PER_DUEL);

        // Build DuelCard objects with FDV
        const duelCards: DuelCard[] = [];
        for (const tokenId of selectedTokenIds) {
            const token = getTokenById(tokenId);
            if (token) {
                // TODO: Fetch real FDV from DexScreener
                duelCards.push({
                    cardId: `${tokenId}_${Date.now()}`,
                    tokenId,
                    symbol: token.symbol,
                    name: token.name,
                    logo: token.logo,
                    cardType: token.about || 'common',
                    fdv: 0, // Will be fetched when match resolves
                });
            }
        }

        if (duelCards.length < CARDS_PER_DUEL) {
            return res.status(400).json({ ok: false, error: 'Could not build card set' });
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
