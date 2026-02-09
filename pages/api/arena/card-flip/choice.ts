import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { kv } from '@vercel/kv'
import { TasoGame } from '../../../../lib/tasoGame'
import { getTokenById } from '../../../../lib/tokens'
import { CardInstance, wreckCard } from '../../../../lib/cardInstance'

// Config
const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT
const ORACLE_PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY
// Use DRPC or fallback
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base.drpc.org'

const ARENA_ABI = [
    "function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external",
    "function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external"
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    const { gameId: reqGameId, roomId, wallet, choice, tier, cardId } = req.body

    // Normalize gameId (Frontend might send roomId)
    const gameId = reqGameId || roomId

    if (!gameId || !wallet || !choice) {
        return res.status(400).json({ ok: false, error: 'Missing required fields (gameId/roomId, wallet, choice)' })
    }

    if (!cardId) {
        return res.status(400).json({ ok: false, error: 'Missing cardId. You must wager a card!' })
    }

    try {
        console.log(`[Taso Choice] Received: ${gameId} ${wallet} ${choice} Card:${cardId}`)
        const TASO_KEY = `taso:${gameId}`
        const cleanWallet = wallet.toLowerCase()

        // 1. Fetch User's Real Card from Inventory
        const cardsKey = `cards:${cleanWallet}`
        const userCards = await kv.get<CardInstance[]>(cardsKey) || []
        const wagerCard = userCards.find(c => c.id === cardId)

        if (!wagerCard) {
            return res.status(400).json({ ok: false, error: 'Card not found in your inventory' })
        }

        if (wagerCard.status !== 'active') {
            return res.status(400).json({ ok: false, error: 'Card is not active (expired or wrecked)' })
        }

        // Enrich card with metadata (Logo, Name) for display
        const tokenMeta = getTokenById(wagerCard.tokenId)
        const enrichedCard = {
            ...wagerCard,
            symbol: tokenMeta?.symbol || wagerCard.tokenId,
            name: tokenMeta?.name || wagerCard.tokenId,
            logo: tokenMeta?.logo || '/token-logos/placeholder.png'
        }

        // 2. Fetch existing game state
        let game = await kv.get<TasoGame>(TASO_KEY)
        let updated = false

        if (!game) {
            // New Game (Player 1)
            console.log(`[Taso Choice] Initializing new game ${gameId}`)
            game = {
                id: gameId,
                tier: tier || 0,
                status: 'open',
                createdAt: Date.now(),
                stake: 0,
                pot: 0,
                winnerPayout: 0,
                houseFee: 0,
                player1: {
                    wallet: cleanWallet,
                    card: enrichedCard,
                    choice: choice
                }
            }
            updated = true
        } else {
            // Existing Game

            if (game.player1.wallet === cleanWallet) {
                // Update P1 choice (and card if changed?)
                game.player1.choice = choice
                game.player1.card = enrichedCard
                updated = true
            } else if (!game.player2 || game.player2.wallet === cleanWallet) {
                // Player 2 Joining or updating
                if (!game.player2) {
                    game.player2 = {
                        wallet: cleanWallet,
                        card: enrichedCard,
                        choice: choice
                    }
                    game.status = 'waiting_choices'
                } else {
                    game.player2.choice = choice
                    game.player2.card = enrichedCard
                }
                updated = true
            } else {
                return res.status(403).json({ ok: false, error: 'Room is full' })
            }
        }

        // Check for Resolution
        if (game.player1.choice && game.player2?.choice) {
            const crypto = require('crypto');
            const flipResult = (crypto.randomInt(0, 2) === 0 ? 'front' : 'back') as 'front' | 'back';

            const p1Correct = game.player1.choice === flipResult;
            const p2Correct = game.player2!.choice === flipResult;

            let winner: string | undefined;
            let status: 'resolved' | 'draw' = 'resolved';

            if (p1Correct && !p2Correct) {
                winner = game.player1.wallet;
            } else if (p2Correct && !p1Correct) {
                winner = game.player2!.wallet;
            } else {
                status = 'draw';
                winner = Math.random() > 0.5 ? game.player1.wallet : game.player2!.wallet;
            }

            game.flipResult = flipResult;
            game.winner = winner;
            game.status = status;
            game.resolvedAt = Date.now();
            updated = true;

            console.log(`[Taso Choice] Locally resolved: ${status} result=${flipResult}`)

            // ═══════════════════════════════════════════════════════════════
            // 🔥 CRITICAL: WRECK THE LOSER'S CARD
            // ═══════════════════════════════════════════════════════════════
            const loser = winner === game.player1.wallet ? game.player2! : game.player1;
            const loserCardId = (loser.card as any)?.id || loser.card?.cardId;

            if (loserCardId && loser.wallet) {
                try {
                    const loserCardsKey = `cards:${loser.wallet.toLowerCase()}`;
                    const loserCards = await kv.get<CardInstance[]>(loserCardsKey) || [];

                    const cardIndex = loserCards.findIndex(c => c.id === loserCardId);
                    if (cardIndex !== -1) {
                        // Apply wreck status
                        loserCards[cardIndex] = wreckCard(loserCards[cardIndex], game.id);
                        await kv.set(loserCardsKey, loserCards);

                        // Store loser card ID for reference
                        game.loserCardWrecked = loserCardId;

                        console.log(`💀 [Card Flip] Card ${loserCardId} WRECKED for loser ${loser.wallet}`);
                    } else {
                        console.error(`❌ [Card Flip] Card ${loserCardId} NOT FOUND in ${loser.wallet} inventory!`);
                    }
                } catch (wreckErr) {
                    console.error('[Card Flip] Failed to wreck card:', wreckErr);
                }
            } else {
                console.warn(`[Card Flip] Missing loser card info - Loser: ${loser.wallet}, CardId: ${loserCardId}`);
            }
        }

        if (updated) {
            await kv.set(TASO_KEY, game)

            // Update Open Rooms Set for fast listing
            const OPEN_KEY = 'taso:open'
            if (game.status === 'open') {
                await kv.sadd(OPEN_KEY, game.id)
            } else {
                await kv.srem(OPEN_KEY, game.id)
            }
        }

        const updatedGame = game;

        // 3. If locally resolved, trigger Blockchain Resolution
        if (updatedGame.status === 'resolved' || updatedGame.status === 'draw') {
            try {
                if (!ARENA_CONTRACT || !ORACLE_PRIVATE_KEY) {
                    console.error('[Taso Choice] Missing contract/oracle config')
                    return res.status(200).json({ ok: true, game: updatedGame, warning: 'Chain sync pending' })
                }

                console.log('[Taso Choice] Triggering blockchain resolution...')

                // Wait 2s to ensure contract state (joinRoom) has propagated to Oracle's RPC
                await new Promise(r => setTimeout(r, 2000))

                const provider = new ethers.JsonRpcProvider(RPC_URL)
                const oracleWallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider)
                const contract = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, oracleWallet)

                const roomId = updatedGame.id
                const nonce = ethers.keccak256(ethers.toUtf8Bytes(`${roomId}-${Date.now()}-${Math.random()}`))

                let tx
                if (updatedGame.status === 'draw') {
                    // Draw
                    const messageHash = ethers.solidityPackedKeccak256(
                        ['bytes32', 'address', 'bytes32'],
                        [roomId, ethers.ZeroAddress, nonce]
                    )
                    const signature = await oracleWallet.signMessage(ethers.getBytes(messageHash))
                    tx = await contract.resolveRoomDraw(roomId, nonce, signature)
                } else {
                    // Winner
                    const winnerAddr = updatedGame.winner!
                    const messageHash = ethers.solidityPackedKeccak256(
                        ['bytes32', 'address', 'bytes32'],
                        [roomId, winnerAddr, nonce]
                    )
                    const signature = await oracleWallet.signMessage(ethers.getBytes(messageHash))
                    tx = await contract.resolveRoom(roomId, winnerAddr, nonce, signature)
                }

                console.log(`[Taso Choice] Chain TX Sent: ${tx.hash}`)
                return res.status(200).json({ ok: true, game: updatedGame, txHash: tx.hash })

            } catch (chainErr: any) {
                console.error('[Taso Choice] Blockchain resolution failed:', chainErr)
                return res.status(200).json({ ok: true, game: updatedGame, warning: 'Chain resolution failed, will retry' })
            }
        }

        return res.status(200).json({ ok: true, game: updatedGame })

    } catch (error: any) {
        console.error('[Taso Choice] Error:', error)
        return res.status(500).json({ ok: false, error: error.message || 'Internal server error' })
    }
}
