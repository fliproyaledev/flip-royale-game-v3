// pages/api/arena/rooms.ts
// Fetch open rooms from Arena contract

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B"

const ARENA_ABI = [
    {
        "inputs": [{ "type": "uint8", "name": "gameMode" }],
        "name": "getOpenRooms",
        "outputs": [{ "type": "bytes32[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "bytes32", "name": "roomId" }],
        "name": "rooms",
        "outputs": [
            { "type": "bytes32", "name": "id" },
            { "type": "address", "name": "player1" },
            { "type": "address", "name": "player2" },
            { "type": "uint256", "name": "stake" },
            { "type": "uint8", "name": "tier" },
            { "type": "uint8", "name": "gameMode" },
            { "type": "uint8", "name": "status" },
            { "type": "address", "name": "winner" },
            { "type": "uint256", "name": "createdAt" },
            { "type": "uint256", "name": "resolvedAt" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { gameMode = '1', status = '0' } = req.query
        const gameModeNum = parseInt(gameMode as string)

        const client = createPublicClient({
            chain: base,
            transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org')
        })

        // Get open room IDs from contract
        const roomIds = await client.readContract({
            address: ARENA_CONTRACT as `0x${string}`,
            abi: ARENA_ABI,
            functionName: 'getOpenRooms',
            args: [gameModeNum]
        }) as `0x${string}`[]

        // Fetch room details
        const rooms = await Promise.all(
            roomIds.map(async (roomId) => {
                try {
                    const room = await client.readContract({
                        address: ARENA_CONTRACT as `0x${string}`,
                        abi: ARENA_ABI,
                        functionName: 'rooms',
                        args: [roomId]
                    }) as any

                    return {
                        id: roomId,
                        player1: room[1],
                        player2: room[2],
                        stake: room[3].toString(),
                        tier: room[4],
                        gameMode: room[5],
                        status: room[6],
                        winner: room[7],
                        createdAt: room[8].toString(),
                        resolvedAt: room[9].toString()
                    }
                } catch (e) {
                    console.error(`Error fetching room ${roomId}:`, e)
                    return null
                }
            })
        )

        const validRooms = rooms.filter(r => r !== null && r.status === parseInt(status as string))

        return res.status(200).json({ ok: true, rooms: validRooms })

    } catch (error: any) {
        console.error('Rooms API error:', error)
        return res.status(500).json({ ok: false, error: error.message })
    }
}
