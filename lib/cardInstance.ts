/**
 * Card Instance System
 * Her kart artık unique instance olarak takip edilir.
 * Durability, wrecked status, renewal gibi özellikler burada yönetilir.
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type CardType = 'sentient' | 'genesis' | 'unicorn' | 'pegasus' | 'firstborn';

export type CardStatus = 'active' | 'expired' | 'wrecked';

export interface CardInstance {
    id: string;                    // Unique card instance ID (uuid)
    tokenId: string;               // Token ID ("btc", "eth" etc.)
    cardType: CardType;            // Kart tipi
    ownerId: string;               // Wallet address (lowercase)
    acquiredAt: number;            // Unix timestamp (ms)
    remainingDays: number;         // Usage-based: Decreases when used in Active Round
    totalDays: number;             // Original duration for percentage calculation
    status: CardStatus;
    renewedCount: number;          // Times renewed with $FLIP
    wreckedAt?: number;            // Taso loss timestamp
    wreckedInMatch?: string;       // Match ID where wrecked
}

// ─────────────────────────────────────────────────────────────
// DURABILITY CONFIG
// ─────────────────────────────────────────────────────────────

export const DURABILITY_DAYS: Record<CardType, number> = {
    sentient: 5,
    genesis: 7,
    unicorn: 10,
    pegasus: 14,
    firstborn: 14,
};

export const RENEWAL_PRICES: Record<CardType, number> = {
    sentient: 15000,   // $FLIP
    genesis: 30000,
    unicorn: 50000,
    pegasus: 100000,
    firstborn: 100000,
};

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate unique card instance ID
 */
export function generateCardId(): string {
    return `card_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * CardType'ı token'ın 'about' field'ından çıkar
 */
export function parseCardType(about: string): CardType {
    const lower = (about || '').toLowerCase().trim();
    if (lower.includes('unicorn')) return 'unicorn';
    if (lower.includes('genesis')) return 'genesis';
    if (lower.includes('pegasus')) return 'pegasus';
    if (lower.includes('firstborn')) return 'firstborn';
    return 'sentient';
}

/**
 * Yeni kart instance oluştur
 */
export function createCardInstance(
    tokenId: string,
    cardType: CardType,
    ownerId: string
): CardInstance {
    const now = Date.now();
    const durationDays = DURABILITY_DAYS[cardType] || 5;

    return {
        id: generateCardId(),
        tokenId,
        cardType,
        ownerId: ownerId.toLowerCase(),
        acquiredAt: now,
        remainingDays: durationDays,
        totalDays: durationDays,
        status: 'active',
        renewedCount: 0,
    };
}

/**
 * Kalan durability hesapla (0-100)
 */
export function calculateDurability(card: CardInstance): number {
    if (card.status === 'wrecked') return 0;
    if (card.status === 'expired') return 0;

    if (card.remainingDays <= 0) return 0;

    const remaining = (card.remainingDays / card.totalDays) * 100;
    return Math.round(remaining);
}

/**
 * Kart aktif mi? (durability > 0 ve status active)
 */
export function isCardActive(card: CardInstance): boolean {
    if (card.status !== 'active') return false;
    return card.remainingDays > 0;
}

/**
 * Kartın expire olup olmadığını kontrol et ve status güncelle
 */
export function checkAndUpdateExpiry(card: CardInstance): CardInstance {
    if (card.status !== 'active') return card;

    if (card.remainingDays <= 0) {
        return { ...card, status: 'expired', remainingDays: 0 };
    }
    return card;
}

/**
 * Kartı $FLIP ile yenile
 */
export function renewCard(card: CardInstance): CardInstance {
    if (card.status === 'wrecked') {
        throw new Error('Wrecked cards cannot be renewed');
    }

    const durationDays = DURABILITY_DAYS[card.cardType] || 5;

    return {
        ...card,
        remainingDays: durationDays,
        totalDays: durationDays,
        status: 'active',
        renewedCount: card.renewedCount + 1,
    };
}

/**
 * Kartı wreck et (Taso kaybı)
 */
export function wreckCard(card: CardInstance, matchId: string): CardInstance {
    return {
        ...card,
        status: 'wrecked',
        remainingDays: 0,
        wreckedAt: Date.now(),
        wreckedInMatch: matchId,
    };
}

/**
 * Durability görsel durumu
 */
export type DurabilityVisual = 'fresh' | 'normal' | 'fading' | 'critical' | 'expired' | 'wrecked';

export function getDurabilityVisual(card: CardInstance): DurabilityVisual {
    if (card.status === 'wrecked') return 'wrecked';
    if (card.status === 'expired') return 'expired';

    const durability = calculateDurability(card);
    if (durability >= 70) return 'fresh';
    if (durability >= 40) return 'normal';
    if (durability >= 15) return 'fading';
    if (durability > 0) return 'critical';
    return 'expired';
}

/**
 * Kullanıcının oynanabilir kart sayısı
 */
export function countActiveCards(cards: CardInstance[]): number {
    return cards.filter(isCardActive).length;
}

/**
 * Günlük duel limiti hesapla
 */
export function getDailyDuelLimit(activeCardCount: number): number {
    if (activeCardCount >= 25) return 15;
    if (activeCardCount >= 15) return 10;
    if (activeCardCount >= 10) return 5;
    if (activeCardCount >= 5) return 3;
    return 0; // Minimum 5 kart gerekli
}

// ─────────────────────────────────────────────────────────────
// SET BONUS
// ─────────────────────────────────────────────────────────────

const BASE_SET_BONUS: Record<CardType, number> = {
    sentient: 0.15,   // 15%
    genesis: 0.25,    // 25%
    unicorn: 0.50,    // 50%
    pegasus: 0.75,    // 75%
    firstborn: 0.75,  // 75% (same as pegasus)
};

/**
 * Set bonus hesapla (5 kartlık round için)
 * 5/5 = full bonus, 4/5 = %65, 3/5 = %32
 */
export function calculateSetBonus(cards: CardInstance[]): { type: CardType | null; bonus: number } {
    if (cards.length !== 5) return { type: null, bonus: 0 };

    // Her tip için sayma
    const typeCounts: Record<string, number> = {};
    for (const card of cards) {
        typeCounts[card.cardType] = (typeCounts[card.cardType] || 0) + 1;
    }

    // En yüksek bonus veren tipi bul
    let bestType: CardType | null = null;
    let bestBonus = 0;

    for (const [type, count] of Object.entries(typeCounts)) {
        const baseBonus = BASE_SET_BONUS[type as CardType] || 0;
        let multiplier = 0;

        if (count === 5) multiplier = 1.0;
        else if (count === 4) multiplier = 0.65;
        else if (count === 3) multiplier = 0.32;

        const finalBonus = baseBonus * multiplier;
        if (finalBonus > bestBonus) {
            bestBonus = finalBonus;
            bestType = type as CardType;
        }
    }

    return { type: bestType, bonus: bestBonus };
}
