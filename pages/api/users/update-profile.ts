import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, updateUser } from '../../../lib/users'

// Admin wallet for bypass (optional)
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map(w => w.trim().toLowerCase())

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    }

    try {
        const { userId, username } = req.body

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ ok: false, error: 'Missing userId' })
        }
        if (!username || typeof username !== 'string') {
            return res.status(400).json({ ok: false, error: 'Missing username' })
        }

        // Validate username (alphanumeric, 3-15 chars)
        if (!/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
            return res.status(400).json({ ok: false, error: 'Username must be 3-15 characters, alphanumeric only.' })
        }

        const cleanUserId = userId.toLowerCase()

        // 1. Get current user
        const user = await getUser(cleanUserId)
        if (!user) {
            return res.status(404).json({ ok: false, error: 'User not found' })
        }

        // 2. Check if already changed (and not admin)
        const isAdmin = ADMIN_WALLETS.includes(cleanUserId)
        if (user.hasChangedUsername && !isAdmin) {
            return res.status(403).json({ ok: false, error: 'You have already changed your username once.' })
        }

        // 3. Update user
        const updates = {
            name: username, // Update display name
            username: username, // Set explicit username field
            hasChangedUsername: true // Mark as used
        }

        await updateUser(cleanUserId, updates)

        return res.status(200).json({ ok: true, username: username })

    } catch (error: any) {
        console.error('[API] Update Profile Error:', error)
        return res.status(500).json({ ok: false, error: 'Internal Server Error' })
    }
}
