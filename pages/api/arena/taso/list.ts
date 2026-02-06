/**
 * GET /api/arena/taso/list - List Open Flip Flop Rooms (KV Based for Speed)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listOpenTasoGames, TasoGame } from '../../../../lib/tasoGame';
import { TIER_INFO, ArenaTier } from '../../../../lib/contracts/arenaContract';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        const games = await listOpenTasoGames();

        // Transform KV TasoGame to ArenaRoom-like structure for frontend compatibility
        const rooms = games.map(g => {
            // Ensure tier maps correctly. If stored as string/key, map to index? 
            // choice.ts saves user input (number 0-3).
            // TIER_INFO index check.

            // Map 'status' string to number for frontend (0=Open)
            // KV status: 'open' -> 0
            const statusNum = 0; // Since we listing Open games

            return {
                id: g.id,
                player1: g.player1.wallet,
                player2: g.player2?.wallet || '0x0000000000000000000000000000000000000000',
                stake: BigInt(g.stake || TIER_INFO[(g.tier as unknown as ArenaTier)]?.stake || 0).toString(), // g.stake might be 0 if new, use default
                tier: (g.tier as unknown as number),
                gameMode: 1, // Taso
                status: statusNum,
                winner: g.winner || '0x0000000000000000000000000000000000000000',
                createdAt: g.createdAt.toString(),
                cardSymbol: g.player1.card?.symbol, // Extra info useful for UI
                cardLogo: g.player1.card?.logo
            };
        });

        return res.status(200).json({
            ok: true,
            rooms
        });
    } catch (error: any) {
        console.error('List taso error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
