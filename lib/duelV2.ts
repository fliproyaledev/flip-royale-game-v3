/**
 * Flip Duel V2 - FDV Based PvP
 * Kartların FDV değerlerinin toplamına göre kazanan belirlenir
 */

import { kv } from '@vercel/kv';
import { CardInstance, isCardActive, countActiveCards, getDailyDuelLimit } from './cardInstance';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type DuelTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface DuelEntry {
    stake: number;      // $FLIP stake amount
    pot: number;        // Total pot (stake * 2)
    winnerPayout: number;
    houseFee: number;
}

export const DUEL_TIERS: Record<DuelTier, DuelEntry> = {
    bronze: { stake: 10000, pot: 20000, winnerPayout: 18000, houseFee: 2000 },
    silver: { stake: 50000, pot: 100000, winnerPayout: 90000, houseFee: 10000 },
    gold: { stake: 100000, pot: 200000, winnerPayout: 180000, houseFee: 20000 },
    diamond: { stake: 500000, pot: 1000000, winnerPayout: 900000, houseFee: 100000 },
};

export interface DuelCard {
    cardId: string;     // CardInstance ID
    tokenId: string;    // Token ID
    symbol: string;
    name: string;
    logo: string;
    cardType: string;
    fdv: number;        // Fully Diluted Valuation
}

export interface DuelPlayer {
    wallet: string;
    cards: DuelCard[];
    totalFdv: number;
}

export type DuelStatus = 'open' | 'matched' | 'resolved' | 'cancelled';

export interface FlipDuel {
    id: string;
    tier: DuelTier;
    status: DuelStatus;
    createdAt: number;
    matchedAt?: number;
    resolvedAt?: number;

    player1: DuelPlayer;
    player2?: DuelPlayer;

    winner?: string;      // wallet address

    stake: number;
    pot: number;
    winnerPayout: number;
    houseFee: number;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

export const CARDS_PER_DUEL = 3;
const DUEL_PREFIX = 'duel_v2:';
const OPEN_DUELS_KEY = 'duels_v2:open';
const USER_DUELS_PREFIX = 'user_duels:';

// ─────────────────────────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────────────────────────

export function generateDuelId(): string {
    return `duel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────
// FDV FETCHING
// ─────────────────────────────────────────────────────────────

export async function getTokenFDV(dexscreenerPair?: string): Promise<number> {
    if (!dexscreenerPair) return 0;

    try {
        const res = await fetch(
            `https://api.dexscreener.com/latest/dex/pairs/base/${dexscreenerPair}`,
            { next: { revalidate: 60 } } // Cache for 1 minute
        );

        if (!res.ok) return 0;

        const data = await res.json();
        return data.pair?.fdv || 0;
    } catch (error) {
        console.error('Failed to fetch FDV:', error);
        return 0;
    }
}

// ─────────────────────────────────────────────────────────────
// CARD SELECTION
// ─────────────────────────────────────────────────────────────

/**
 * Rastgele N aktif kart seç (Fisher-Yates)
 */
export function selectRandomCards(cards: CardInstance[], count: number): CardInstance[] {
    const activeCards = cards.filter(isCardActive);

    if (activeCards.length < count) {
        throw new Error(`Not enough active cards. Need ${count}, have ${activeCards.length}`);
    }

    // Fisher-Yates shuffle
    const shuffled = [...activeCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
}

// ─────────────────────────────────────────────────────────────
// DAILY LIMIT CHECK
// ─────────────────────────────────────────────────────────────

export async function checkDailyLimit(wallet: string, activeCardCount: number): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${USER_DUELS_PREFIX}${wallet}:${today}`;

    const usedToday = await kv.get<number>(key) || 0;
    const limit = getDailyDuelLimit(activeCardCount);
    const remaining = Math.max(0, limit - usedToday);

    return {
        allowed: remaining > 0,
        remaining,
        limit,
    };
}

export async function incrementDailyUsage(wallet: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `${USER_DUELS_PREFIX}${wallet}:${today}`;

    await kv.incr(key);
    await kv.expire(key, 86400 * 2); // Expire after 2 days
}

// ─────────────────────────────────────────────────────────────
// DUEL OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Yeni duel odası oluştur
 */
export async function createFlipDuel(
    wallet: string,
    tier: DuelTier,
    selectedCards: DuelCard[]
): Promise<FlipDuel> {
    const tierConfig = DUEL_TIERS[tier];
    const id = generateDuelId();

    const totalFdv = selectedCards.reduce((sum, c) => sum + c.fdv, 0);

    const duel: FlipDuel = {
        id,
        tier,
        status: 'open',
        createdAt: Date.now(),

        player1: {
            wallet: wallet.toLowerCase(),
            cards: selectedCards,
            totalFdv,
        },

        stake: tierConfig.stake,
        pot: tierConfig.pot,
        winnerPayout: tierConfig.winnerPayout,
        houseFee: tierConfig.houseFee,
    };

    // Store duel
    await kv.set(`${DUEL_PREFIX}${id}`, duel);
    await kv.sadd(OPEN_DUELS_KEY, id);

    return duel;
}

/**
 * Açık duel'e katıl
 */
export async function joinFlipDuel(
    duelId: string,
    wallet: string,
    selectedCards: DuelCard[]
): Promise<FlipDuel | null> {
    const duel = await kv.get<FlipDuel>(`${DUEL_PREFIX}${duelId}`);

    if (!duel || duel.status !== 'open') {
        return null;
    }

    if (duel.player1.wallet === wallet.toLowerCase()) {
        throw new Error('Cannot join your own duel');
    }

    const totalFdv = selectedCards.reduce((sum, c) => sum + c.fdv, 0);

    duel.player2 = {
        wallet: wallet.toLowerCase(),
        cards: selectedCards,
        totalFdv,
    };
    duel.status = 'matched';
    duel.matchedAt = Date.now();

    // Update duel
    await kv.set(`${DUEL_PREFIX}${duelId}`, duel);
    await kv.srem(OPEN_DUELS_KEY, duelId);

    return duel;
}

/**
 * Duel sonuçlandır
 */
export async function resolveFlipDuel(duelId: string): Promise<FlipDuel | null> {
    const duel = await kv.get<FlipDuel>(`${DUEL_PREFIX}${duelId}`);

    if (!duel || duel.status !== 'matched' || !duel.player2) {
        return null;
    }

    // Kazananı belirle (yüksek FDV)
    if (duel.player1.totalFdv > duel.player2.totalFdv) {
        duel.winner = duel.player1.wallet;
    } else if (duel.player2.totalFdv > duel.player1.totalFdv) {
        duel.winner = duel.player2.wallet;
    } else {
        // Beraberlik - random seç
        duel.winner = Math.random() > 0.5 ? duel.player1.wallet : duel.player2.wallet;
    }

    duel.status = 'resolved';
    duel.resolvedAt = Date.now();

    // Increment daily usage for both players
    await incrementDailyUsage(duel.player1.wallet);
    await incrementDailyUsage(duel.player2.wallet);

    // Update duel
    await kv.set(`${DUEL_PREFIX}${duelId}`, duel);

    return duel;
}

/**
 * Açık duel'leri listele
 */
export async function listOpenDuels(tier?: DuelTier): Promise<FlipDuel[]> {
    const duelIds = await kv.smembers(OPEN_DUELS_KEY);
    const duels: FlipDuel[] = [];

    for (const id of duelIds) {
        const duel = await kv.get<FlipDuel>(`${DUEL_PREFIX}${id}`);
        if (duel && duel.status === 'open') {
            if (!tier || duel.tier === tier) {
                duels.push(duel);
            }
        }
    }

    // En yeniler önce
    return duels.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Duel detayı getir (replay için)
 */
export async function getFlipDuel(duelId: string): Promise<FlipDuel | null> {
    return await kv.get<FlipDuel>(`${DUEL_PREFIX}${duelId}`);
}

/**
 * Kullanıcının duel geçmişi
 */
export async function getUserDuels(wallet: string, limit = 20): Promise<FlipDuel[]> {
    // Bu basit implementasyon için tüm duelleri tarayıp filtreliyoruz
    // Production'da ayrı bir index kullanılmalı
    const allDuelKeys = await kv.keys(`${DUEL_PREFIX}*`);
    const duels: FlipDuel[] = [];

    for (const key of allDuelKeys.slice(0, 100)) {
        const duel = await kv.get<FlipDuel>(key);
        if (duel && (duel.player1.wallet === wallet || duel.player2?.wallet === wallet)) {
            duels.push(duel);
        }
    }

    return duels
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
}

/**
 * Duel iptal et (sadece open durumda ve sadece oluşturan)
 */
export async function cancelFlipDuel(duelId: string, wallet: string): Promise<boolean> {
    const duel = await kv.get<FlipDuel>(`${DUEL_PREFIX}${duelId}`);

    if (!duel || duel.status !== 'open') {
        return false;
    }

    if (duel.player1.wallet !== wallet.toLowerCase()) {
        return false;
    }

    duel.status = 'cancelled';
    await kv.set(`${DUEL_PREFIX}${duelId}`, duel);
    await kv.srem(OPEN_DUELS_KEY, duelId);

    return true;
}
