// pages/api/invite/use.ts
// Invite kodunu kullan ve kullanıcı kaydı yap

import type { NextApiRequest, NextApiResponse } from 'next'
import { useInviteCode, validateInviteCode } from '../../../lib/invites'
import { getUser, updateUser } from '../../../lib/users'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { code, userId } = req.body

        if (!code) {
            return res.status(400).json({ ok: false, error: 'Invite code is required' })
        }

        if (!userId) {
            return res.status(400).json({ ok: false, error: 'User ID (wallet address) is required' })
        }

        const cleanUserId = String(userId).toLowerCase()

        // Önce kodu doğrula
        const validation = await validateInviteCode(code)
        if (!validation.valid) {
            return res.status(400).json({ ok: false, error: validation.error })
        }

        // Kullanıcı zaten kayıtlı mı kontrol et
        const existingUser = await getUser(cleanUserId)
        if (existingUser && existingUser.inviteCodeUsed) {
            return res.status(400).json({ ok: false, error: 'User already registered with an invite code' })
        }

        // Kodu kullan
        const result = await useInviteCode(code, cleanUserId)
        if (!result.success) {
            return res.status(400).json({ ok: false, error: result.error })
        }

        // Kullanıcıyı oluştur veya güncelle
        const now = new Date().toISOString()
        const invite = result.invite!

        const userData: any = existingUser ? { ...existingUser } : {
            id: cleanUserId,
            name: 'Player',
            totalPoints: 0,
            bankPoints: 0,
            giftPoints: 0,
            logs: [],
            createdAt: now,
            activeRound: [],
            nextRound: Array(5).fill(null),
            currentRound: 1,
            inventory: {},
            roundHistory: []
        }

        // Invite bilgilerini ekle
        userData.inviteCodeUsed = invite.code
        userData.inviteType = invite.type
        userData.referredBy = invite.type === 'referral' ? invite.createdBy : null
        userData.packsPurchased = userData.packsPurchased || 0
        userData.pendingCommission = userData.pendingCommission || 0
        userData.totalCommissionEarned = userData.totalCommissionEarned || 0
        userData.updatedAt = now

        // Hediye paket ver (waitlist veya admin bypass için)
        if (invite.givesFreepack) {
            userData.inventory = userData.inventory || {}
            userData.inventory.common = (userData.inventory.common || 0) + 1
            userData.logs = userData.logs || []
            userData.logs.push({
                type: 'system',
                date: now.slice(0, 10),
                note: `Welcome gift pack from invite code: ${invite.code}`
            })
        }

        await updateUser(cleanUserId, userData)

        return res.status(200).json({
            ok: true,
            user: userData,
            gaveFreePack: invite.givesFreepack,
            inviteType: invite.type
        })
    } catch (error: any) {
        console.error('Use invite error:', error)
        return res.status(500).json({ ok: false, error: 'Internal server error' })
    }
}
