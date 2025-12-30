import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { TOKENS, getTokenById } from '../lib/tokens'
import Topbar from '../components/Topbar'
import Link from 'next/link'
import { useToast } from '../lib/toast'

// --- TYPES ---
type ItemResult = {
  tokenId: string
  symbol: string
  dir: 'UP' | 'DOWN'
  duplicateIndex: number
  points: number
}

type DayResult = {
  dayKey: string
  total: number
  roundNumber?: number
  userId?: string
  userName?: string
  items: ItemResult[]
}

const DEFAULT_AVATAR = '/avatars/default-avatar.png'

// --- MOCK DATA FOR PREVIEW (Set to TRUE to see design without real data) ---
const USE_MOCK_DATA = false;

const MOCK_HISTORY: DayResult[] = [
  {
    dayKey: '2023-10-25',
    total: 1250,
    items: [
      { tokenId: 'bitcoin', symbol: 'BTC', dir: 'UP', duplicateIndex: 1, points: 500 },
      { tokenId: 'ethereum', symbol: 'ETH', dir: 'DOWN', duplicateIndex: 1, points: 250 },
      { tokenId: 'solana', symbol: 'SOL', dir: 'UP', duplicateIndex: 2, points: -100 },
      { tokenId: 'dogecoin', symbol: 'DOGE', dir: 'UP', duplicateIndex: 1, points: 300 },
      { tokenId: 'ripple', symbol: 'XRP', dir: 'DOWN', duplicateIndex: 1, points: 300 },
    ]
  },
  {
    dayKey: '2023-10-24',
    total: -450,
    items: [
      { tokenId: 'bitcoin', symbol: 'BTC', dir: 'DOWN', duplicateIndex: 1, points: -800 },
      { tokenId: 'avalanche-2', symbol: 'AVAX', dir: 'UP', duplicateIndex: 1, points: 150 },
      { tokenId: 'binancecoin', symbol: 'BNB', dir: 'UP', duplicateIndex: 1, points: 50 },
      { tokenId: 'cardano', symbol: 'ADA', dir: 'DOWN', duplicateIndex: 3, points: 100 },
      { tokenId: 'polkadot', symbol: 'DOT', dir: 'UP', duplicateIndex: 1, points: 50 },
    ]
  }
];

// --- COMPONENTS ---

const StatBox = ({ label, value, sub, color }: { label: string, value: string, sub?: string, color?: string }) => (
  <div style={{
    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
    borderRadius: 16,
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    backdropFilter: 'blur(10px)',
    minWidth: '120px'
  }}>
    <div style={{ color: 'var(--muted-inv)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: color || 'white', textShadow: color ? `0 0 20px ${color}40` : 'none' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{sub}</div>}
  </div>
)

const RoundCard = ({ day, index }: { day: DayResult, index: number }) => {
  const isWin = day.total >= 0;
  const dateObj = new Date(day.dayKey);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{
      marginBottom: 24,
      borderRadius: 20,
      background: 'rgba(30, 41, 59, 0.6)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      transition: 'transform 0.2s ease',
      position: 'relative'
    }}>
      {/* Status Bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 6,
        background: isWin ? '#10b981' : '#ef4444',
        boxShadow: isWin ? '0 0 15px #10b98180' : '0 0 15px #ef444480'
      }} />

      <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {day.roundNumber && (
              <span style={{
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}>ROUND #{day.roundNumber}</span>
            )}
            <div style={{ fontSize: 13, color: 'var(--muted-inv)', fontWeight: 600, letterSpacing: 1 }}>ENDED</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{formattedDate}</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: 'var(--muted-inv)', fontWeight: 600, letterSpacing: 1 }}>TOTAL SCORE</div>
          <div style={{
            fontSize: 24,
            fontWeight: 900,
            color: isWin ? '#34d399' : '#f87171',
            textShadow: isWin ? '0 0 20px rgba(52, 211, 153, 0.3)' : '0 0 20px rgba(248, 113, 113, 0.3)'
          }}>{isWin ? '+' : ''}{day.total.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ padding: 20, background: 'rgba(15, 23, 42, 0.4)' }}>
        <div style={{ fontSize: 12, color: 'var(--muted-inv)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Battle Log</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', gap: 12 }}>
          {day.items.map((item, idx) => {
            const token = getTokenById(item.tokenId) || TOKENS[0];
            const itemWin = item.points >= 0;
            return (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 12,
                padding: '10px 4px',
                border: `1px solid ${itemWin ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}`,
                position: 'relative'
              }}>
                {item.duplicateIndex > 1 && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#f59e0b', color: 'black',
                    fontSize: 10, fontWeight: 800,
                    padding: '2px 6px', borderRadius: 8,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                  }}>x{item.duplicateIndex}</div>
                )}

                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', marginBottom: 8, border: '2px solid rgba(255,255,255,0.1)' }}>
                  <img
                    src={token.logo}
                    alt={token.symbol}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{token.symbol}</span>
                  <span style={{
                    fontSize: 10,
                    color: item.dir === 'UP' ? '#34d399' : '#f87171',
                    background: item.dir === 'UP' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                    padding: '1px 3px', borderRadius: 3
                  }}>{item.dir === 'UP' ? '▲' : '▼'}</span>
                </div>

                <div style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: itemWin ? '#34d399' : '#f87171'
                }}>
                  {itemWin ? '+' : ''}{item.points}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [history, setHistory] = useState<DayResult[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Calcs
  const [totalGames, setTotalGames] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)

  useEffect(() => {
    async function load() {
      // Mock Data Check
      if (USE_MOCK_DATA) {
        setHistory(MOCK_HISTORY)
        setTotalGames(MOCK_HISTORY.length)
        setTotalScore(MOCK_HISTORY.reduce((acc, curr) => acc + curr.total, 0))
        setBestScore(Math.max(...MOCK_HISTORY.map(h => h.total)))
        setLoading(false)
        return
      }

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

              // Stats - Only sum positive scores (matching leaderboard behavior)
              setTotalGames(mapped.length)
              const positiveSum = mapped.reduce((acc: number, curr: any) => acc + (curr.total > 0 ? curr.total : 0), 0)
              setTotalScore(positiveSum)
              setBestScore(mapped.length > 0 ? Math.max(...mapped.map((h: any) => h.total)) : 0)
            }
          }
        } catch (e) {
          console.error(e)
          toast('Failed to load history', 'error')
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="app">
      <Topbar activeTab="history" user={user} />

      <div className="panel" style={{ maxWidth: 800, margin: '0 auto', background: 'transparent', border: 'none', boxShadow: 'none' }}>

        {/* Page Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            background: 'linear-gradient(to right, #fff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 1
          }}>Battle Log</h1>
          <p style={{ color: 'var(--muted-inv)', fontSize: 16 }}>Your daily performance archive</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}></div>
            <div className="muted">Loading battle data...</div>
            <style jsx>{` @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } `}</style>
          </div>
        ) : history.length > 0 ? (
          <>
            {/* Stats Overview */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
              <StatBox label="Total Score" value={totalScore.toLocaleString()} color={totalScore >= 0 ? '#34d399' : '#f87171'} />
              <StatBox label="Games Played" value={totalGames.toString()} />
              <StatBox label="Best Round" value={bestScore > 0 ? `+${bestScore.toLocaleString()}` : bestScore.toLocaleString()} color="#fbbf24" />
            </div>

            {/* History List */}
            <div>
              {history.slice().reverse().map((day, index) => (
                <RoundCard key={index} day={day} index={index} />
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 40, opacity: 0.5 }}>
              <p style={{ fontSize: 12 }}>End of history</p>
            </div>
          </>
        ) : (
          /* EMPTY STATE */
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: 24,
            border: '1px dashed rgba(255,255,255,0.1)',
            marginTop: 20
          }}>
            <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.8 }}>⚔️</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>No Battles Yet</h3>
            <p style={{ color: 'var(--muted-inv)', maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.6 }}>
              You haven't participated in any daily rounds yet. Join the arena, pick your cards, and build your legacy!
            </p>
            <Link href="/" className="btn primary" style={{
              padding: '16px 32px',
              fontSize: 16,
              borderRadius: 12,
              boxShadow: '0 10px 30px -10px var(--primary)'
            }}>
              Play Now
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}



