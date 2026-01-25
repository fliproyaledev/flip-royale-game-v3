/**
 * GET /api/arena/taso/[id] - Taso game replay/detay
 * Seçimler oyun çözülene kadar gizlenir
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getTasoGame, TasoGame, TasoPlayer } from '../../../../lib/tasoGame';

function hideChoices(game: TasoGame, requestingWallet?: string): TasoGame {
    // If game is resolved, show all choices
    if (game.status === 'resolved') {
        return game;
    }

    const cleanWallet = requestingWallet?.toLowerCase();

    // Hide choices from opponents
    const hidePlayerChoice = (player: TasoPlayer, isCurrentUser: boolean): TasoPlayer => ({
        ...player,
        // Only show choice to the player who made it
        choice: isCurrentUser ? player.choice : undefined,
    });

    return {
        ...game,
        player1: hidePlayerChoice(game.player1, game.player1.wallet === cleanWallet),
        player2: game.player2
            ? hidePlayerChoice(game.player2, game.player2.wallet === cleanWallet)
            : undefined,
    };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const { id, wallet } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ ok: false, error: 'Game ID required' });
        }

        const game = await getTasoGame(id);

        if (!game) {
            return res.status(404).json({ ok: false, error: 'Game not found' });
        }

        // Hide choices based on requesting user
        const safeGame = hideChoices(game, typeof wallet === 'string' ? wallet : undefined);

        return res.status(200).json({
            ok: true,
            game: safeGame,
        });
    } catch (error: any) {
        console.error('Get taso game error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
