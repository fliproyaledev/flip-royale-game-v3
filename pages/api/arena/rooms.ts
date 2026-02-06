// pages/api/arena/rooms.ts
// Fetch open rooms from Arena contract efficiently

import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { ARENA_ABI } from '../../../lib/contracts/arenaContract'

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B"

// Multiple RPC endpoints for fallback
const RPC_URLS = [
    process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://1rpc.io/base',
    'https://base.drpc.org'
]

// Helper to add delay (prevent rate limit)
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
                // console.log(`[Rooms API] RPC ${rpcUrl} attempt ${attempt + 1} failed:`, e.shortMessage || e.message)
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
        const statusNum = parseInt(status as string) // 0=Open

        // console.log(`[Rooms API] Starting - gameMode=${gameModeNum}, status=${statusNum}`)

        let targetRoomIds: string[] = []

        // OPTIMIZATION: If looking for OPEN rooms (0), use getOpenRooms contract function
        if (statusNum === 0) {
            try {
                targetRoomIds = await fetchWithRetry(async (prov) => {
                    const c = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, prov)
                    // getOpenRooms returns bytes32[]
                    return await c.getOpenRooms(gameModeNum)
                })
                // console.log(`[Rooms API] getOpenRooms found ${targetRoomIds.length} IDs`)
            } catch (err) {
                console.error('[Rooms API] getOpenRooms failed, falling back to scan', err)
                // Fallback logic could go here, but getOpenRooms should work
            }
        } else {
            // For other statuses, we might need to scan. 
            // Currently, we'll limit to empty or minimal scan to avoid heavy load?
            // Or just return empty for now as History is handled elsewhere.
            // If needed, we can implement "getRecentRooms" later.
            // For now, let's just return empty to prevent timeout on "history" scans from this endpoint.
            // The frontend "History" uses rewards.tsx (multicall), so this endpoint is mainly for Lobby (Open rooms).
            targetRoomIds = []
        }

        if (targetRoomIds.length === 0) {
            return res.status(200).json({ ok: true, rooms: [] })
        }

        // Fetch details for target IDs (Parallel Batching)
        const rooms = []
        const BATCH_SIZE = 5 // Fetch 5 at a time to respect RPC limits

        for (let i = 0; i < targetRoomIds.length; i += BATCH_SIZE) {
            const batch = targetRoomIds.slice(i, i + BATCH_SIZE)

            const batchResults = await Promise.allSettled(batch.map(async (roomId) => {
                return await fetchWithRetry(async (prov) => {
                    const c = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, prov)
                    const r = await c.rooms(roomId)
                    return { id: roomId, ...r }
                })
            }))

            for (const res of batchResults) {
                if (res.status === 'fulfilled') {
                    const room = res.value
                    // Double check filter (though getOpenRooms should be correct)
                    if (Number(room.gameMode) === gameModeNum && Number(room.status) === statusNum) {
                        rooms.push({
                            id: room.id,
                            player1: room.player1,
                            player2: room.player2,
                            stake: room.stake.toString(),
                            tier: Number(room.tier),
                            gameMode: Number(room.gameMode),
                            status: Number(room.status),
                            winner: room.winner,
                            createdAt: room.createdAt.toString(),
                            resolvedAt: room.resolvedAt.toString()
                        })
                    }
                }
            }

            if (i + BATCH_SIZE < targetRoomIds.length) await delay(100)
        }

        // Sort by newest first
        rooms.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))

        return res.status(200).json({ ok: true, rooms })

    } catch (error: any) {
        console.error('[Rooms API] Fatal error:', error)
        return res.status(500).json({ ok: false, error: error.message })
    }
}
