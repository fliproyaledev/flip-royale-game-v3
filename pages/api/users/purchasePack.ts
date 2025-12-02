import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, updateUser } from '../../../lib/users'

// .env dosyasındaki Oracle adresini ve şifresini alıyoruz
const ORACLE_URL = process.env.ORACLE_URL
const ORACLE_SECRET = process.env.ORACLE_SECRET

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Method Kontrolü (Sadece POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  // Read userId from header or body
  const userId = (req.headers['x-user-id'] as string) || req.body.userId
  const { packType, count, useInventory } = req.body

  if (!userId) {
    return res.status(400).json({ ok: false, error: 'Unauthorized: Missing User ID' })
  }

  // If Oracle configured, proxy to Oracle
  if (ORACLE_URL && ORACLE_SECRET) {
    try {
      const oracleRes = await fetch(`${ORACLE_URL}/api/users/purchase`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ORACLE_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: String(userId).toLowerCase(), packType, count, useInventory })
      })

      const data = await oracleRes.json()
      if (!oracleRes.ok) {
        console.error('Oracle Purchase Error:', data)
        return res.status(oracleRes.status).json({ ok: false, error: data.error || 'Purchase failed on Oracle' })
      }
      return res.status(200).json(data)
    } catch (error: any) {
      console.error('Purchase Bridge Error:', error)
      return res.status(500).json({ ok: false, error: 'Internal Server Error' })
    }
  }

  // Local fallback: add pack(s) to user's inventory
  try {
    const clean = String(userId).toLowerCase()
    let user: any = await getUser(clean)
    if (!user) {
      // create user skeleton
      user = {
        id: clean,
        username: 'Player',
        totalPoints: 0,
        bankPoints: 0,
        giftPoints: 0,
        inventory: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: []
      }
    }

    const qty = Number(count) || 1
    const validatedPackType = packType === 'rare' ? 'rare' : 'common'
    const packKey1 = `${validatedPackType}_pack`
    const packKey2 = `${validatedPackType}`

    user.inventory = user.inventory || {}
    // Prefer adding to packKey1 (_pack) but if codebase uses packKey2, keep compatibility
    if (user.inventory[packKey1] !== undefined) {
      user.inventory[packKey1] = (user.inventory[packKey1] || 0) + qty
    } else {
      user.inventory[packKey2] = (user.inventory[packKey2] || 0) + qty
    }
    user.updatedAt = new Date().toISOString()

    await updateUser(clean, user)

    return res.status(200).json({ ok: true, user, newCards: [] })
  } catch (error: any) {
    console.error('Local purchasePack error:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
