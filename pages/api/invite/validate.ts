// pages/api/invite/validate.ts
// Invite kodunu doğrula

import type { NextApiRequest, NextApiResponse } from 'next'
import { validateInviteCode } from '../../../lib/invites'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { code } = req.body

        if (!code) {
            return res.status(400).json({ ok: false, error: 'Invite code is required' })
        }

        const result = await validateInviteCode(code)

        if (!result.valid) {
            return res.status(400).json({ ok: false, error: result.error })
        }

        return res.status(200).json({
            ok: true,
            valid: true,
            type: result.invite?.type,
            givesFreepack: result.invite?.givesFreepack
        })
    } catch (error: any) {
        console.error('Validate invite error:', error)
        return res.status(500).json({ ok: false, error: 'Internal server error' })
    }
}
