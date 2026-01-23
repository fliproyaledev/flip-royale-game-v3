/**
 * Taso Game - Card Flip Mode
 * Kullanıcılar Ön/Arka seçer, doğru tahmin eden kazanır
 * Kaybeden kartı "wrecked" olur
 */

import { kv } from '@vercel/kv';
import { CardInstance, wreckCard, isCardActive } from './cardInstance';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TasoChoice = 'front' | 'back';

export interface TasoEntry {
    stake: number;
    pot: number;
    winnerPayout: number;
    houseFee: number;
}

export const TASO_TIERS = {
    low: { stake: 25000, pot: 50000, winnerPayout: 45000, houseFee: 5000 },
    mid: { stake: 50000, pot: 100000, winnerPayout: 90000, houseFee: 10000 },
    high: { stake: 100000, pot: 200000, winnerPayout: 180000, houseFee: 20000 },
};

export type TasoTier = keyof typeof TASO_TIERS;

export interface TasoCard {
    cardId: string;       // CardInstance ID
    tokenId: string;
    symbol: string;
    name: string;
    logo: string;
    cardType: string;
}

export interface TasoPlayer {
    wallet: string;
    card: TasoCard;
    choice?: TasoChoice;   // Kullanıcının seçimi
}

export type TasoStatus = 'open' | 'waiting_choices' | 'resolved' | 'cancelled';

export interface TasoGame {
    id: string;
    tier: TasoTier;
    status: TasoStatus;
    createdAt: number;
    matchedAt?: number;
    resolvedAt?: number;

    player1: TasoPlayer;
    player2?: TasoPlayer;

    flipResult?: TasoChoice;  // Sistemin flip sonucu
    winner?: string;          // wallet address
    loserCardWrecked?: string; // Wrecked card ID

    stake: number;
    pot: number;
    winnerPayout: number;
    houseFee: number;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const TASO_PREFIX = 'taso:';
const OPEN_TASO_KEY = 'taso:open';

// ─────────────────────────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────────────────────────

export function generateTasoId(): string {
    return `taso_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────
// RANDOM CARD SELECTION
// ─────────────────────────────────────────────────────────────

export function selectRandomCard(cards: CardInstance[]): CardInstance {
    const activeCards = cards.filter(isCardActive);

    if (activeCards.length < 1) {
        throw new Error('No active cards available');
    }

    const randomIndex = Math.floor(Math.random() * activeCards.length);
    return activeCards[randomIndex];
}

// ─────────────────────────────────────────────────────────────
// FLIP LOGIC
// ─────────────────────────────────────────────────────────────

export function performFlip(): TasoChoice {
    return Math.random() > 0.5 ? 'front' : 'back';
}

export function determineWinner(
    player1Choice: TasoChoice,
    player2Choice: TasoChoice,
    flipResult: TasoChoice
): 'player1' | 'player2' | 'draw' {
    const p1Correct = player1Choice === flipResult;
    const p2Correct = player2Choice === flipResult;

    if (p1Correct && !p2Correct) return 'player1';
    if (p2Correct && !p1Correct) return 'player2';
    return 'draw'; // Both correct or both wrong
}

// ─────────────────────────────────────────────────────────────
// TASO OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Yeni taso odası oluştur
 */
export async function createTasoGame(
    wallet: string,
    tier: TasoTier,
    card: TasoCard
): Promise<TasoGame> {
    const tierConfig = TASO_TIERS[tier];
    const id = generateTasoId();

    const game: TasoGame = {
        id,
        tier,
        status: 'open',
        createdAt: Date.now(),

        player1: {
            wallet: wallet.toLowerCase(),
            card,
        },

        stake: tierConfig.stake,
        pot: tierConfig.pot,
        winnerPayout: tierConfig.winnerPayout,
        houseFee: tierConfig.houseFee,
    };

    await kv.set(`${TASO_PREFIX}${id}`, game);
    await kv.sadd(OPEN_TASO_KEY, id);

    return game;
}

/**
 * Taso oyununa katıl
 */
export async function joinTasoGame(
    gameId: string,
    wallet: string,
    card: TasoCard
): Promise<TasoGame | null> {
    const game = await kv.get<TasoGame>(`${TASO_PREFIX}${gameId}`);

    if (!game || game.status !== 'open') {
        return null;
    }

    if (game.player1.wallet === wallet.toLowerCase()) {
        throw new Error('Cannot join your own game');
    }

    game.player2 = {
        wallet: wallet.toLowerCase(),
        card,
    };
    game.status = 'waiting_choices';
    game.matchedAt = Date.now();

    await kv.set(`${TASO_PREFIX}${gameId}`, game);
    await kv.srem(OPEN_TASO_KEY, gameId);

    return game;
}

/**
 * Kullanıcı seçimini kaydet
 */
export async function submitChoice(
    gameId: string,
    wallet: string,
    choice: TasoChoice
): Promise<TasoGame | null> {
    const game = await kv.get<TasoGame>(`${TASO_PREFIX}${gameId}`);

    if (!game || game.status !== 'waiting_choices') {
        return null;
    }

    const walletLower = wallet.toLowerCase();

    if (game.player1.wallet === walletLower) {
        game.player1.choice = choice;
    } else if (game.player2?.wallet === walletLower) {
        game.player2.choice = choice;
    } else {
        throw new Error('Not a participant of this game');
    }

    await kv.set(`${TASO_PREFIX}${gameId}`, game);

    // Eğer her iki oyuncu da seçtiyse, oyunu çöz
    if (game.player1.choice && game.player2?.choice) {
        return await resolveTasoGame(gameId);
    }

    return game;
}

/**
 * Taso oyununu çöz
 */
export async function resolveTasoGame(gameId: string): Promise<TasoGame | null> {
    const game = await kv.get<TasoGame>(`${TASO_PREFIX}${gameId}`);

    if (!game || !game.player2 || !game.player1.choice || !game.player2.choice) {
        return null;
    }

    // Flip yap
    game.flipResult = performFlip();

    // Kazananı belirle
    const result = determineWinner(game.player1.choice, game.player2.choice, game.flipResult);

    if (result === 'draw') {
        // Beraberlik: Tekrar flip (ya da stake iade)
        // Şimdilik random seç
        game.winner = Math.random() > 0.5 ? game.player1.wallet : game.player2.wallet;
    } else {
        game.winner = result === 'player1' ? game.player1.wallet : game.player2.wallet;
    }

    // Kaybeden kartı wreck
    const loser = game.winner === game.player1.wallet ? game.player2 : game.player1;
    game.loserCardWrecked = loser.card.cardId;

    game.status = 'resolved';
    game.resolvedAt = Date.now();

    await kv.set(`${TASO_PREFIX}${gameId}`, game);

    return game;
}

/**
 * Açık taso oyunlarını listele
 */
export async function listOpenTasoGames(tier?: TasoTier): Promise<TasoGame[]> {
    const gameIds = await kv.smembers(OPEN_TASO_KEY);
    const games: TasoGame[] = [];

    for (const id of gameIds) {
        const game = await kv.get<TasoGame>(`${TASO_PREFIX}${id}`);
        if (game && game.status === 'open') {
            if (!tier || game.tier === tier) {
                games.push(game);
            }
        }
    }

    return games.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Taso oyun detayı (replay)
 */
export async function getTasoGame(gameId: string): Promise<TasoGame | null> {
    return await kv.get<TasoGame>(`${TASO_PREFIX}${gameId}`);
}

/**
 * Taso iptal
 */
export async function cancelTasoGame(gameId: string, wallet: string): Promise<boolean> {
    const game = await kv.get<TasoGame>(`${TASO_PREFIX}${gameId}`);

    if (!game || game.status !== 'open') {
        return false;
    }

    if (game.player1.wallet !== wallet.toLowerCase()) {
        return false;
    }

    game.status = 'cancelled';
    await kv.set(`${TASO_PREFIX}${gameId}`, game);
    await kv.srem(OPEN_TASO_KEY, gameId);

    return true;
}
