// pages/api/auth/link-x.ts
// X hesabını wallet user'a bağlayan API

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './[...nextauth]'
import { getUser, updateUser } from '../../../lib/users'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }

    try {
        const { walletAddress } = req.body

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' })
        }

        // NextAuth session'dan X bilgilerini al
        const session = await getServerSession(req, res, authOptions)

        if (!session?.user) {
            return res.status(401).json({ success: false, error: 'X authentication required' })
        }

        const xHandle = (session.user as any).xHandle
        const xUserId = (session.user as any).xUserId
        const xName = (session.user as any).xName
        const xImage = (session.user as any).xImage

        if (!xHandle) {
            return res.status(400).json({ success: false, error: 'X handle not found in session' })
        }

        // Kullanıcıyı bul
        const user = await getUser(walletAddress.toLowerCase())
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
        }

        // X bilgilerini kullanıcıya ekle
        await updateUser(walletAddress.toLowerCase(), {
            xHandle,
            xUserId,
            xName,
            xImage,
            xLinkedAt: new Date().toISOString()
        })

        return res.status(200).json({
            success: true,
            message: `X account @${xHandle} linked successfully!`,
            xHandle,
            xUserId
        })

    } catch (error: any) {
        console.error('[Link X] Error:', error)
        return res.status(500).json({ success: false, error: 'Server error' })
    }
}
