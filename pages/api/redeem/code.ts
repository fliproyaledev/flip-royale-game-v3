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

        // Kod kullanım limiti kontrolü (topluluk kodları için)
        if (invite.maxUses !== undefined && invite.useCount >= invite.maxUses) {
            return res.status(400).json({ success: false, error: 'This code has reached its usage limit' })
        }

        // Kullanıcı BU KODU daha önce kullandı mı? (Farklı kodları kullanabilir)
        const redeemedCodes: string[] = (user as any).redeemedWaitlistCodes || []
        if (redeemedCodes.includes(cleanCode)) {
            return res.status(400).json({ success: false, error: 'You have already used this code' })
        }

        // Kodu kullanıldı olarak işaretle
        invite.useCount = (invite.useCount || 0) + 1
        // Tek kullanımlık kodlar için usedBy ayarla
        if (invite.maxUses === undefined || invite.maxUses === 1) {
            invite.usedBy = cleanUserId
            invite.usedAt = new Date().toISOString()
        }

        // KV'ye kaydet
        await setKV(INVITES_KEY, JSON.stringify(invites))

        // Pack tipini belirle (varsayılan: common)
        const packType = invite.packType || 'common'
        const packKey = packType === 'rare' ? 'rare_pack' : 'common_pack'

        // Kullanıcıya Pack ver
        const inventory = user.inventory || {}
        inventory[packKey] = (inventory[packKey] || 0) + 1

        // Kullanılan kodları kaydet (array olarak)
        const updatedRedeemedCodes = [...redeemedCodes, cleanCode]

        await updateUser(cleanUserId, {
            inventory,
            redeemedWaitlistCodes: updatedRedeemedCodes,
            lastRedeemedAt: new Date().toISOString()
        })

        const packName = packType === 'rare' ? 'Rare Pack' : 'Common Pack'
        return res.status(200).json({
            success: true,
            message: `Code redeemed! You received 1 ${packName}!`,
            packType
        })

    } catch (error) {
        console.error('[Redeem] Error:', error)
        return res.status(500).json({ success: false, error: 'Server error' })
    }
}
