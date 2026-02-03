import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { kv } from '@vercel/kv'
import { submitChoice, TasoGame } from '../../../../lib/tasoGame'

// Config
const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT
const ORACLE_PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY
// Use DRPC or fallback
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base.drpc.org'

const ARENA_ABI = [
    "function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external",
    "function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external"
]

// Helper to get a random card for visual purposes
function getRandomCard() {
    const types = ['pegasus', 'unicorn', 'genesis', 'sentient']
    const type = types[Math.floor(Math.random() * types.length)]
    return {
        cardId: 'visual-' + Date.now(),
        tokenId: 'SOL',
        symbol: 'SOL',
        name: 'Solana',
        logo: '/token-logos/sol.png', // Placeholder
        cardType: type
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    const { gameId: reqGameId, roomId, wallet, choice, tier } = req.body

    // Normalize gameId (Frontend might send roomId)
    const gameId = reqGameId || roomId

    if (!gameId || !wallet || !choice) {
        return res.status(400).json({ ok: false, error: 'Missing required fields (gameId/roomId, wallet, choice)' })
    }

    try {
        console.log(`[Taso Choice] Received: ${gameId} ${wallet} ${choice}`)
        const TASO_KEY = `taso:${gameId}`

        // 1. Fetch existing game state
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
                stake: 0, // Filled from contract later or ignored for visual
                pot: 0,
                winnerPayout: 0,
                houseFee: 0,
                player1: {
                    wallet: wallet.toLowerCase(),
                    card: getRandomCard(),
                    choice: choice
                }
            }
            updated = true
        } else {
            // Existing Game
            const wLower = wallet.toLowerCase()

            if (game.player1.wallet === wLower) {
                // Update P1 choice
                game.player1.choice = choice
                updated = true
            } else if (!game.player2 || game.player2.wallet === wLower) {
                // Player 2 Joining or updating
                if (!game.player2) {
                    game.player2 = {
                        wallet: wLower,
                        card: getRandomCard(), // Give P2 a random card too
                        choice: choice
                    }
                    game.status = 'waiting_choices' // Or 'resolved' if P1 also chose?
                } else {
                    game.player2.choice = choice
                }
                updated = true
            } else {
                return res.status(403).json({ ok: false, error: 'Room is full' })
            }
        }

        // Check for Resolution
        if (game.player1.choice && game.player2?.choice) {
            // Logic from lib/tasoGame: determineWinner
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
                // Random winner for visual if needed, but 'draw' status handles logic
                winner = Math.random() > 0.5 ? game.player1.wallet : game.player2!.wallet;
            }

            game.flipResult = flipResult;
            game.winner = winner;
            game.status = status;
            game.resolvedAt = Date.now();
            updated = true;

            console.log(`[Taso Choice] Locally resolved: ${status} result=${flipResult}`)
        }

        if (updated) {
            await kv.set(TASO_KEY, game)
        }

        const updatedGame = game;

        // 2. If locally resolved, trigger Blockchain Resolution
        if (updatedGame.status === 'resolved' || updatedGame.status === 'draw') {
            // We don't want to block the UI response too long, but we should try to trigger it
            // For robustness, we'll await it here, but handle errors gracefully
            try {
                if (!ARENA_CONTRACT || !ORACLE_PRIVATE_KEY) {
                    console.error('[Taso Choice] Missing contract/oracle config')
                    // Return success for UI update even if chain fails (can be retried by cron/script)
                    return res.status(200).json({ ok: true, game: updatedGame, warning: 'Chain sync pending' })
                }

                console.log('[Taso Choice] Triggering blockchain resolution...')
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

                // Return tx hash in response
                return res.status(200).json({ ok: true, game: updatedGame, txHash: tx.hash })

            } catch (chainErr: any) {
                console.error('[Taso Choice] Blockchain resolution failed:', chainErr)
                // Return success for UI, but log error. A cron job should pick this up later ideally.
                return res.status(200).json({ ok: true, game: updatedGame, warning: 'Chain resolution failed, will retry' })
            }
        }

        // Return updated game state (waiting for opponent)
        return res.status(200).json({ ok: true, game: updatedGame })

    } catch (error: any) {
        console.error('[Taso Choice] Error:', error)
        return res.status(500).json({ ok: false, error: error.message || 'Internal server error' })
    }
}
