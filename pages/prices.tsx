import { useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { TOKENS, buildDexscreenerViewUrl } from '../lib/tokens'
import Topbar from '../components/Topbar'

type PriceRow = {
  tokenId: string
  symbol: string
  name: string
  logo: string
  price: number | null
  baseline: number | null
  changePct: number | null
  fdv?: number | null
  source?: 'dexscreener' | 'gecko' | 'fallback'
  updatedAt?: string
  dexscreenerUrl?: string
  dexNetwork?: string
  dexPair?: string
  error?: string
}

type SortOption = 'changePct' | 'fdv' | 'price'

const REFRESH_INTERVAL = 60_000

function handleImageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget
  if (target.dataset.fallbackApplied === '1') return
  target.dataset.fallbackApplied = '1'
  target.onerror = null
  target.src = '/token-logos/placeholder.png'
}

export default function PricesPage() {
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [sortBy, setSortBy] = useState<SortOption>('changePct')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('flipflop-user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        setUser(null)
      }
    }
  }, [])

  const loadPrices = async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      // Batch endpoint çağırılıyor
      const resp = await fetch(`/api/prices/get-all`)
      const data = await resp.json()
      const priceList = Array.isArray(data?.prices) ? data.prices : []

      // Token listesini price verileriyle eşleştir
      const result = TOKENS.map(token => {
        const defaultView = buildDexscreenerViewUrl(token.dexscreenerUrl, token.dexscreenerNetwork, token.dexscreenerPair) || token.dexscreenerUrl

        // Fiyat listesinde bu tokeni ara
        let priceData = priceList.find((p: any) =>
          String(p?.tokenId || '').toLowerCase() === token.id.toLowerCase() ||
          String(p?.symbol || '').toLowerCase() === token.symbol.toLowerCase()
        )

        // If not found by id/symbol, try matching by dexscreener pair address (most reliable)
        if (!priceData && token.dexscreenerPair) {
          const desired = token.dexscreenerPair.toLowerCase()
          priceData = priceList.find((p: any) => {
            const dexUrl = String(p?.dexUrl || p?.dexscreenerUrl || '')
            const m = dexUrl.match(/0x[a-fA-F0-9]{40}/)
            if (m) return m[0].toLowerCase() === desired
            // some entries may include pair separately
            if (p?.pair) return String(p.pair).toLowerCase() === desired
            return false
          })
        }

        if (priceData) {
          const price = Number(priceData?.pLive ?? priceData?.price ?? NaN)
          const baseline = Number(priceData?.p0 ?? priceData?.baseline ?? priceData?.pLive ?? NaN)
          const changePct = Number.isFinite(Number(priceData?.changePct))
            ? Number(priceData.changePct)
            : (Number.isFinite(baseline) && baseline > 0 && Number.isFinite(price))
              ? ((price - baseline) / baseline) * 100
              : null

          return {
            tokenId: token.id,
            symbol: token.symbol,
            name: token.name,
            logo: token.logo,
            price: Number.isFinite(price) ? price : null,
            baseline: Number.isFinite(baseline) ? baseline : null,
            changePct,
            fdv: priceData?.fdv ? Number(priceData.fdv) : null,
            source: priceData?.source,
            updatedAt: priceData?.ts,
            dexscreenerUrl: priceData?.dexUrl || defaultView,
            dexNetwork: token.dexscreenerNetwork,
            dexPair: token.dexscreenerPair,
            error: undefined
          } as PriceRow
        } else {
          // DEBUG: Log tokens that can't find matching price data (only in console)
          console.warn(`⚠️ [PRICES] No Oracle data for token: ${token.symbol} (id: ${token.id}, pair: ${token.dexscreenerPair || 'N/A'}, type: ${token.about})`)

          // Fallback: token data olmadan, boş veri döndür
          return {
            tokenId: token.id,
            symbol: token.symbol,
            name: token.name,
            logo: token.logo,
            price: null,
            baseline: null,
            changePct: null,
            source: undefined,
            updatedAt: undefined,
            dexscreenerUrl: defaultView,
            dexNetwork: token.dexscreenerNetwork,
            dexPair: token.dexscreenerPair,
            error: undefined
          } as PriceRow
        }
      })

      setRows(result)
      setLastUpdated(Date.now())
    } catch (err: any) {
      setError(err?.message || 'Unable to load prices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrices(true)
    const interval = setInterval(() => loadPrices(false), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const sortedRows = useMemo(() => {
    const searchLower = search.toLowerCase().trim()
    return rows
      .filter(row => {
        if (!searchLower) return true
        return row.name.toLowerCase().includes(searchLower) ||
          row.symbol.toLowerCase().includes(searchLower)
      })
      .sort((a, b) => {
        if (sortBy === 'changePct') {
          const aChange = Number.isFinite(a.changePct ?? NaN) ? (a.changePct as number) : -Infinity
          const bChange = Number.isFinite(b.changePct ?? NaN) ? (b.changePct as number) : -Infinity
          if (bChange !== aChange) return bChange - aChange
          // Secondary sort by FDV
          const aFdv = Number.isFinite(a.fdv ?? NaN) ? (a.fdv as number) : -Infinity
          const bFdv = Number.isFinite(b.fdv ?? NaN) ? (b.fdv as number) : -Infinity
          return bFdv - aFdv
        } else if (sortBy === 'fdv') {
          const aFdv = Number.isFinite(a.fdv ?? NaN) ? (a.fdv as number) : -Infinity
          const bFdv = Number.isFinite(b.fdv ?? NaN) ? (b.fdv as number) : -Infinity
          if (bFdv !== aFdv) return bFdv - aFdv
          // Secondary sort by change %
          const aChange = Number.isFinite(a.changePct ?? NaN) ? (a.changePct as number) : -Infinity
          const bChange = Number.isFinite(b.changePct ?? NaN) ? (b.changePct as number) : -Infinity
          return bChange - aChange
        } else { // sortBy === 'price'
          const aPrice = Number.isFinite(a.price ?? NaN) ? (a.price as number) : -Infinity
          const bPrice = Number.isFinite(b.price ?? NaN) ? (b.price as number) : -Infinity
          if (bPrice !== aPrice) return bPrice - aPrice
          // Secondary sort by change %
          const aChange = Number.isFinite(a.changePct ?? NaN) ? (a.changePct as number) : -Infinity
          const bChange = Number.isFinite(b.changePct ?? NaN) ? (b.changePct as number) : -Infinity
          return bChange - aChange
        }
      })
  }, [rows, sortBy, search])

  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString()
    : '--'

  return (
    <div className="app">
      <Topbar activeTab="prices" user={user} />

      <div className="panel">
        <div className="row">
          <h2>Live Token Prices</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="text"
              placeholder="Search token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: 14,
                width: 180
              }}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <option value="changePct">Sort by 24h %</option>
              <option value="fdv">Sort by FDV</option>
              <option value="price">Sort by Price</option>
            </select>
            <span className="badge" style={{
              background: 'rgba(59,130,246,0.2)',
              borderColor: 'rgba(59,130,246,0.3)',
              color: '#bfdbfe',
              fontSize: 12
            }}>
              Updated {updatedLabel}
            </span>
            <button
              className="btn"
              onClick={() => loadPrices(true)}
              style={{ padding: '8px 16px', fontSize: 14 }}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.35)',
            color: '#fca5a5',
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        <div className="sep" style={{ marginTop: loading ? 24 : 16 }}></div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted-inv)' }}>
            Loading live prices...
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minWidth: '600px'
            }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 2fr) repeat(3, minmax(100px, 1fr)) 140px',
                gap: 12,
                alignItems: 'center',
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                fontWeight: 700,
                fontSize: 11,
                color: 'rgba(255,255,255,0.9)',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                <div>Token</div>
                <div>Price</div>
                <div>24h %</div>
                <div>FDV</div>
                <div>Source</div>
              </div>
              {sortedRows.map(row => {
                const change = row.changePct ?? 0
                const positive = change >= 0
                return (
                  <div key={row.tokenId} className="price-row" style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 2fr) repeat(3, minmax(100px, 1fr)) 140px',
                    gap: 12,
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.18)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        flexShrink: 0
                      }}>
                        <img
                          src={row.logo}
                          alt={row.symbol}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={handleImageFallback}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                          {row.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                          ${row.symbol}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                      {row.price != null ? `$${row.price.toLocaleString(undefined, { maximumFractionDigits: row.price >= 2 ? 2 : 6 })}` : '—'}
                    </div>

                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: positive ? '#86efac' : '#fca5a5'
                    }}>
                      {row.changePct != null ? `${positive ? '+' : ''}${row.changePct.toFixed(2)}%` : '—'}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                      {row.fdv != null ? `$${(row.fdv / 1_000_000).toFixed(2)}M` : '—'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                      {row.dexscreenerUrl && (
                        <a
                          href={row.dexscreenerUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#93c5fd', textDecoration: 'underline' }}
                        >
                          View on Dexscreener
                        </a>
                      )}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <span
                          className="badge"
                          style={{
                            background:
                              row.source === 'dexscreener'
                                ? 'rgba(16,185,129,0.18)'
                                : row.source === 'gecko'
                                  ? 'rgba(59,130,246,0.2)'
                                  : 'rgba(239,68,68,0.2)',
                            borderColor:
                              row.source === 'dexscreener'
                                ? 'rgba(16,185,129,0.3)'
                                : row.source === 'gecko'
                                  ? 'rgba(59,130,246,0.35)'
                                  : 'rgba(239,68,68,0.35)',
                            color:
                              row.source === 'dexscreener'
                                ? '#86efac'
                                : row.source === 'gecko'
                                  ? '#bfdbfe'
                                  : '#fca5a5',
                            fontSize: 11
                          }}
                        >
                          {row.source === 'dexscreener' ? 'Dexscreener' : row.source === 'gecko' ? 'GeckoTerminal' : 'Fallback'}
                        </span>
                        {row.error && (
                          <span style={{ color: '#fca5a5' }}>
                            {row.error}
                          </span>
                        )}
                        {row.dexNetwork && row.dexPair && (
                          <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {row.dexNetwork} · {row.dexPair.slice(0, 6)}…{row.dexPair.slice(-4)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
