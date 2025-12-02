import type { NextApiRequest, NextApiResponse } from 'next';

const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

import { getUser, updateUser } from '../../../lib/users'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Sadece POST
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, txHash, packType, count } = req.body;

    if (!userId || !txHash) {
        return res.status(400).json({ ok: false, error: 'Missing parameters' });
    }

    // 2. If Oracle is configured, forward the verification to Oracle purchase endpoint
    if (ORACLE_URL && ORACLE_SECRET) {
      const oracleRes = await fetch(`${ORACLE_URL}/api/users/purchase`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ORACLE_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId.toLowerCase(),
          packType: packType || 'common',
          count: count || 1,
          useInventory: false,
          paymentMethod: 'CRYPTO',
          txHash: txHash
        })
      });

      const data = await oracleRes.json();

      if (!oracleRes.ok) {
        return res.status(oracleRes.status).json({ ok: false, error: data.error });
      }

      return res.status(200).json({ ok: true, ...data });
    }

    // 3. Local fallback when ORACLE_URL not set: add pack to local user inventory
    const clean = String(userId).toLowerCase()
    let user = await getUser(clean)
    if (!user) {
      // create minimal user
      user = {
        id: clean,
        username: 'Player',
        name: 'Player',
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
    if (user.inventory[packKey1] !== undefined) {
      user.inventory[packKey1] = (user.inventory[packKey1] || 0) + qty
    } else {
      user.inventory[packKey2] = (user.inventory[packKey2] || 0) + qty
    }

    user.updatedAt = new Date().toISOString()
    await updateUser(clean, user)

    return res.status(200).json({ ok: true, user, newCards: [] })

  } catch (error: any) {
    console.error("Bridge Error:", error);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}
