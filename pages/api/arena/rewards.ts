/**
 * GET /api/arena/rewards - Get user's claimable rewards
 * POST /api/arena/rewards - Claim rewards (withdraw)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        // Get rewards balance
        const { wallet } = req.query;

        if (!wallet || typeof wallet !== 'string') {
            return res.status(400).json({ ok: false, error: 'Wallet address required' });
        }

        const cleanWallet = wallet.toLowerCase();
        const rewardsKey = `rewards:${cleanWallet}`;
        const balance = await kv.get<number>(rewardsKey) || 0;

        // Get claim history
        const historyKey = `rewards_history:${cleanWallet}`;
        const history = await kv.lrange(historyKey, 0, 19) || [];

        return res.status(200).json({
            ok: true,
            balance,
            history,
        });
    }

    if (req.method === 'POST') {
        // Claim rewards
        const { wallet, amount } = req.body;

        if (!wallet) {
            return res.status(400).json({ ok: false, error: 'Wallet address required' });
        }

        const cleanWallet = wallet.toLowerCase();
        const rewardsKey = `rewards:${cleanWallet}`;
        const balance = await kv.get<number>(rewardsKey) || 0;

        if (!amount || amount <= 0) {
            return res.status(400).json({ ok: false, error: 'Invalid amount' });
        }

        if (amount > balance) {
            return res.status(400).json({ ok: false, error: 'Insufficient balance' });
        }

        // TODO: Trigger actual on-chain withdrawal via Oracle
        // For now, we just record the claim request

        const claimRecord = {
            id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            wallet: cleanWallet,
            amount,
            status: 'pending', // pending, processing, completed, failed
            createdAt: Date.now(),
        };

        // Deduct from balance
        await kv.set(rewardsKey, balance - amount);

        // Add to history
        const historyKey = `rewards_history:${cleanWallet}`;
        await kv.lpush(historyKey, claimRecord);

        // Add to pending claims for oracle to process
        await kv.lpush('pending_claims', claimRecord);

        return res.status(200).json({
            ok: true,
            claim: claimRecord,
            newBalance: balance - amount,
        });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
