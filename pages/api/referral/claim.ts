// pages/api/referral/claim.ts
// Komisyon claim API - bekleyen komisyonu claim et

import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, updateUser } from '../../../lib/users'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId

        if (!userId) {
            return res.status(400).json({ ok: false, error: 'User ID required' })
        }

        const cleanUserId = userId.toLowerCase()
        const user = await getUser(cleanUserId)

        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' })
        }

        const pendingCommission = user.pendingCommission || 0

        if (pendingCommission <= 0) {
            return res.status(400).json({
                ok: false,
                error: 'No pending commission to claim'
            })
        }

        // Minimum claim miktarı kontrolü (opsiyonel)
        const MIN_CLAIM_AMOUNT = 1 // $1 minimum
        if (pendingCommission < MIN_CLAIM_AMOUNT) {
            return res.status(400).json({
                ok: false,
                error: `Minimum claim amount is $${MIN_CLAIM_AMOUNT}`,
                pending: pendingCommission
            })
        }

        // Claim işlemi - şimdilik manuel olarak işlenecek
        // Gerçek uygulamada burası blockchain transfer veya ödeme sistemi entegrasyonu olabilir

        const claimRecord = {
            userId: cleanUserId,
            amount: pendingCommission,
            status: 'pending_review', // Admin onayı bekliyor
            requestedAt: new Date().toISOString(),
            processedAt: null,
            txHash: null
        }

        // Claim log'a ekle
        const claimLogs = user.claimLogs || []
        claimLogs.push(claimRecord)

        // Pending'i sıfırla, claimed'e ekle
        await updateUser(cleanUserId, {
            ...user,
            pendingCommission: 0,
            claimedCommission: (user.claimedCommission || 0) + pendingCommission,
            claimLogs,
            updatedAt: new Date().toISOString()
        })

        console.log(`[Referral] Claim request: $${pendingCommission.toFixed(2)} by ${cleanUserId}`)

        return res.status(200).json({
            ok: true,
            claimed: pendingCommission,
            message: 'Claim request submitted. Will be processed within 24-48 hours.',
            status: 'pending_review'
        })

    } catch (error: any) {
        console.error('Claim error:', error)
        return res.status(500).json({ ok: false, error: 'Internal server error' })
    }
}
