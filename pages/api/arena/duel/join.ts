/**
 * POST /api/arena/duel/join - Join Flip Duel room
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { joinFlipDuel, getFlipDuel, CARDS_PER_DUEL, DuelCard, getTokenFDV, DUEL_TIERS, FlipDuel } from '../../../../lib/duelV2';
import { getUser } from '../../../../lib/users';
import { getTokenById } from '../../../../lib/tokens';

const DUEL_PREFIX = 'duel_v2:';

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

        // Build DuelCard objects with FDV fetched immediately
        const duelCards: DuelCard[] = [];
        for (const tokenId of selectedTokenIds) {
            const token = getTokenById(tokenId);
            if (token) {
                // Fetch FDV immediately for player2
                const fdv = token.dexscreenerPair ? await getTokenFDV(token.dexscreenerPair) : 0;
                duelCards.push({
                    cardId: `${tokenId}_${Date.now()}`,
                    tokenId,
                    symbol: token.symbol,
                    name: token.name,
                    logo: token.logo,
                    cardType: token.about || 'common',
                    fdv,
                });
            }
        }

        // Also fetch FDV for player1's cards that are missing
        for (const card of existingDuel.player1.cards) {
            if (card.fdv === 0) {
                const token = getTokenById(card.tokenId);
                if (token?.dexscreenerPair) {
                    card.fdv = await getTokenFDV(token.dexscreenerPair);
                }
            }
        }
        existingDuel.player1.totalFdv = existingDuel.player1.cards.reduce((sum, c) => sum + c.fdv, 0);

        // Join duel with FDV-populated cards
        const player2TotalFdv = duelCards.reduce((sum, c) => sum + c.fdv, 0);

        // Build the matched duel object with all FDV data
        const matchedDuel: FlipDuel = {
            ...existingDuel,
            status: 'matched',
            matchedAt: Date.now(),
            player1: existingDuel.player1, // Already has FDV updated
            player2: {
                wallet: cleanWallet,
                cards: duelCards,
                totalFdv: player2TotalFdv,
            }
        };

        // Determine winner
        if (matchedDuel.player1.totalFdv > player2TotalFdv) {
            matchedDuel.winner = matchedDuel.player1.wallet;
        } else if (player2TotalFdv > matchedDuel.player1.totalFdv) {
            matchedDuel.winner = cleanWallet;
        } else {
            // Tie - random selection
            matchedDuel.winner = Math.random() > 0.5 ? matchedDuel.player1.wallet : cleanWallet;
        }

        matchedDuel.status = 'resolved';
        matchedDuel.resolvedAt = Date.now();

        // Credit winner's rewards balance
        const winnerWallet = matchedDuel.winner;
        const rewardsKey = `rewards:${winnerWallet}`;
        const currentRewards = await kv.get<number>(rewardsKey) || 0;
        await kv.set(rewardsKey, currentRewards + matchedDuel.winnerPayout);

        // Save the fully resolved duel with FDV data
        await kv.set(`${DUEL_PREFIX}${duelId}`, matchedDuel);

        // Remove from open duels
        await kv.srem('duels_v2:open', duelId);

        return res.status(200).json({
            ok: true,
            duel: matchedDuel,
        });
    } catch (error: any) {
        console.error('Join duel error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
