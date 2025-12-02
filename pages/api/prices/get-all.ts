import type { NextApiRequest, NextApiResponse } from 'next'
import { TOKENS } from '../../../lib/tokens'

const ORACLE_URL = process.env.ORACLE_URL

// Test / fallback fiyatları - development/testing için
const MOCK_PRICES = [
  { tokenId: 'wire', symbol: 'WIRE', pLive: 0.0001, p0: 0.00008, changePct: 25, fdv: 1000000, source: 'fallback' },
  { tokenId: 'aixbt', symbol: 'AIXBT', pLive: 0.5, p0: 0.45, changePct: 11.11, fdv: 50000000, source: 'fallback' },
  { tokenId: 'altt', symbol: 'ALTT', pLive: 0.001, p0: 0.0009, changePct: 11.11, fdv: 5000000, source: 'fallback' },
  { tokenId: 'acolyt', symbol: 'ACOLYT', pLive: 0.002, p0: 0.0018, changePct: 11.11, fdv: 8000000, source: 'fallback' },
  { tokenId: 'aristoitle', symbol: 'SFACY', pLive: 0.0003, p0: 0.00027, changePct: 11.11, fdv: 3000000, source: 'fallback' },
]

const extractPairAddress = (input?: string | null) => {
  if (!input) return undefined
  const m = String(input).match(/0x[a-fA-F0-9]{40}/)
  return m ? m[0].toLowerCase() : undefined
}

const buildUnmatched = (prices: any[]) => {
  const byId = new Map<string, any>()
  const bySymbol = new Map<string, any>()
  const byPair = new Map<string, any>()

  for (const p of prices || []) {
    if (p?.tokenId) byId.set(String(p.tokenId).toLowerCase(), p)
    if (p?.symbol) bySymbol.set(String(p.symbol).toLowerCase(), p)
    const pair = extractPairAddress(p?.dexUrl || p?.pair || p?.dexscreenerUrl)
    if (pair) byPair.set(pair, p)
  }

  const unmatched: { id: string; symbol: string; pair?: string | undefined }[] = []
  for (const t of TOKENS) {
    const id = String(t.id || '').toLowerCase()
    const sym = String(t.symbol || '').toLowerCase()
    const tokenPair = t.dexscreenerPair
    const matched = byId.has(id) || bySymbol.has(sym) || (tokenPair && byPair.has(tokenPair))
    if (!matched) unmatched.push({ id: t.id, symbol: t.symbol, pair: tokenPair })
  }

  return unmatched
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // prevent CDN/edge caching so clients always receive fresh prices
    res.setHeader('Cache-Control', 'no-store, max-age=0')

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
        const unmatchedTokens = buildUnmatched(prices)
        return res.status(200).json({ ok: true, prices, unmatchedTokens })
      }
    }

    // Oracle yoksa veya başarısızsa mock data dön (geliştirme/test için)
    const unmatchedTokens = buildUnmatched(MOCK_PRICES)
    return res.status(200).json({ ok: true, prices: MOCK_PRICES, unmatchedTokens })

  } catch (err: any) {
    console.error('Price proxy error', err)
    // Hata durumunda da mock data döndür
    const unmatchedTokens = buildUnmatched(MOCK_PRICES)
    return res.status(200).json({ ok: true, prices: MOCK_PRICES, unmatchedTokens })
  }
}
