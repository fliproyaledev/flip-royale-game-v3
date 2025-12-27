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
        let packsPurchased = user.packsPurchased || 0

        // Fallback: Eğer sayaç 0 ise ama envanterde kart/paket var mı kontrol et
        if (packsPurchased === 0) {
            let hasProofOfPurchase = false

            // Check for packs
            if (user.inventory) {
                const hasCommonPack = (user.inventory.common_pack || 0) > 0 || (user.inventory.common || 0) > 0
                const hasRarePack = (user.inventory.rare_pack || 0) > 0 || (user.inventory.rare || 0) > 0

                if (hasCommonPack || hasRarePack) {
                    hasProofOfPurchase = true
                }

                // Check for any card in inventory (token IDs like 'VIRTUAL', 'AIXBT', etc.)
                // Cards are stored as tokenId: count pairs
                for (const key of Object.keys(user.inventory)) {
                    // Skip pack keys, check if any card has count > 0
                    if (!key.includes('pack') && !['common', 'rare'].includes(key)) {
                        if ((user.inventory[key] || 0) > 0) {
                            hasProofOfPurchase = true
                            break
                        }
                    }
                }
            }

            // Check for active cards or round history as proof
            if ((user as any).activeCards && (user as any).activeCards.length > 0) {
                hasProofOfPurchase = true
            }
            if (user.roundHistory && user.roundHistory.length > 0) {
                hasProofOfPurchase = true
            }
            // Check for total points > 0 (only possible if they played)
            if ((user.totalPoints || 0) > 0) {
                hasProofOfPurchase = true
            }

            if (hasProofOfPurchase) {
                // Kullanıcının geçmişte satın aldığının kanıtı var, sayacı düzelt
                packsPurchased = 1
                // Veritabanını arka planda güncelle
                updateUser(cleanUserId, { ...user, packsPurchased: 1 }).catch(console.error)
            }
        }

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
