import type { NextApiRequest, NextApiResponse } from 'next'

const ORACLE_URL = process.env.ORACLE_URL

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!ORACLE_URL) {
    return res.status(200).json({ ok: false, prices: [] })
  }

  try {
    const r = await fetch(`${ORACLE_URL}/api/prices/get-all`)
    if (!r.ok) {
      console.error('Oracle prices failed', r.status)
      return res.status(200).json({ ok: false, prices: [] })
    }

    const data = await r.json()
    // Expecting an array of price objects from Oracle
    return res.status(200).json({ ok: true, prices: data })
  } catch (err: any) {
    console.error('Price proxy error', err)
    return res.status(200).json({ ok: false, prices: [] })
  }
}
