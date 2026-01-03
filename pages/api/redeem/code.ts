// pages/api/redeem/code.ts
// Waitlist kod ile Common Pack alma

import type { NextApiRequest, NextApiResponse } from 'next'
import { getKV, setKV } from '../../../lib/kv'
import { getUser, updateUser } from '../../../lib/users'

const INVITES_KEY = 'fliproyale:invites'

type RedeemResponse = {
    success: boolean
    message?: string
    error?: string
    packType?: string
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<RedeemResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }

    try {
        const { code, userId } = req.body

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ success: false, error: 'Code is required' })
        }

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ success: false, error: 'User ID is required' })
        }

        const cleanCode = code.trim().toUpperCase()
        const cleanUserId = userId.toLowerCase()

        // Kullanıcıyı kontrol et
        const user = await getUser(cleanUserId)
        if (!user) {
            return res.status(400).json({ success: false, error: 'User not found. Please connect wallet first.' })
        }

        // Invite kodlarını yükle
        const raw = await getKV(INVITES_KEY)
        if (!raw) {
            return res.status(400).json({ success: false, error: 'Invalid code' })
        }

        let invites: { codes: Record<string, any> }
        try {
            invites = JSON.parse(raw)
        } catch {
            return res.status(500).json({ success: false, error: 'System error' })
        }

        // Kodu bul
        const invite = invites.codes[cleanCode]
        if (!invite) {
            return res.status(400).json({ success: false, error: 'Invalid code' })
        }

        // Sadece waitlist kodları redeem edilebilir
        if (invite.type !== 'waitlist') {
            return res.status(400).json({ success: false, error: 'This code cannot be redeemed here' })
        }

        // Kod zaten kullanıldı mı?
        if (invite.usedBy) {
            return res.status(400).json({ success: false, error: 'Code already used' })
        }

        // Kullanıcı daha önce kod kullandı mı? (Sadece bu redeem sistemi için)
        if ((user as any).redeemedWaitlistCode) {
            return res.status(400).json({ success: false, error: 'You have already redeemed a code' })
        }

        // Kodu kullanıldı olarak işaretle
        invite.usedBy = cleanUserId
        invite.usedAt = new Date().toISOString()
        invite.useCount = (invite.useCount || 0) + 1

        // KV'ye kaydet
        await setKV(INVITES_KEY, JSON.stringify(invites))

        // Kullanıcıya Common Pack ver
        const inventory = user.inventory || {}
        inventory.common_pack = (inventory.common_pack || 0) + 1

        await updateUser(cleanUserId, {
            inventory,
            redeemedWaitlistCode: cleanCode,
            redeemedAt: new Date().toISOString()
        })

        return res.status(200).json({
            success: true,
            message: 'Code redeemed! You received 1 Common Pack!',
            packType: 'common'
        })

    } catch (error) {
        console.error('[Redeem] Error:', error)
        return res.status(500).json({ success: false, error: 'Server error' })
    }
}
