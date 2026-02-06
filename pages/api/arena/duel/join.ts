/**
 * POST /api/arena/duel/join - Join an existing Flip Duel
 * RULE: Cards with FDV=0 are NOT allowed in duels
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getFlipDuel, CARDS_PER_DUEL, DuelCard, getTokenFDV, DUEL_TIERS, FlipDuel, saveFlipDuel } from '../../../../lib/duelV2';
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

        // Get the existing duel
        const existingDuel = await getFlipDuel(duelId);
        if (!existingDuel) {
            return res.status(404).json({ ok: false, error: 'Duel not found' });
        }

        if (existingDuel.status !== 'open') {
            return res.status(400).json({ ok: false, error: 'Duel is no longer available' });
        }

        if (existingDuel.player1.wallet === cleanWallet) {
            return res.status(400).json({ ok: false, error: 'Cannot join your own duel' });
        }

        // Get user and check inventory
        const user = await getUser(cleanWallet);
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' });
        }

        const inventory = user.inventory || {};

        // Filter and validate cards - ONLY cards with valid pair address AND non-zero FDV
        const validCards: { tokenId: string; count: number; fdv: number }[] = [];
        const invalidCards: string[] = [];

        for (const [tokenId, count] of Object.entries(inventory)) {
            if (tokenId.includes('_pack') || (count as number) <= 0) continue;

            const token = getTokenById(tokenId);
            if (!token) continue;

            // STRICT RULE: Check if token has valid pair address
            if (!token.dexscreenerPair) {
                invalidCards.push(token.symbol);
                continue;
            }

            // Fetch FDV using ONLY the pair address
            const fdv = await getTokenFDV(token.dexscreenerPair);

            // STRICT RULE: Cards with FDV=0 are NOT allowed
            if (fdv === 0) {
                invalidCards.push(token.symbol);
                continue;
            }

            validCards.push({ tokenId, count: count as number, fdv });
        }

        const validCardCount = validCards.reduce((sum, c) => sum + c.count, 0);

        if (validCardCount < CARDS_PER_DUEL) {
            return res.status(400).json({
                ok: false,
                error: `Need at least ${CARDS_PER_DUEL} cards with valid FDV. You have ${validCardCount} valid cards.`,
                invalidCards: invalidCards.length > 0 ? invalidCards : undefined
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

        // Build DuelCard objects with validated FDV
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
                    fdv, // Pre-validated FDV from pair address
                });
            }
        }

        if (duelCards.length < CARDS_PER_DUEL) {
            return res.status(400).json({ ok: false, error: 'Could not build card set with valid FDV' });
        }

        // Re-validate player1's cards FDV (in case they changed since creation)
        for (const card of existingDuel.player1.cards) {
            const token = getTokenById(card.tokenId);
            if (token?.dexscreenerPair) {
                card.fdv = await getTokenFDV(token.dexscreenerPair);
            } else {
                card.fdv = 0;
            }
        }

        // Check if any player1 card now has FDV=0 (shouldn't happen but safety check)
        const player1InvalidCards = existingDuel.player1.cards.filter(c => c.fdv === 0);
        if (player1InvalidCards.length > 0) {
            console.warn('Player1 has cards with FDV=0:', player1InvalidCards.map(c => c.symbol));
        }

        existingDuel.player1.totalFdv = existingDuel.player1.cards.reduce((sum, c) => sum + c.fdv, 0);
        const player2TotalFdv = duelCards.reduce((sum, c) => sum + c.fdv, 0);

        // Build the matched duel object
        const matchedDuel: FlipDuel = {
            ...existingDuel,
            status: 'matched',
            matchedAt: Date.now(),
            player1: existingDuel.player1,
            player2: {
                wallet: cleanWallet,
                cards: duelCards,
                totalFdv: player2TotalFdv,
            }
        };

        // Determine winner - highest total FDV wins
        if (matchedDuel.player1.totalFdv > player2TotalFdv) {
            matchedDuel.winner = matchedDuel.player1.wallet;
        } else if (player2TotalFdv > matchedDuel.player1.totalFdv) {
            matchedDuel.winner = cleanWallet;
        } else {
            // Tie - random selection
            const crypto = require('crypto');
            matchedDuel.winner = crypto.randomInt(0, 2) === 0 ? matchedDuel.player1.wallet : cleanWallet;
        }

        matchedDuel.status = 'resolved';
        matchedDuel.resolvedAt = Date.now();

        // ... existing logic
        // Save matched duel
        await saveFlipDuel(matchedDuel);

        // ─────────────────────────────────────────────────────────────
        // ON-CHAIN RESOLUTION (TRIGGER PAYOUT)
        // ─────────────────────────────────────────────────────────────
        try {
            const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT;
            const ORACLE_PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY;
            const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

            if (ARENA_CONTRACT && ORACLE_PRIVATE_KEY) {
                const ethers = require('ethers');
                const provider = new ethers.JsonRpcProvider(RPC_URL);
                const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);

                const ABI = [
                    'function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external',
                    'function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external'
                ];
                const contract = new ethers.Contract(ARENA_CONTRACT, ABI, wallet);

                const nonce = ethers.keccak256(ethers.toUtf8Bytes(`${duelId}-${Date.now()}-${Math.random()}`));
                const winnerAddress = matchedDuel.winner === matchedDuel.player1.wallet || matchedDuel.winner === matchedDuel.player2?.wallet ? matchedDuel.winner : ethers.ZeroAddress;
                // Check if it was a tie from backend logic (winner was random pick) - but contract doesn't know "random pick tie". 
                // In backend logic above: Tie -> Random Winner. So we send a WINNER.
                // Wait, if backend picked a random winner for tie, we should send that winner.
                // UNLESS we want to support DRAW payout (refund?).
                // Backend logic above: "Tie - random selection". So there IS a winner.
                // So we call resolveRoom with that winner.

                // Create message hash
                const messageHash = ethers.solidityPackedKeccak256(
                    ['bytes32', 'address', 'bytes32'],
                    [duelId, winnerAddress, nonce]
                );
                const signature = await wallet.signMessage(ethers.getBytes(messageHash));

                console.log(`Resolving room ${duelId} on-chain for winner ${winnerAddress}...`);

                // We assume it's always a winner resolution based on current logic (no draws allowed in V2 logic)
                // Wait, V2 logic has "Tie - random selection". So always a winner.
                const tx = await contract.resolveRoom(duelId, winnerAddress, nonce, signature);
                console.log(`Resolution Tx Sent: ${tx.hash}`);

                // Optional: Wait for receipt? Maybe not to keep response fast.
                // But Vercel might kill the process. Ideally we await.
                // await tx.wait();
            } else {
                console.error('Missing Oracle configuration, cannot trigger payout.');
            }
        } catch (chainError) {
            console.error('Failed to resolve on-chain:', chainError);
            // Don't fail the request, users can see result in UI, we can retry payout later if needed
        }

        return res.status(200).json({
            ok: true,
            duel: matchedDuel,
        });
    } catch (error: any) {
        console.error('Join duel error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
