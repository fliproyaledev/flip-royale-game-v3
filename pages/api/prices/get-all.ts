import type { NextApiRequest, NextApiResponse } from 'next'

const ORACLE_URL = process.env.ORACLE_URL
const ORACLE_SECRET = process.env.ORACLE_SECRET

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1. Input Check
    if (!ORACLE_URL || !ORACLE_SECRET) {
      return res.status(500).json({ ok: false, error: 'Oracle configuration missing' });
    }

    // 2. Oracle Proxy
    // Oracle already handles all falling back logic and DexScreener searching.
    // We just need to fetch the unified list from it.
    const oracleResponse = await fetch(`${ORACLE_URL}/api/prices/get-all`, {
      headers: {
        'Authorization': `Bearer ${ORACLE_SECRET}`
      },
      // Short timeout to avoid hanging if Oracle is down
      signal: AbortSignal.timeout(8000)
    });

    if (oracleResponse.ok) {
      const oracleData = await oracleResponse.json();
      const prices = Array.isArray(oracleData.prices) ? oracleData.prices : (Array.isArray(oracleData) ? oracleData : []);

      return res.status(200).json({
        ok: true,
        prices: prices,
        source: 'oracle-proxy'
      });
    } else {
      console.warn(`Oracle responded with status ${oracleResponse.status}`);
      return res.status(200).json({ ok: true, prices: [], error: 'Oracle unavailable' });
    }

  } catch (error: any) {
    console.error('API Proxy Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
