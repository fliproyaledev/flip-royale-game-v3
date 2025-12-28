// pages/api/referral/link.ts
// Mevcut kullanıcıya referrer bağla (henüz referrer'ı yoksa)

import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, updateUser } from '../../../lib/users'
import { getUserReferralCode } from '../../../lib/invites'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { userId, referralCode } = req.body

        if (!userId || !referralCode) {
            return res.status(400).json({ ok: false, error: 'userId and referralCode are required' })
        }

        const cleanUserId = String(userId).toLowerCase()
        const cleanCode = String(referralCode).toUpperCase().trim()

        // Kullanıcıyı al
        const user = await getUser(cleanUserId)
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' })
        }

        // Zaten referrer'ı var mı?
        if (user.referredBy) {
            return res.status(400).json({
                ok: false,
                error: 'User already has a referrer',
                currentReferrer: user.referredBy
            })
        }

        // Referral kodunu bul
        // Referral kodları "referral" tipinde olup createdBy alanında referrer'ın wallet adresini içerir
        const { getKV } = await import('../../../lib/kv')
        const invitesStore = await getKV('fliproyale:invites') || { codes: {} }

        let referrerAddress: string | null = null

        // Kod varsa ve referral tipindeyse
        const invite = invitesStore.codes[cleanCode]
        if (invite && invite.type === 'referral') {
            referrerAddress = invite.createdBy
        }

        if (!referrerAddress) {
            return res.status(400).json({ ok: false, error: 'Invalid referral code or not a referral type code' })
        }

        // Kendi kendine referral engelle
        if (referrerAddress.toLowerCase() === cleanUserId) {
            return res.status(400).json({ ok: false, error: 'Cannot refer yourself' })
        }

        // Kullanıcıyı güncelle
        user.referredBy = referrerAddress
        user.updatedAt = new Date().toISOString()
        await updateUser(cleanUserId, user)

        // Referrer'ın istatistiklerini güncelle
        const referrer = await getUser(referrerAddress)
        if (referrer) {
            referrer.totalReferrals = (referrer.totalReferrals || 0) + 1
            referrer.updatedAt = new Date().toISOString()
            await updateUser(referrerAddress, referrer)
        }

        return res.status(200).json({
            ok: true,
            message: 'Referrer linked successfully',
            referredBy: referrerAddress,
            note: 'Your next pack purchase will give 10% commission to your referrer'
        })

    } catch (error: any) {
        console.error('Link referrer error:', error)
        return res.status(500).json({ ok: false, error: 'Internal server error' })
    }
}
