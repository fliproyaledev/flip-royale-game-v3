// pages/api/referral/my-code.ts
// Kullanıcının referral kodunu getir veya oluştur

import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, updateUser } from '../../../lib/users'
import { createUserReferralCode, getUserReferralCode } from '../../../lib/invites'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
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

        // Kullanıcının paket satın alıp almadığını kontrol et
        const packsPurchased = user.packsPurchased || 0

        if (packsPurchased < 1) {
            return res.status(200).json({
                ok: true,
                hasReferralCode: false,
                canGenerate: false,
                message: 'You need to purchase at least 1 pack to get a referral code',
                packsPurchased
            })
        }

        // Mevcut referral kodunu kontrol et
        let referralCode = await getUserReferralCode(cleanUserId)

        // POST: Kod oluştur (eğer yoksa)
        if (req.method === 'POST' && !referralCode) {
            referralCode = await createUserReferralCode(cleanUserId)

            // User'a referral kodunu kaydet
            await updateUser(cleanUserId, {
                ...user,
                referralCode: referralCode.code
            })
        }

        if (referralCode) {
            return res.status(200).json({
                ok: true,
                hasReferralCode: true,
                code: referralCode.code,
                createdAt: referralCode.createdAt,
                useCount: referralCode.useCount,
                shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/invite?code=${referralCode.code}`
            })
        }

        return res.status(200).json({
            ok: true,
            hasReferralCode: false,
            canGenerate: true,
            message: 'You can generate a referral code',
            packsPurchased
        })

    } catch (error: any) {
        console.error('Referral code error:', error)
        return res.status(500).json({ ok: false, error: 'Internal server error' })
    }
}
