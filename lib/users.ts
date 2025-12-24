// lib/users.ts

// 1. ORACLE KÖPRÜ AYARLARI
const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

// ─────────────────────────────────────────────────────────────
// TYPES (Diğer dosyaların ihtiyaç duyduğu tipler)
// ─────────────────────────────────────────────────────────────

export type LogEntry = {
  date: string
  type: 'daily' | 'duel' | 'system'
  dailyDelta?: number
  bonusGranted?: number
  note?: string
}

export type RoundPick = {
  tokenId: string
  dir: 'UP' | 'DOWN'
  duplicateIndex: number
  locked: boolean
  pLock?: number
  pointsLocked?: number
  startPrice?: number
}

export type RoundHistoryEntry = {
  roundNumber: number
  date: string
  totalPoints: number
  items: {
    tokenId: string
    symbol: string
    dir: 'UP' | 'DOWN'
    duplicateIndex: number
    points: number
    startPrice?: number
    closePrice?: number
  }[]
}

export type UserRecord = {
  id: string
  name?: string
  avatar?: string
  walletAddress?: string
  totalPoints: number
  bankPoints: number
  giftPoints: number
  logs: LogEntry[]
  createdAt?: string
  updatedAt: string
  activeRound?: RoundPick[]
  nextRound?: (RoundPick | null)[]
  currentRound?: number
  lastSettledDay?: string
  inventory?: Record<string, number>
  lastDailyPack?: string
  roundHistory?: RoundHistoryEntry[]
  // Invite & Referral system fields
  inviteCodeUsed?: string           // Hangi kod ile girdi
  username?: string                 // Custom username (display name)
  hasChangedUsername?: boolean      // 1 kerelik isim değiştirme hakkını kullandı mı?
  inviteType?: 'waitlist' | 'referral' | 'admin_bypass'
  referredBy?: string | null        // Referans veren user ID
  referralCode?: string | null      // Kendi referans kodu (1 paket sonra)
  packsPurchased?: number           // Toplam satın alınan paket sayısı
  pendingCommission?: number        // Çekilmemiş komisyon
  totalCommissionEarned?: number    // Toplam kazanılan komisyon
  claimedCommission?: number        // Toplam claim edilmiş komisyon
  claimLogs?: {                     // Claim geçmişi
    amount: number
    status: string
    requestedAt: string
    processedAt: string | null
    txHash: string | null
  }[]
}

// ─────────────────────────────────────────────────────────────
// NEW ORACLE BRIDGE FUNCTIONS (Yeni Sistem)
// ─────────────────────────────────────────────────────────────

// 1. KULLANICIYI GETİR (Oracle'dan)
export async function getUser(address: string): Promise<UserRecord | null> {
  // ... (keep existing body) ...
  const clean = String(address).toLowerCase()

  // If ORACLE_URL is configured, proxy to Oracle
  if (ORACLE_URL) {
    try {
      const res = await fetch(`${ORACLE_URL}/api/users/get?address=${clean}`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        console.error('Oracle Connection Error:', await res.text())
        return null
      }

      const data = await res.json()
      return data.user as UserRecord
    } catch (e) {
      console.error('Oracle Get User Error:', e)
      return null
    }
  }

  // Local fallback for development (no Oracle configured)
  // Skip local fallback in production (Vercel has read-only filesystem)
  if (process.env.NODE_ENV === 'production') {
    console.error('Oracle not configured in production')
    return null
  }

  try {
    const fs = await import('fs')
    const path = require('path')
    const file = path.join(process.cwd(), 'data', 'local-users.json')
    if (!fs.existsSync(file)) return null
    const raw = fs.readFileSync(file, 'utf-8')
    if (!raw) return null
    const map = JSON.parse(raw || '{}') as Record<string, UserRecord>
    return (map[clean] || null) as UserRecord
  } catch (e) {
    console.warn('Local getUser fallback failed:', e)
    return null
  }
}

// 1.5. TÜM KULLANICILARI GETİR (Oracle'dan)
export async function getAllUsers(): Promise<Record<string, UserRecord>> {
  // Oracle Mode
  if (ORACLE_URL) {
    try {
      const res = await fetch(`${ORACLE_URL}/api/users/all`, {
        headers: {
          'Authorization': `Bearer ${ORACLE_SECRET}`
        }
      });

      if (!res.ok) {
        console.error('Oracle GetAllUsers Failed:', await res.text());
        return {};
      }

      const data = await res.json();
      const usersArray: UserRecord[] = data.users || [];

      // Convert Array to Record map
      const map: Record<string, UserRecord> = {};
      usersArray.forEach(u => {
        if (u.id) map[u.id.toLowerCase()] = u;
      });
      return map;
    } catch (e) {
      console.error('Oracle getAllUsers error:', e);
      return {};
    }
  }

  // Local Fallback
  try {
    const fs = await import('fs')
    const path = require('path')
    const file = path.join(process.cwd(), 'data', 'local-users.json')
    if (!fs.existsSync(file)) return {}
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '{}') as Record<string, UserRecord>
  } catch (e) {
    return {}
  }
}

// 2. KULLANICIYI GÜNCELLE (Oracle'a Kaydet)
export async function updateUser(address: string, updates: any) {
  const clean = String(address).toLowerCase()

  if (ORACLE_URL) {
    const res = await fetch(`${ORACLE_URL}/api/users/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORACLE_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: clean,
        userData: updates
      })
    })

    if (!res.ok) {
      throw new Error('Failed to update user on Oracle')
    }

    return await res.json()
  }

  // Local fallback for development: persist in data/local-users.json
  // Skip local fallback in production (Vercel has read-only filesystem)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Oracle not configured in production. Cannot use local fallback.')
  }

  try {
    const fs = await import('fs')
    const path = require('path')
    const file = path.join(process.cwd(), 'data', 'local-users.json')

    let map: Record<string, UserRecord> = {}
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8')
      if (raw) map = JSON.parse(raw)
    } else {
      // ensure data directory exists
      const dir = path.join(process.cwd(), 'data')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir)
    }

    const now = new Date().toISOString()
    const existing = map[clean] || {}
    const updatedUser = {
      ...existing,
      ...updates,
      id: clean,
      updatedAt: now
    }

    map[clean] = updatedUser as UserRecord
    fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf-8')

    return { success: true, user: updatedUser }
  } catch (e) {
    console.error('Local updateUser failed:', e)
    throw e
  }
}

// ─────────────────────────────────────────────────────────────
// LEGACY HELPER FUNCTIONS (Eski dosyaların hata vermemesi için)
// ─────────────────────────────────────────────────────────────

// ⚠️ UYARI: Bu fonksiyon eski 'loadUsers' yerine geçer ama artık boş döner.
export async function loadUsers(): Promise<Record<string, UserRecord>> {
  console.warn("⚠️ loadUsers() called in Oracle mode. This function is deprecated.");
  return {};
}

export async function saveUsers(map: Record<string, UserRecord>): Promise<void> {
  console.warn("⚠️ saveUsers() called in Oracle mode. Use updateUser() instead.");
}

// Helper: Kullanıcı nesnesi oluşturma mantığı
export function getOrCreateUser(map: Record<string, UserRecord>, userId: string): UserRecord {
  if (!userId) throw new Error("Invalid User ID");

  let user = map[userId];
  if (!user) {
    const now = new Date().toISOString();
    user = {
      id: userId,
      totalPoints: 0,
      bankPoints: 0,
      giftPoints: 0,
      logs: [{ type: 'system', date: now.slice(0, 10), bonusGranted: 0, note: 'new-user' }],
      createdAt: now,
      updatedAt: now,
      activeRound: [],
      nextRound: Array(5).fill(null),
      currentRound: 1,
      inventory: { common: 1 },
      roundHistory: []
    } as UserRecord;
    map[userId] = user;
  }
  return user;
}

// ─────────────────────────────────────────────────────────────
// MISSING HELPERS (Duels.ts için gerekli olanlar)
// ─────────────────────────────────────────────────────────────

export function creditBank(user: UserRecord, amount: number, note?: string, dateIso?: string) {
  if (!Number.isFinite(amount)) return;
  user.bankPoints += amount;
  user.updatedAt = new Date().toISOString();
}

export function creditGamePoints(user: UserRecord, amount: number, note?: string, dateIso?: string) {
  if (!Number.isFinite(amount)) return;
  if (amount > 0) user.totalPoints += amount;
  user.bankPoints += amount;
  user.updatedAt = new Date().toISOString();
}

export function debitBank(user: UserRecord, amount: number, note?: string, dateIso?: string) {
  if (!Number.isFinite(amount)) return;
  let useGift = Math.min(amount, user.giftPoints);
  user.giftPoints -= useGift;
  amount -= useGift;
  if (amount > 0) {
    user.bankPoints = Math.max(0, user.bankPoints - amount);
  }
  user.updatedAt = new Date().toISOString();
}

export function applyDailyDelta(user: UserRecord, dateIso: string, delta: number, note?: string) {
  if (delta > 0) {
    user.totalPoints += delta;
    user.bankPoints += delta;
  }
  user.updatedAt = new Date().toISOString();
}

export function grantDailyBonus(user: UserRecord, dateIso: string, bonus: number, note?: string) {
  if (bonus > 0) {
    user.totalPoints += bonus
    user.bankPoints += bonus
    user.updatedAt = new Date().toISOString()
  }
}
