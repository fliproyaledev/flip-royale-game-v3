import type { NextApiRequest, NextApiResponse } from 'next';

const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

import { getUser, updateUser } from '../../../lib/users'

// Paket fiyatları (USD cinsinden)
const PACK_PRICES: Record<string, number> = {
  common: 5,
  rare: 15
}

// Komisyon oranı
const COMMISSION_RATE = 0.10 // %10

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
          useInventory: true,
          paymentMethod: 'CRYPTO',
          txHash: txHash
        })
      });

      const data = await oracleRes.json();

      if (!oracleRes.ok) {
        return res.status(oracleRes.status).json({ ok: false, error: data.error });
      }

      // Oracle modunda da komisyon hesapla (local user data'dan)
      await processReferralCommission(userId.toLowerCase(), packType || 'common', count || 1);

      return res.status(200).json({ ok: true, ...data });
    }

    // 3. Local fallback when ORACLE_URL not set: add pack to local user inventory
    const clean = String(userId).toLowerCase()
    let user = await getUser(clean)
    if (!user) {
      // create minimal user
      user = {
        id: clean,
        name: 'Player',
        totalPoints: 0,
        bankPoints: 0,
        giftPoints: 0,
        inventory: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: [],
        packsPurchased: 0
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

    // packsPurchased sayacını artır
    user.packsPurchased = (user.packsPurchased || 0) + qty

    user.updatedAt = new Date().toISOString()
    await updateUser(clean, user)

    // Referral komisyonu hesapla
    await processReferralCommission(clean, validatedPackType, qty);

    return res.status(200).json({ ok: true, user, newCards: [] })

  } catch (error: any) {
    console.error("Bridge Error:", error);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}

// Referral komisyonu hesapla ve referrer'a ekle
// NOT: Komisyon fiyata EK değil, DAHİL!
// Örnek: 10 VIRTUAL paket → Kullanıcı 10 öder, Referrer 1 alır, Platform 9 alır
async function processReferralCommission(userId: string, packType: string, qty: number) {
  try {
    const user = await getUser(userId);
    if (!user || !user.referredBy) return;

    const referrer = await getUser(user.referredBy);
    if (!referrer) return;

    const packPrice = PACK_PRICES[packType] || PACK_PRICES.common;
    const totalPurchase = packPrice * qty;
    const commission = totalPurchase * COMMISSION_RATE; // %10 komisyon - fiyattan kesiliyor

    // Referrer'ın komisyonunu güncelle
    referrer.pendingCommission = (referrer.pendingCommission || 0) + commission;
    referrer.totalCommissionEarned = (referrer.totalCommissionEarned || 0) + commission;
    referrer.updatedAt = new Date().toISOString();

    await updateUser(referrer.id, referrer);

    console.log(`[Referral] Commission: $${commission.toFixed(2)} credited to ${referrer.id} from ${userId}'s purchase`);
  } catch (e) {
    console.error('[Referral] Commission error:', e);
    // Komisyon hatası satın almayı engellemez
  }
}
