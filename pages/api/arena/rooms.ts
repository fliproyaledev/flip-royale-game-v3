// pages/api/arena/rooms.ts
// Fetch open rooms from Arena contract
// Note: Contract getOpenRooms is tier-based, so we use allRoomIds and filter by gameMode

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B"

const ARENA_ABI = [
    {
        "inputs": [],
        "name": "allRoomIds",
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
        const statusNum = parseInt(status as string)

        const client = createPublicClient({
            chain: base,
            transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org')
        })

        // Get ALL room IDs from contract
        const allRoomIds = await client.readContract({
            address: ARENA_CONTRACT as `0x${string}`,
            abi: ARENA_ABI,
            functionName: 'allRoomIds',
        }) as `0x${string}`[]

        console.log(`[Rooms API] Found ${allRoomIds.length} total rooms, filtering for gameMode=${gameModeNum}, status=${statusNum}`)

        // Fetch room details and filter
        const rooms = await Promise.all(
            allRoomIds.map(async (roomId) => {
                try {
                    const room = await client.readContract({
                        address: ARENA_CONTRACT as `0x${string}`,
                        abi: ARENA_ABI,
                        functionName: 'rooms',
                        args: [roomId]
                    }) as any

                    const roomGameMode = Number(room[5])
                    const roomStatus = Number(room[6])

                    // Filter by gameMode and status
                    if (roomGameMode !== gameModeNum || roomStatus !== statusNum) {
                        return null
                    }

                    return {
                        id: roomId,
                        player1: room[1],
                        player2: room[2],
                        stake: room[3].toString(),
                        tier: room[4],
                        gameMode: roomGameMode,
                        status: roomStatus,
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

        const validRooms = rooms.filter(r => r !== null)
        console.log(`[Rooms API] Returning ${validRooms.length} rooms matching filters`)

        return res.status(200).json({ ok: true, rooms: validRooms })

    } catch (error: any) {
        console.error('Rooms API error:', error)
        return res.status(500).json({ ok: false, error: error.message })
    }
}

