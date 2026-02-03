// pages/api/arena/rooms.ts
// Fetch open rooms from Arena contract with retry logic

import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B"

// Multiple RPC endpoints for fallback
const RPC_URLS = [
    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://1rpc.io/base',
    'https://base.drpc.org'
]

const ARENA_ABI = [
    "function allRoomIds(uint256 index) view returns (bytes32)",
    "function rooms(bytes32 roomId) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)"
]

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry helper with multiple RPCs
async function fetchWithRetry<T>(
    fn: (provider: ethers.JsonRpcProvider) => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let lastError: any

    for (const rpcUrl of RPC_URLS) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const provider = new ethers.JsonRpcProvider(rpcUrl)
                return await fn(provider)
            } catch (e: any) {
                lastError = e
                console.log(`[Rooms API] RPC ${rpcUrl} attempt ${attempt + 1} failed:`, e.shortMessage || e.message)
                await delay(500 * (attempt + 1)) // Exponential backoff
            }
        }
    }

    throw lastError
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { gameMode = '1', status = '0' } = req.query
        const gameModeNum = parseInt(gameMode as string)
        const statusNum = parseInt(status as string)

        console.log(`[Rooms API] Starting - gameMode=${gameModeNum}, status=${statusNum}`)

        // Fetch all room IDs first
        const allRoomIds: string[] = []
        const MAX_ROOMS = 100

        for (let i = 0; i < MAX_ROOMS; i++) {
            try {
                // Use retry logic to fetch ID. If index is out of bounds, ALL providers will fail, throw, and we break.
                const roomId = await fetchWithRetry(async (prov) => {
                    const c = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, prov)
                    return await c.allRoomIds(i)
                })

                console.log(`[Rooms API] Room [${i}]: ${roomId}`)
                allRoomIds.push(roomId)
                await delay(100) // Small delay between calls
            } catch (e: any) {
                // If fetchWithRetry throws, it means ALL RPCs failed. 
                // This likely means we hit the end of the array (revert).
                console.log(`[Rooms API] Finished at index ${i} (or error), total rooms: ${allRoomIds.length}`)
                break
            }
        }

        if (allRoomIds.length === 0) {
            console.log('[Rooms API] No rooms found')
            return res.status(200).json({ ok: true, rooms: [] })
        }

        // Fetch room details with retry and delay
        const rooms = []
        for (const roomId of allRoomIds) {
            try {
                // Fetch details with retry
                const room = await fetchWithRetry(async (prov) => {
                    const c = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, prov)
                    return c.rooms(roomId)
                })

                const roomGameMode = Number(room.gameMode)
                const roomStatus = Number(room.status)

                console.log(`[Rooms API] Room ${roomId.slice(0, 10)}... mode=${roomGameMode}, status=${roomStatus}`)

                // Filter
                if (roomGameMode === gameModeNum && roomStatus === statusNum) {
                    rooms.push({
                        id: roomId,
                        player1: room.player1,
                        player2: room.player2,
                        stake: room.stake.toString(),
                        tier: Number(room.tier),
                        gameMode: roomGameMode,
                        status: roomStatus,
                        winner: room.winner,
                        createdAt: room.createdAt.toString(),
                        resolvedAt: room.resolvedAt.toString()
                    })
                }

                await delay(150) // Delay between room fetches
            } catch (e: any) {
                console.error(`[Rooms API] Error fetching room ${roomId}:`, e.shortMessage || e.message)
            }
        }

        console.log(`[Rooms API] Returning ${rooms.length} rooms`)
        return res.status(200).json({ ok: true, rooms })

    } catch (error: any) {
        console.error('[Rooms API] Fatal error:', error)
        return res.status(500).json({ ok: false, error: error.message })
    }
}
