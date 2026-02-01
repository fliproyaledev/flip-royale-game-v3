// pages/api/arena/taso/choice.ts
// Store player's front/back choice for Oracle resolution

import type { NextApiRequest, NextApiResponse } from 'next'
import { kv } from '@vercel/kv'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { wallet, roomId, txHash, choice, tier } = req.body

        if (!wallet || !choice) {
            return res.status(400).json({ ok: false, error: 'Missing required fields' })
        }

        if (choice !== 'front' && choice !== 'back') {
            return res.status(400).json({ ok: false, error: 'Choice must be "front" or "back"' })
        }

        // Store choice in KV for Oracle resolution
        const choiceData = {
            wallet: wallet.toLowerCase(),
            choice, // 'front' or 'back'
            tier,
            txHash,
            timestamp: Date.now()
        }

        // If roomId exists, this is player2 joining
        // If txHash but no roomId, this is player1 creating (will get roomId from event)
        const key = roomId
            ? `arena:choice:${roomId}:${wallet.toLowerCase()}`
            : `arena:pending:${txHash}`

        await kv.set(key, JSON.stringify(choiceData), { ex: 86400 }) // 24h expiry

        return res.status(200).json({ ok: true })

    } catch (error: any) {
        console.error('Choice API error:', error)
        return res.status(500).json({ ok: false, error: error.message })
    }
}
