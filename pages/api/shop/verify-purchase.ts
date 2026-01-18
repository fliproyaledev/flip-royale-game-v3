import type { NextApiRequest, NextApiResponse } from 'next';

const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

import { getUser, updateUser } from '../../../lib/users'

// Paket fiyatları (FLIP cinsinden)
const PACK_PRICES_FLIP: Record<string, number> = {
  common: 50000,
  rare: 100000,
  unicorn: 50000,
  genesis: 50000,
  sentient: 50000
}

// Paket fiyatları (USD cinsinden - referral komisyon için)
const PACK_PRICES: Record<string, number> = {
  common: 25,
  rare: 50,
  unicorn: 25,
  genesis: 25,
  sentient: 25
}

// Valid pack types
const VALID_PACK_TYPES = ['common', 'rare', 'unicorn', 'genesis', 'sentient']

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

    const cleanUserId = String(userId).toLowerCase();
    const qty = Number(count) || 1;
    const validatedPackType = VALID_PACK_TYPES.includes(packType) ? packType : 'common';

    // Get user to check xHandle for ReplyCorp campaign tracking
    const purchaseUser = await getUser(cleanUserId);
    const xHandle = purchaseUser?.xHandle || null;
    const xUserId = purchaseUser?.xUserId || null;

    // REQUIRE X account to be linked for pack purchases (ReplyCorp campaign)
    if (!xUserId) {
      return res.status(403).json({
        ok: false,
        error: 'X account required',
        errorCode: 'X_ACCOUNT_REQUIRED',
        message: 'Please connect your X (Twitter) account before purchasing packs.'
      });
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
          userId: cleanUserId,
          packType: validatedPackType,
          count: qty,
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
      await processReferralCommission(cleanUserId, validatedPackType, qty);

      // Log purchase with X handle for ReplyCorp campaign
      await logPurchaseWithXHandle(cleanUserId, xHandle, xUserId, validatedPackType, qty, txHash);

      return res.status(200).json({ ok: true, ...data });
    }

    // 3. Local fallback when ORACLE_URL not set: add pack to local user inventory
    let user = await getUser(cleanUserId)
    if (!user) {
      // create minimal user
      user = {
        id: cleanUserId,
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
    await updateUser(cleanUserId, user)

    // Referral komisyonu hesapla
    await processReferralCommission(cleanUserId, validatedPackType, qty);

    // Log purchase with X handle for ReplyCorp campaign
    await logPurchaseWithXHandle(cleanUserId, xHandle, xUserId, validatedPackType, qty, txHash);

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

// Log purchase with X handle for ReplyCorp campaign tracking
// Stores in Redis/Upstash for later export to ReplyCorp API
async function logPurchaseWithXHandle(
  walletAddress: string,
  xHandle: string | null,
  xUserId: string | null,
  packType: string,
  quantity: number,
  txHash: string
) {
  try {
    const purchaseLog = {
      walletAddress,
      xHandle,
      xUserId,
      packType,
      quantity,
      txHash,
      timestamp: new Date().toISOString(),
      campaign: 'replycorp_2026'
    };

    // Store in Redis using KV
    const KV_REST_API_URL = process.env.KV_REST_API_URL;
    const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

    if (KV_REST_API_URL && KV_REST_API_TOKEN) {
      // Create unique log key with timestamp
      const logKey = `purchase:${Date.now()}:${walletAddress.slice(0, 8)}`;

      await fetch(`${KV_REST_API_URL}/set/${logKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(purchaseLog)
      });

      // Also maintain a list of all purchase log keys for easy retrieval
      const listKey = 'purchase_logs_list';
      await fetch(`${KV_REST_API_URL}/lpush/${listKey}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logKey)
      });

      console.log(`[ReplyCorp] Purchase logged: wallet=${walletAddress.slice(0, 10)}..., xHandle=${xHandle || 'NOT_LINKED'}, pack=${packType}x${quantity}`);
    }

    // Send to ReplyCorp API if user has X account linked
    if (xUserId) {
      await sendToReplyCorp(xUserId, walletAddress, xHandle, packType, quantity, txHash);
    }
  } catch (e) {
    console.error('[ReplyCorp] Purchase log error:', e);
    // Log hatası satın almayı engellemez
  }
}

// Send conversion to ReplyCorp API for attribution tracking
async function sendToReplyCorp(
  xUserId: string,
  walletAddress: string,
  xHandle: string | null,
  packType: string,
  quantity: number,
  txHash: string
) {
  try {
    const REPLYCORP_API_KEY = process.env.REPLYCORP_API_KEY;
    const REPLYCORP_CAMPAIGN_ID = process.env.REPLYCORP_CAMPAIGN_ID;

    if (!REPLYCORP_API_KEY || !REPLYCORP_CAMPAIGN_ID) {
      console.log('[ReplyCorp] API key or campaign ID not configured, skipping');
      return;
    }

    // Calculate FLIP amount
    const flipAmount = PACK_PRICES_FLIP[packType] ? PACK_PRICES_FLIP[packType] * quantity : 50000 * quantity;

    // Send conversion to ReplyCorp (amount in FLIP)
    const response = await fetch(
      `https://prod.api.replycorp.io/api/v1/campaigns/${REPLYCORP_CAMPAIGN_ID}/conversions`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': REPLYCORP_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          twitterId: xUserId,
          eventType: 'purchase',
          amount: flipAmount,
          walletAddress: walletAddress,
          metadata: {
            txHash: txHash,
            packType: packType,
            quantity: quantity,
            currency: 'FLIP'
          }
        })
      }
    );

    // Log the payload that was sent
    const sentPayload = {
      twitterId: xUserId,
      eventType: 'purchase',
      amount: flipAmount,
      walletAddress: walletAddress,
      metadata: { txHash, packType, quantity, currency: 'FLIP' }
    };
    console.log(`[ReplyCorp] 📤 Sent payload: ${JSON.stringify(sentPayload)}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`[ReplyCorp] ✅ Response: ${JSON.stringify(data)}`);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[ReplyCorp] ❌ API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
  } catch (e) {
    console.error('[ReplyCorp] Send error:', e);
    // ReplyCorp hatası satın almayı engellemez
  }
}
