import type { NextApiRequest, NextApiResponse } from 'next';
import { getUser, updateUser } from '../../../lib/users'
import { generatePackCards } from '../../../lib/game-utils'
import { TOKENS } from '../../../lib/tokens'

// 1. Ortam Değişkenlerini Al
const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 2. Sadece POST İsteği
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Read userId from header or body
    const userId = (req.headers['x-user-id'] as string) || req.body.userId
    const packType = req.body.packType || 'common'

    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized: Missing User ID' })

    // If Oracle is configured, forward the call
    if (ORACLE_URL && ORACLE_SECRET) {
        try {
            const oracleRes = await fetch(`${ORACLE_URL}/api/users/open-pack`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ORACLE_SECRET}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: String(userId).toLowerCase(), packType })
            })

            const data = await oracleRes.json()
            if (!oracleRes.ok) {
                console.warn('Oracle Open Pack Failed:', data)
                return res.status(oracleRes.status).json({ ok: false, error: data.error || 'Failed to open pack on Oracle' })
            }
            return res.status(200).json(data)
        } catch (err: any) {
            console.error('[API] Open Pack Bridge Error:', err)
            return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' })
        }
    }

    // Local fallback: operate on local users (development)
    try {
        const cleanId = String(userId).toLowerCase()
        const user = await getUser(cleanId)
        if (!user) return res.status(404).json({ ok: false, error: 'User not found' })

        // Accept both 'common' and 'common_pack' style inventory keys for compatibility
        const packKey1 = `${packType}_pack`
        const packKey2 = `${packType}`
        const currentPacks = (user.inventory && ((user.inventory[packKey1] || 0) + (user.inventory[packKey2] || 0))) || 0
        if (currentPacks < 1) {
            return res.status(400).json({ ok: false, error: `No ${packType} packs to open` })
        }

        // Initialize inventory if needed
        user.inventory = user.inventory || {}

        // decrement one pack from whichever key exists (prefer packKey1)
        if (user.inventory[packKey1] && user.inventory[packKey1] > 0) {
            user.inventory[packKey1] -= 1
            if (user.inventory[packKey1] <= 0) delete user.inventory[packKey1]
        } else if (user.inventory[packKey2] && user.inventory[packKey2] > 0) {
            user.inventory[packKey2] -= 1
            if (user.inventory[packKey2] <= 0) delete user.inventory[packKey2]
        }

        // generate cards based on pack type
        const newCards: string[] = generatePackCards(packType, TOKENS)
        for (const tokenId of newCards) {
            user.inventory[tokenId] = (user.inventory[tokenId] || 0) + 1
        }

        await updateUser(cleanId, user)

        return res.status(200).json({ ok: true, user, newCards })
    } catch (err: any) {
        console.error('[API] Open Pack Local Error:', err)
        return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' })
    }
}
