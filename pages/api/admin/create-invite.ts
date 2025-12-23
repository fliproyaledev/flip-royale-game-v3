// pages/api/admin/create-invite.ts
// Admin invite kodu oluşturma

import type { NextApiRequest, NextApiResponse } from 'next'
import { createInviteCode, listInviteCodes } from '../../../lib/invites'

// Admin cüzdan adresleri - bunları env'den almak daha güvenli olur
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean)

function isAdmin(address: string): boolean {
    if (!address) return false
    // Development modunda herkes admin olabilir
    if (process.env.NODE_ENV === 'development') return true
    return ADMIN_WALLETS.includes(address.toLowerCase())
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Admin header kontrolü
    const adminWallet = (req.headers['x-admin-wallet'] as string || '').toLowerCase()

    if (!isAdmin(adminWallet) && process.env.NODE_ENV !== 'development') {
        const received = adminWallet ? `${adminWallet.substring(0, 6)}...` : 'empty';
        return res.status(403).json({ ok: false, error: `Unauthorized: Admin access required. Your wallet: ${adminWallet} (Env has ${ADMIN_WALLETS.length} admins)` })
    }

    // GET: Kodları listele
    if (req.method === 'GET') {
        try {
            const { type, unused } = req.query
            const codes = await listInviteCodes({
                type: type as any,
                unused: unused === 'true'
            })
            return res.status(200).json({ ok: true, codes })
        } catch (error: any) {
            console.error('List invites error:', error)
            return res.status(500).json({ ok: false, error: 'Internal server error' })
        }
    }

    // POST: Yeni kod oluştur
    if (req.method === 'POST') {
        try {
            const { type, customCode, givesFreepack, count } = req.body

            // Tek seferde birden fazla kod oluştur
            const createCount = Math.min(Number(count) || 1, 100)
            const createdCodes = []

            for (let i = 0; i < createCount; i++) {
                const invite = await createInviteCode({
                    type: type || 'waitlist',
                    createdBy: adminWallet || 'admin',
                    customCode: createCount === 1 ? customCode : undefined,
                    givesFreepack: givesFreepack !== false
                })
                createdCodes.push(invite)
            }

            return res.status(200).json({
                ok: true,
                codes: createdCodes,
                message: `Created ${createdCodes.length} invite code(s)`
            })
        } catch (error: any) {
            console.error('Create invite error:', error)
            return res.status(500).json({ ok: false, error: 'Internal server error' })
        }
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
