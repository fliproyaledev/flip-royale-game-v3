/**
 * POST /api/arena/duel/join - Flip Duel odasına katıl
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { joinFlipDuel, resolveFlipDuel, getFlipDuel, CARDS_PER_DUEL, DuelCard, getTokenFDV } from '../../../../lib/duelV2';
import { getUser } from '../../../../lib/users';
import { getTokenById } from '../../../../lib/tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { wallet, duelId } = req.body;

        if (!wallet || !duelId) {
            return res.status(400).json({ ok: false, error: 'Wallet and duelId required' });
        }

        const cleanWallet = wallet.toLowerCase();

        // Verify duel exists and is open
        const existingDuel = await getFlipDuel(duelId);
        if (!existingDuel) {
            return res.status(404).json({ ok: false, error: 'Duel not found' });
        }
        if (existingDuel.status !== 'open') {
            return res.status(400).json({ ok: false, error: 'Duel is not open' });
        }

        // Get user and check inventory
        const user = await getUser(cleanWallet);
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const inventory = user.inventory || {};
        const cardTokenIds = Object.keys(inventory).filter(k => !k.includes('_pack'));
        const activeCardCount = cardTokenIds.reduce((sum, id) => sum + (inventory[id] || 0), 0);

        if (activeCardCount < CARDS_PER_DUEL) {
            return res.status(400).json({
                ok: false,
                error: `Need at least ${CARDS_PER_DUEL} cards`
            });
        }

        // Select random cards
        const allCards: string[] = [];
        for (const [tokenId, count] of Object.entries(inventory)) {
            if (!tokenId.includes('_pack') && typeof count === 'number' && count > 0) {
                for (let i = 0; i < count; i++) {
                    allCards.push(tokenId);
                }
            }
        }

        // Fisher-Yates shuffle
        for (let i = allCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }

        const selectedTokenIds = allCards.slice(0, CARDS_PER_DUEL);

        // Build DuelCard objects
        const duelCards: DuelCard[] = [];
        for (const tokenId of selectedTokenIds) {
            const token = getTokenById(tokenId);
            if (token) {
                duelCards.push({
                    cardId: `${tokenId}_${Date.now()}`,
                    tokenId,
                    symbol: token.symbol,
                    name: token.name,
                    logo: token.logo,
                    cardType: token.about || 'common',
                    fdv: 0,
                });
            }
        }

        // Join duel
        let duel = await joinFlipDuel(duelId, cleanWallet, duelCards);
        if (!duel) {
            return res.status(400).json({ ok: false, error: 'Failed to join duel' });
        }

        // Now fetch FDV for all cards and resolve
        // Fetch FDV for player1 cards
        for (const card of duel.player1.cards) {
            const token = getTokenById(card.tokenId);
            if (token?.dexscreenerPair) {
                card.fdv = await getTokenFDV(token.dexscreenerPair);
            }
        }
        duel.player1.totalFdv = duel.player1.cards.reduce((sum, c) => sum + c.fdv, 0);

        // Fetch FDV for player2 cards
        if (duel.player2) {
            for (const card of duel.player2.cards) {
                const token = getTokenById(card.tokenId);
                if (token?.dexscreenerPair) {
                    card.fdv = await getTokenFDV(token.dexscreenerPair);
                }
            }
            duel.player2.totalFdv = duel.player2.cards.reduce((sum, c) => sum + c.fdv, 0);
        }

        // Resolve duel
        duel = await resolveFlipDuel(duelId);

        return res.status(200).json({
            ok: true,
            duel,
        });
    } catch (error: any) {
        console.error('Join duel error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
