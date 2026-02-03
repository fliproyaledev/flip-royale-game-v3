// pages/api/arena/taso/[id].ts
// Fetch specific Taso room details and player choices

import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { kv } from '@vercel/kv'
import { TOKEN_MAP } from '../../../../lib/tokens'

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B"
const RPC_URL = "https://mainnet.base.org"

const ARENA_ABI = [
    "function rooms(bytes32 roomId) view returns (address player1, address player2, address player1Card, address player2Card, uint8 tier, uint8 status, uint256 stake, uint8 gameMode, address winner)"
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
        if (roomData.status === 0) status = 'open'
        else if (roomData.status === 1 || roomData.status === 2) status = 'waiting_choices'
        else if (roomData.status === 3) status = 'resolved'
        else if (roomData.status === 4) status = 'cancelled'

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

        // 4. Determine result
        let flipResult = kvGame?.flipResult || null
        if (status === 'resolved' && !flipResult) {
            // Fallback if KV missing but contract resolved (e.g. resolved via script/direct)
            if (roomData.winner !== '0x0000000000000000000000000000000000000000') {
                if (roomData.winner.toLowerCase() === roomData.player1.toLowerCase()) {
                    flipResult = p1Choice // Assume winner was correct
                } else {
                    flipResult = p2Choice // Assume winner was correct
                }
            }
        } else if (status === 'draw') {
            // Keep flipResult consistent if possible, or just don't show specific side if draw (logic handles it)
        }

        // 5. Build Token Info
        const getTokenInfo = (addr: string) => {
            const token = TOKEN_MAP[addr.toLowerCase()] || { symbol: 'TOKEN', name: 'Unknown Token', logo: '/token-logos/placeholder.png', about: 'sentient' }
            return {
                tokenId: addr,
                symbol: token.symbol,
                name: token.name,
                logo: token.logo,
                cardType: token.about || 'sentient'
            }
        }

        const game = {
            id: roomId,
            status,
            stake: Number(ethers.formatUnits(roomData.stake, 6)), // USDC decimals = 6
            player1: {
                wallet: roomData.player1,
                card: getTokenInfo(roomData.player1Card),
                choice: p1Choice
            },
            player2: roomData.player2 !== '0x0000000000000000000000000000000000000000' ? {
                wallet: roomData.player2,
                card: getTokenInfo(roomData.player2Card),
                choice: p2Choice
            } : null,
            flipResult,
            winner: roomData.winner !== '0x0000000000000000000000000000000000000000' ? roomData.winner : null
        }

        return res.status(200).json({ ok: true, game })

    } catch (error: any) {
        console.error('Fetch game error:', error)
        return res.status(500).json({ ok: false, error: 'Failed to fetch game details' })
    }
}
