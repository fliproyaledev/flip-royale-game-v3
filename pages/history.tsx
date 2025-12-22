import { useEffect, useState } from 'react'
import { TOKENS, getTokenById } from '../lib/tokens'
import Topbar from '../components/Topbar'

type DayResult = {
  dayKey: string
  total: number
  userId?: string // User who participated
  userName?: string // User name
  walletAddress?: string // Wallet address
  items: {
    tokenId: string
    symbol: string
    dir: 'UP' | 'DOWN'
    duplicateIndex: number
    points: number
  }[]
}

const DEFAULT_AVATAR = '/avatars/default-avatar.png'

function handleImageFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.currentTarget
  if (target.dataset.fallbackApplied === '1') return
  target.dataset.fallbackApplied = '1'
  target.onerror = null
  target.src = '/token-logos/placeholder.png'
}

export default function History() {
  const [history, setHistory] = useState<DayResult[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    async function load() {
      const savedUser = localStorage.getItem('flipflop-user')
      let userId = ''
      if (savedUser) {
        try { userId = JSON.parse(savedUser).id } catch { }
      }

      if (userId) {
        try {
          const r = await fetch(`/api/users/me?userId=${encodeURIComponent(userId)}`)
          const j = await r.json()
          if (j.ok && j.user) {
            setUser(j.user)
            if (Array.isArray(j.user.roundHistory)) {
              const mapped = j.user.roundHistory.map((h: any) => ({
                ...h,
                total: h.totalPoints ?? h.total ?? 0
              }))
              setHistory(mapped)
            }
          }
        } catch (e) { console.error(e) }
      }
    }
    load()
    setLoading(false)
  }, [])

  const hasHistory = history.length > 0

  return (
    <div className="app">
      <Topbar activeTab="history" user={user} />

      {/* Play Mode History */}
      <div className="panel">
        <div className="row">
          <h2>Flip Royale History</h2>
          {hasHistory && (
            <span className="muted">{history.length} rounds</span>
          )}
        </div>
        <div className="sep"></div>

        {hasHistory ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {history.slice().reverse().map((day, index) => {
              const totalPositive = day.total >= 0
              return (
                <div key={`${day.dayKey}-${index}`} style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: 20
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{day.dayKey}</div>
                      <span className="badge" style={{
                        background: totalPositive ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)',
                        borderColor: totalPositive ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)',
                        color: totalPositive ? '#86efac' : '#fca5a5'
                      }}>
                        {totalPositive ? '+' : ''}{day.total} pts
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-inv)' }}>
                      {day.items.length} picks
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {day.items.map((item, idx) => {
                      const itemPositive = item.points >= 0
                      return (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: itemPositive ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
                          border: '1px solid',
                          borderColor: itemPositive ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)',
                          fontSize: 12
                        }}>
                          <span style={{ fontWeight: 700, color: itemPositive ? '#86efac' : '#fca5a5' }}>
                            {item.symbol}
                          </span>
                          <span style={{ color: itemPositive ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {itemPositive ? '+' : ''}{item.points}
                          </span>
                          <span style={{
                            fontSize: 10,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: 'rgba(0,0,0,.2)',
                            color: 'var(--muted-inv)'
                          }}>
                            dup x{item.duplicateIndex}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-inv)' }}>
            No rounds recorded yet. Play a round to start building history!
          </div>
        )}
      </div>
    </div>
  )
}


