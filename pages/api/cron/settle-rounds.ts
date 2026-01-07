import type { NextApiRequest, NextApiResponse } from "next";
import { kv } from "@vercel/kv";
import {
  getUser,
  updateUser,
  type RoundPick,
  type UserRecord,
  type RoundHistoryEntry
} from "../../../lib/users";
import { getPriceForToken } from "../../../lib/price";
import { TOKEN_MAP } from "../../../lib/tokens";
import { saveDailyRoundSummary, type DailyRoundSummary } from "../../../lib/history";

const CRON_SECRET = process.env.CRON_SECRET;
const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

// ---------------- UTILITY FUNCTIONS ----------------

function nerfFactor(dup: number): number {
  if (dup <= 1) return 1;
  if (dup === 2) return 0.75;
  if (dup === 3) return 0.5;
  if (dup === 4) return 0.25;
  return 0;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function calcPoints(
  pct: number,
  dir: "UP" | "DOWN",
  dup: number
) {
  // If percentage is not finite, return 0
  if (!Number.isFinite(pct)) return 0;

  const signed = dir === "UP" ? pct : -pct;

  let pts = signed * 100;

  const nerf = nerfFactor(dup);
  const loss = 2 - nerf;

  pts = pts >= 0 ? pts * nerf : pts * loss;

  pts = clamp(pts, -2500, 2500);

  return Math.round(pts);
}

function utcDayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ---------------- HANDLER ----------------

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  // Vercel Cron sends secret via Authorization header: "Bearer <secret>"
  // Manual calls can use ?key=<secret> query parameter
  let providedKey = req.query.key as string;

  // Check Authorization header if query param not present
  if (!providedKey) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.substring(7);
    }
  }

  if (!CRON_SECRET) return res.status(500).json({ ok: false, error: "Server Error: CRON_SECRET not set" });
  if (providedKey !== CRON_SECRET) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    console.log("🔒 [CRON] Finalizing Round & Saving Stats...");

    if (!ORACLE_URL || !ORACLE_SECRET) {
      return res.status(500).json({ ok: false, error: "Oracle not configured" });
    }

    const today = utcDayKey();

    // --- 1. GLOBAL ROUND SAYAÇ MANTIĞI ---
    // Round counter'ı sıfırdan başlat (her gün 0, 1, 2, 3...)
    const currentCounter = await kv.get("GLOBAL_ROUND_COUNTER") || 0;
    const newGlobalRound = typeof currentCounter === 'number' ? currentCounter + 1 : 1;
    await kv.set("GLOBAL_ROUND_COUNTER", newGlobalRound);
    console.log(`🌎 [CRON] Global Round Set to #${newGlobalRound}`);

    // --- 2. ORACLE'DAN TÜM KULLANICILAR ---
    const usersResponse = await fetch(`${ORACLE_URL}/api/users/all`, {
      headers: {
        'Authorization': `Bearer ${ORACLE_SECRET}`
      }
    });

    if (!usersResponse.ok) {
      throw new Error(`Failed to fetch users from Oracle: ${usersResponse.statusText}`);
    }

    const usersData = await usersResponse.json();
    const allUsers: UserRecord[] = usersData.users || [];

    console.log(`📊 [CRON] Loaded ${allUsers.length} users from Oracle`);

    const settledUsers: string[] = [];
    const errors: any[] = [];

    // İstatistik Değişkenleri
    let dailyTotalPlayers = 0;
    let dailyTotalPoints = 0;
    let dailyTopPlayer: DailyRoundSummary['topPlayer'] = null;
    const tokenPerformance: Record<string, number> = {};

    // Fiyat Snapshot
    // Fiyat Snapshot - tüm token ID'lerini topla
    const allTokenIds = new Set<string>();
    allUsers.forEach((user: UserRecord) => {
      user.activeRound?.forEach(p => p && allTokenIds.add(p.tokenId));
      user.nextRound?.forEach(p => p && allTokenIds.add(p.tokenId));
    });

    const priceMap: Record<string, { price: number; changePct: number }> = {};
    await Promise.all(
      Array.from(allTokenIds).map(async (tokenId) => {
        try {
          const data = await getPriceForToken(tokenId);
          const price = data.pLive || data.pClose || data.p0 || 0;
          const changePct = Number.isFinite(data.changePct) ? data.changePct : 0;

          if (price > 0) {
            priceMap[tokenId] = { price, changePct };
          }
        } catch (e) { }
      })
    );

    // --- 3. HER KULLANICI İÇİN İŞLE ---
    for (const user of allUsers) {
      const uid = user.id;
      if (!uid) {
        errors.push({ userId: "unknown", error: "Missing user ID" });
        continue;
      }

      if (!Array.isArray(user.activeRound)) user.activeRound = [];
      if (!Array.isArray(user.nextRound)) user.nextRound = Array(5).fill(null);
      if (!Array.isArray(user.roundHistory)) user.roundHistory = [];

      // Çifte işlem koruması
      if (user.lastSettledDay === today) {
        // Kullanıcı zaten işlendiyse bile tur numarasını global ile eşle
        user.currentRound = newGlobalRound;
        continue;
      }

      try {
        let totalPoints = 0;
        const historyItems: RoundHistoryEntry['items'] = [];
        let hasActiveRound = false;

        // A) BİTEN TURU HESAPLA
        for (const pick of user.activeRound) {
          if (!pick || !pick.tokenId) continue;
          hasActiveRound = true;

          let itemPoints = 0;
          let closingPrice = 0;
          let openingPrice = 0;

          if (pick.locked && typeof pick.pointsLocked === "number") {
            itemPoints = pick.pointsLocked;
            closingPrice = pick.pLock || 0;
            openingPrice = pick.startPrice || 0;
          } else {
            const tokenData = priceMap[pick.tokenId];
            // Uses directly the changePct from Oracle/DexScreener
            if (tokenData) {
              closingPrice = tokenData.price; // For history only
              openingPrice = pick.startPrice || 0; // For history only
              itemPoints = calcPoints(tokenData.changePct, pick.dir, pick.duplicateIndex);
            } else {
              // Fallback if no price data found
              closingPrice = 0;
              openingPrice = 0;
              itemPoints = 0;
            }
          }

          totalPoints += itemPoints;
          if (!tokenPerformance[pick.tokenId] || itemPoints > tokenPerformance[pick.tokenId]) {
            tokenPerformance[pick.tokenId] = itemPoints;
          }

          const tokenInfo = TOKEN_MAP[pick.tokenId];
          historyItems.push({
            tokenId: pick.tokenId,
            symbol: tokenInfo ? tokenInfo.symbol : pick.tokenId,
            dir: pick.dir,
            duplicateIndex: pick.duplicateIndex,
            points: itemPoints,
            startPrice: openingPrice,
            closePrice: closingPrice
          });
        }

        if (hasActiveRound) {
          dailyTotalPlayers++;
          dailyTotalPoints += totalPoints;
          if (!dailyTopPlayer || totalPoints > dailyTopPlayer.points) {
            dailyTopPlayer = {
              username: user.name || 'Unknown',
              avatar: user.avatar || '/avatars/default-avatar.png',
              points: totalPoints
            };
          }
        }

        if (totalPoints !== 0) {
          // Puanları bankaya ekle
          if (totalPoints > 0) {
            user.totalPoints = (user.totalPoints || 0) + totalPoints;
          }
          user.bankPoints = (user.bankPoints || 0) + totalPoints;
        }

        if (historyItems.length > 0) {
          // History'ye kaydederken ARTIK GLOBAL ROUND NUMARASINI (Bir önceki turu) kullanıyoruz
          const historyEntry: RoundHistoryEntry = {
            roundNumber: newGlobalRound - 1,
            date: today,
            totalPoints: totalPoints,
            items: historyItems
          };
          user.roundHistory.unshift(historyEntry);
          if (user.roundHistory.length > 50) user.roundHistory = user.roundHistory.slice(0, 50);
        }

        // B) YENİ TURU BAŞLAT
        const nextPicksRaw = (user.nextRound || []).filter(Boolean) as RoundPick[];
        const newActiveRound: RoundPick[] = [];

        // SAFETY CHECK: Only transfer if exactly 5 cards are selected
        if (nextPicksRaw.length < 5) {
          console.log(`⚠️ [CRON] User ${uid} has only ${nextPicksRaw.length}/5 cards, skipping transfer to active round`);
          // Keep nextRound intact so user can complete their selections
          // Set empty active round
          user.activeRound = [];
          user.currentRound = newGlobalRound;
          user.lastSettledDay = today;
          user.updatedAt = new Date().toISOString();

          // Still save the user with empty active round
          await fetch(`${ORACLE_URL}/api/users/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ORACLE_SECRET}` },
            body: JSON.stringify({ address: uid, userData: user })
          });
          continue;
        }

        for (const pick of nextPicksRaw) {
          const tokenData = priceMap[pick.tokenId];
          const entryPrice = tokenData?.price || 0;

          // FIX: Transfer all cards even if price is missing
          // Cards with missing prices will use 0 as fallback (neutral result)
          if (!entryPrice) {
            console.warn(`⚠️ [CRON] No price for token ${pick.tokenId} (user: ${uid}), using 0 as fallback`);
          }

          newActiveRound.push({
            ...pick,
            startPrice: entryPrice, // Use 0 as fallback if price not available
            locked: false,
            pLock: undefined,
            pointsLocked: undefined
          });
        }

        user.activeRound = newActiveRound.length > 0 ? newActiveRound : [];
        user.nextRound = Array(5).fill(null);

        // --- KULLANICIYI GLOBAL SAATE EŞİTLE ---
        user.currentRound = newGlobalRound;
        user.lastSettledDay = today;
        user.updatedAt = new Date().toISOString();

        // Oracle'a kaydet
        const updateResponse = await fetch(`${ORACLE_URL}/api/users/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ORACLE_SECRET}`
          },
          body: JSON.stringify({
            address: uid,
            userData: user
          })
        });

        if (!updateResponse.ok) {
          throw new Error(`Failed to update user ${uid}: ${updateResponse.statusText}`);
        }

        settledUsers.push(uid);
        console.log(`✅ [CRON] User ${uid} fully settled`);

      } catch (err: any) {
        console.error(`❌ [CRON] Error settling user ${uid}:`, err);
        errors.push({ uid, error: err.message });
      }
    }

    // Global İstatistik Kaydı
    let bestTokenSymbol = '-';
    let bestTokenPoints = -Infinity;
    for (const [tid, pts] of Object.entries(tokenPerformance)) {
      if (pts > bestTokenPoints) {
        bestTokenPoints = pts;
        bestTokenSymbol = TOKEN_MAP[tid]?.symbol || tid;
      }
    }
    const dailySummary: DailyRoundSummary = {
      date: today,
      totalPlayers: dailyTotalPlayers,
      totalPointsDistributed: dailyTotalPoints,
      topPlayer: dailyTopPlayer,
      bestToken: bestTokenSymbol !== '-' ? { symbol: bestTokenSymbol, changePct: 0 } : null
    };
    await saveDailyRoundSummary(dailySummary);

    return res.status(200).json({
      ok: true,
      date: today,
      newGlobalRound,
      settledCount: settledUsers.length,
      globalStats: dailySummary,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err: any) {
    console.error("CRON ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
