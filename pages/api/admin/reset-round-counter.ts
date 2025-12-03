import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Admin auth
  const { secret } = req.query;
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Round counter'ı sıfırla
    await kv.set('GLOBAL_ROUND_COUNTER', 0);
    console.log('✅ GLOBAL_ROUND_COUNTER reset to 0');

    return res.status(200).json({
      ok: true,
      message: 'Round counter reset to 0. Next settlement will be Round #1'
    });
  } catch (err: any) {
    console.error('Error resetting counter:', err);
    return res.status(500).json({ error: err.message });
  }
}
