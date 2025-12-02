import type { NextApiRequest, NextApiResponse } from 'next'

const ORACLE_URL = process.env.ORACLE_URL

// Test / fallback fiyatları - development/testing için
const MOCK_PRICES = [
  { tokenId: 'wire', symbol: 'WIRE', pLive: 0.0001, p0: 0.00008, changePct: 25, fdv: 1000000, source: 'fallback' },
  { tokenId: 'aixbt', symbol: 'AIXBT', pLive: 0.5, p0: 0.45, changePct: 11.11, fdv: 50000000, source: 'fallback' },
  { tokenId: 'altt', symbol: 'ALTT', pLive: 0.001, p0: 0.0009, changePct: 11.11, fdv: 5000000, source: 'fallback' },
  { tokenId: 'acolyt', symbol: 'ACOLYT', pLive: 0.002, p0: 0.0018, changePct: 11.11, fdv: 8000000, source: 'fallback' },
  { tokenId: 'aristoitle', symbol: 'SFACY', pLive: 0.0003, p0: 0.00027, changePct: 11.11, fdv: 3000000, source: 'fallback' },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Oracle varsa Oracle'dan çek
    if (ORACLE_URL) {
      const r = await fetch(`${ORACLE_URL}/api/prices/get-all`)
      if (r.ok) {
        const data = await r.json()
        // Oracle may return either an array or an object { ok: true, prices: [...] }
        const prices = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.prices)
            ? (data as any).prices
            : []
        return res.status(200).json({ ok: true, prices })
      }
    }

    // Oracle yoksa veya başarısızsa mock data dön (geliştirme/test için)
    return res.status(200).json({ ok: true, prices: MOCK_PRICES })

  } catch (err: any) {
    console.error('Price proxy error', err)
    // Hata durumunda da mock data döndür
    return res.status(200).json({ ok: true, prices: MOCK_PRICES })
  }
}
