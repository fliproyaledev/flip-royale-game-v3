// pages/api/arena/taso/[id].ts
// Fetch specific Taso room details and player choices

import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { kv } from '@vercel/kv'
import { TOKEN_MAP } from '../../../../lib/tokens'

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B"
// Use High-Perf RPC from env, or fallback to reliable public nodes
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base.drpc.org'

const ARENA_ABI = [
    "function rooms(bytes32 roomId) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)"
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query
    const roomId = id as string

    if (!roomId) {
        return res.status(400).json({ ok: false, error: 'Room ID required' })
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const arena = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, provider)

        // 1. Fetch room from contract
        const roomData = await arena.rooms(roomId)

        if (roomData.player1 === '0x0000000000000000000000000000000000000000') {
            return res.status(404).json({ ok: false, error: 'Room not found' })
        }

        // 2. Map status (Contract: 0=Open, 1=Joined, 2=InGame, 3=Resolved, 4=Cancelled)
        // Frontend expects: 'open', 'waiting_choices', 'resolved', 'draw', 'cancelled'
        let status = 'open'
        const rawStatus = Number(roomData.status)
        if (rawStatus === 0) status = 'open'
        else if (rawStatus === 1 || rawStatus === 2) status = 'waiting_choices'
        else if (rawStatus === 3) status = 'resolved'
        else if (rawStatus === 4) status = 'cancelled'

        // 3. Get Game State from KV (Source of Truth for Choices & Visuals)
        const tasoKey = `taso:${roomId}`
        const kvGame = await kv.get<any>(tasoKey)

        // Merge Status: Contract is ultimate truth for money, but KV is faster for UI flow
        // If KV is resolved (we flipped), show it even if chain is pending
        if (kvGame && (kvGame.status === 'resolved' || kvGame.status === 'draw')) {
            status = kvGame.status
        }

        const p1Choice = kvGame?.player1?.choice || null
        const p2Choice = kvGame?.player2?.choice || null
        const p1Card = kvGame?.player1?.card || { symbol: 'ETH', cardType: 'genesis', logo: '/token-logos/eth.png' }
        const p2Card = kvGame?.player2?.card || { symbol: 'ETH', cardType: 'pegasus', logo: '/token-logos/btc.png' }

        // 4. Determine result & Winner
        let flipResult = kvGame?.flipResult || null

        let winner = roomData.winner
        // Fallback to KV winner if chain is pending/zero but we have a local winner
        if ((winner === '0x0000000000000000000000000000000000000000' || !winner) && kvGame?.winner && status === 'resolved') {
            winner = kvGame.winner
        }

        if (status === 'resolved' && !flipResult) {
            // Fallback if KV missing but contract resolved (e.g. resolved via script/direct)
            if (winner !== '0x0000000000000000000000000000000000000000') {
                if (winner.toLowerCase() === roomData.player1.toLowerCase()) {
                    flipResult = p1Choice // Assume winner was correct
                } else if (roomData.player2 && winner.toLowerCase() === roomData.player2.toLowerCase()) {
                    flipResult = p2Choice // Assume winner was correct
                }
            }
        }

        const game = {
            id: roomId,
            status,
            stake: Number(ethers.formatUnits(roomData.stake, 6)), // USDC decimals = 6
            player1: {
                wallet: roomData.player1,
                card: p1Card,
                choice: p1Choice
            },
            player2: roomData.player2 !== '0x0000000000000000000000000000000000000000' ? {
                wallet: roomData.player2,
                card: p2Card,
                choice: p2Choice
            } : null,
            flipResult,
            winner: winner !== '0x0000000000000000000000000000000000000000' ? winner : null
        }

        return res.status(200).json({ ok: true, game })

    } catch (error: any) {
        console.error('Fetch game error:', error)
        return res.status(500).json({ ok: false, error: 'Failed to fetch game details' })
    }
}

