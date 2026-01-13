/**
 * Flip Duel - Yardımcı Fonksiyonlar
 * Puan hesaplama, rastgele kart seçimi, düello mantığı
 */

import { kv } from '@vercel/kv';

// =====================
// TİPLER
// =====================

export interface DuelCard {
    tokenId: string;      // Kart ID (örn: "btc", "eth")
    symbol: string;       // Token sembolü
    name: string;         // Token adı
    logo: string;         // Logo URL
    about: string;        // Kart tipi (Unicorn, Genesis, Rare, Common)
    priceChange24h?: number; // 24s % değişim
    score?: number;       // Hesaplanan puan
}

export interface DuelPlayer {
    odaSahibi: boolean;   // Odayı o mu oluşturdu?
    odaSahibiAdresi: boolean;
    odaGirisUcreti: boolean;
    odaBaslangicZamani: boolean;
    wallet: string;       // Cüzdan adresi
    selectedCards: DuelCard[]; // Seçilen 3 kart
    totalScore: number;   // Toplam puan
}

export interface Duel {
    id: string;           // Benzersiz düello ID
    createdAt: number;    // Oluşturulma zamanı (timestamp)
    entryFee: number;     // Giriş ücreti (FLIP)
    status: 'open' | 'active' | 'resolved'; // Durum
    player1: DuelPlayer | null;
    player2: DuelPlayer | null;
    winner: string | null; // Kazanan cüzdan adresi
    resolvedAt?: number;  // Sonuçlanma zamanı
}

// =====================
// PUANLAMA
// =====================

/**
 * Fiyat değişimini puana çevirir
 * %1 = 100 puan (Flip Royale ile aynı)
 */
export function calculateScore(priceChangePercent: number): number {
    return Math.round(priceChangePercent * 100);
}

/**
 * Kart tipine göre bonus puanı hesapla
 * Unicorn: %10 bonus, Genesis: %5 bonus, Rare: %2 bonus
 */
export function getRarityBonus(cardType: string): number {
    const bonuses: Record<string, number> = {
        'unicorn': 0.10,    // %10 bonus
        'genesis': 0.05,    // %5 bonus
        'rare': 0.02,       // %2 bonus
        'common': 0,        // Bonus yok
        'sentient': 0,      // Bonus yok
        'pegasus': 0,       // Bonus yok
    };
    return bonuses[cardType?.toLowerCase()] || 0;
}

/**
 * Toplam takım puanını hesapla (3 kartın toplamı + bonuslar)
 */
export function calculateTeamScore(cards: DuelCard[]): number {
    let totalScore = 0;

    for (const card of cards) {
        if (card.priceChange24h !== undefined) {
            const baseScore = calculateScore(card.priceChange24h);
            const bonus = getRarityBonus(card.about);
            const bonusPoints = Math.round(Math.abs(baseScore) * bonus);

            // Bonus sadece pozitif puana eklenir
            card.score = baseScore + (baseScore > 0 ? bonusPoints : 0);
            totalScore += card.score;
        }
    }

    return totalScore;
}

// =====================
// RASTGELE SEÇİM
// =====================

/**
 * Envanterden rastgele N kart seç (Fisher-Yates shuffle)
 */
export function selectRandomCards<T>(inventory: T[], count: number): T[] {
    if (inventory.length <= count) {
        return [...inventory];
    }

    // Fisher-Yates shuffle
    const shuffled = [...inventory];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
}

// =====================
// KV İŞLEMLERİ
// =====================

const DUEL_PREFIX = 'duel:';
const OPEN_DUELS_KEY = 'duels:open';

/**
 * Yeni düello oluştur
 */
export async function createDuel(
    creatorWallet: string,
    entryFee: number
): Promise<Duel> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const duel: Duel = {
        id,
        createdAt: Date.now(),
        entryFee,
        status: 'open',
        player1: {
            wallet: creatorWallet,
            selectedCards: [],
            totalScore: 0,
            odaSahibi: true,
            odaSahibiAdresi: true,
            odaGirisUcreti: true,
            odaBaslangicZamani: true
        },
        player2: null,
        winner: null
    };

    // KV'ye kaydet
    await kv.set(`${DUEL_PREFIX}${id}`, duel);
    await kv.sadd(OPEN_DUELS_KEY, id);

    return duel;
}

/**
 * Düelloya katıl
 */
export async function joinDuel(
    duelId: string,
    joinerWallet: string
): Promise<Duel | null> {
    const duel = await kv.get<Duel>(`${DUEL_PREFIX}${duelId}`);

    if (!duel || duel.status !== 'open') {
        return null;
    }

    if (duel.player1?.wallet === joinerWallet) {
        throw new Error('Kendi düellonuza katılamazsınız');
    }

    duel.player2 = {
        wallet: joinerWallet,
        selectedCards: [],
        totalScore: 0,
        odaSahibi: false,
        odaSahibiAdresi: false,
        odaGirisUcreti: false,
        odaBaslangicZamani: false
    };
    duel.status = 'active';

    // Güncelle
    await kv.set(`${DUEL_PREFIX}${duelId}`, duel);
    await kv.srem(OPEN_DUELS_KEY, duelId);

    return duel;
}

/**
 * Açık düelloları listele
 */
export async function listOpenDuels(): Promise<Duel[]> {
    const duelIds = await kv.smembers(OPEN_DUELS_KEY);
    const duels: Duel[] = [];

    for (const id of duelIds) {
        const duel = await kv.get<Duel>(`${DUEL_PREFIX}${id}`);
        if (duel && duel.status === 'open') {
            duels.push(duel);
        }
    }

    // En yeniler önce
    return duels.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Düello detayını getir
 */
export async function getDuel(duelId: string): Promise<Duel | null> {
    return await kv.get<Duel>(`${DUEL_PREFIX}${duelId}`);
}

/**
 * Düelloyu güncelle
 */
export async function updateDuel(duel: Duel): Promise<void> {
    await kv.set(`${DUEL_PREFIX}${duel.id}`, duel);
}

/**
 * Kazananı belirle ve düelloyu sonuçlandır
 */
export function determineWinner(duel: Duel): string | null {
    if (!duel.player1 || !duel.player2) return null;

    if (duel.player1.totalScore > duel.player2.totalScore) {
        return duel.player1.wallet;
    } else if (duel.player2.totalScore > duel.player1.totalScore) {
        return duel.player2.wallet;
    } else {
        // Beraberlik - her iki oyuncuya iade (ya da random seçim)
        return null; // Beraberlik
    }
}
