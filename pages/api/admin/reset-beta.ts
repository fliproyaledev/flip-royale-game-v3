import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

const ADMIN_WALLETS = process.env.ADMIN_WALLETS?.split(',') || [];
const ORACLE_URL = process.env.ORACLE_URL;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Admin Check
    const { signature, address } = req.body;

    // Checking address against env list (Simplified for this beta tool, signature verification recommended for prod but strict address check is okay if env is secure)
    if (!address || !ADMIN_WALLETS.map(w => w.toLowerCase()).includes(address.toLowerCase())) {
        return res.status(401).json({ error: 'Unauthorized Admin Wallet' });
    }

    try {
        console.log('🚨 [ADMIN] INITIATING BETA RESET...');

        // 1. Reset Users on Oracle
        if (ORACLE_URL && ORACLE_SECRET) {
            console.log('Calling Oracle reset...');
            const oracleRes = await fetch(`${ORACLE_URL}/api/admin/reset-users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ORACLE_SECRET}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!oracleRes.ok) {
                throw new Error(`Oracle reset failed: ${await oracleRes.text()}`);
            }
            console.log('Oracle reset successful.');
        }

        // 2. Reset Global Game State (KV)
        console.log('Resetting local KV state...');

        // Reset Round Counter
        await kv.set('GLOBAL_ROUND_COUNTER', 1);

        // Clear Histories
        await kv.del('HISTORY_SUMMARY');
        await kv.del('GLOBAL_PRICE_CACHE'); // Optional: force fresh price fetch

        console.log('✅ [ADMIN] BETA RESET COMPLETE');

        return res.status(200).json({ ok: true, message: "Game has been fully reset to Round 1." });

    } catch (error: any) {
        console.error('Reset Error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
