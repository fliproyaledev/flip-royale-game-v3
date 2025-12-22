// pages/api/referral/stats.ts
// Kullanıcının referral istatistiklerini getir

import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser } from '../../../lib/users'
import { getUserReferralCode } from '../../../lib/invites'
import { getKV } from '../../../lib/kv'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const userId = (req.headers['x-user-id'] as string) || req.query.userId as string

        if (!userId) {
            return res.status(400).json({ ok: false, error: 'User ID required' })
        }

        const cleanUserId = userId.toLowerCase()
        const user = await getUser(cleanUserId)

        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' })
        }

        // Kullanıcının referral kodunu al
        const referralCode = await getUserReferralCode(cleanUserId)

        if (!referralCode) {
            return res.status(200).json({
                ok: true,
                hasReferralCode: false,
                stats: null
            })
        }

        // Referral istatistiklerini al
        const referralStatsKey = `fliproyale:referral_stats:${cleanUserId}`
        const statsRaw = await getKV(referralStatsKey)
        const stats = statsRaw ? JSON.parse(statsRaw) : {
            totalReferrals: 0,
            totalCommissionEarned: 0,
            pendingCommission: 0,
            referrals: []
        }

        // Invite kodundan use count'u da ekle
        stats.totalReferrals = referralCode.useCount

        return res.status(200).json({
            ok: true,
            hasReferralCode: true,
            code: referralCode.code,
            stats: {
                totalReferrals: stats.totalReferrals,
                totalCommissionEarned: user.totalCommissionEarned || 0,
                pendingCommission: user.pendingCommission || 0,
                referrals: stats.referrals || []
            }
        })

    } catch (error: any) {
        console.error('Referral stats error:', error)
        return res.status(500).json({ ok: false, error: 'Internal server error' })
    }
}
