import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../lib/theme'
import ThemeToggle from '../components/ThemeToggle'
import { signIn } from 'next-auth/react'

// TYPES
type LeaderboardEntry = {
  rank: number
  userId: string
  username: string
  avatar: string
  totalPoints: number
  bankPoints?: number
  activeCards?: number
  isCurrentUser?: boolean
}

type UserInfo = {
  id: string
  username: string
  avatar: string
  points: number
}

const DEFAULT_AVATAR = '/avatars/default-avatar.png'

export default function LeaderboardPage() {
  const { theme } = useTheme()

  // DATA STATES
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<LeaderboardEntry | null>(null)
  const [timeframe, setTimeframe] = useState<'all' | 'daily' | 'weekly'>('all')
  const [mounted, setMounted] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [xHandle, setXHandle] = useState<string | undefined>(undefined)

  // Load xHandle from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('flipflop-user')
      if (stored) {
        const userData = JSON.parse(stored)
        if (userData.xHandle) {
          setXHandle(userData.xHandle)
        }
      }
    } catch { }
  }, [])

  // Load user info from localStorage and API
  useEffect(() => {
    async function loadUserInfo() {
      try {
        const saved = localStorage.getItem('flipflop-user')
        if (saved) {
          const parsed = JSON.parse(saved)
          // Fetch current points from API
          const res = await fetch(`/api/users/me?userId=${encodeURIComponent(parsed.id)}`)
          const data = await res.json()
          if (data.ok && data.user) {
            setUserInfo({
              id: parsed.id,
              username: data.user.name || parsed.username,
              avatar: data.user.avatar || parsed.avatar || DEFAULT_AVATAR,
              points: data.user.totalPoints || 0
            })
          } else {
            setUserInfo({
              id: parsed.id,
              username: parsed.username,
              avatar: parsed.avatar || DEFAULT_AVATAR,
              points: 0
            })
          }
        }
      } catch (e) {
        console.error('Failed to load user info:', e)
      }
    }
    loadUserInfo()
  }, [])

  function handleLogout() {
    try { localStorage.removeItem('flipflop-user') } catch { }
    setUserInfo(null)
    window.location.href = '/'
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // --- FETCH LEADERBOARD ---
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      try {
        const res = await fetch(`/api/leaderboard?timeframe=${timeframe}`)
        const data = await res.json()

        if (data.ok && Array.isArray(data.users)) {
          const realData: LeaderboardEntry[] = data.users.map((u: any, i: number) => ({
            rank: i + 1,
            userId: u.id,
            username: u.name,
            avatar: u.avatar || DEFAULT_AVATAR,
            totalPoints: u.totalPoints,
            bankPoints: u.bankPoints,
            activeCards: u.activeCards
          }))

          // Mevcut kullanıcıyı bul
          let myId = ''
          try {
            const saved = localStorage.getItem('flipflop-user')
            if (saved) myId = JSON.parse(saved).id
          } catch { }

          const myEntry = realData.find(u => u.userId === myId)
          if (myEntry) {
            myEntry.isCurrentUser = true
            setCurrentUser(myEntry)
          }

          setLeaderboard(realData)
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [timeframe])

  const topThree = useMemo(() => leaderboard.slice(0, 3), [leaderboard])
  const restOfLeaderboard = useMemo(() => leaderboard.slice(3), [leaderboard])

  // Rank Styles Helper
  const getRankStyle = (rank: number) => {
    if (rank === 1) return { color: theme === 'light' ? '#d97706' : '#fbbf24', emoji: '🥇', className: 'rank-1' }
    if (rank === 2) return { color: theme === 'light' ? '#64748b' : '#e2e8f0', emoji: '🥈', className: 'rank-2' }
    if (rank === 3) return { color: theme === 'light' ? '#b45309' : '#d97706', emoji: '🥉', className: 'rank-3' }
    return { color: 'inherit', emoji: `#${rank}`, className: '' }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="FLIP ROYALE" className="logo" onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.src = '/logo.svg'
            target.onerror = () => {
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) parent.innerHTML = '<span class="dot"></span> FLIP ROYALE'
            }
          }} />
        </div>

        <nav className="tabs">
          <a className="tab" href="/">FLIP ROYALE</a>
          <a className="tab" href="/prices">PRICES</a>
          <a className="tab" href="/guide">GUIDE</a>
          <a className="tab" href="/inventory">INVENTORY</a>
          <a className="tab" href="/my-packs">MY PACKS</a>
          <a className="tab active" href="/leaderboard">LEADERBOARD</a>
          <a className="tab" href="/referrals">REFERRALS</a>
          <a className="tab" href="/history">HISTORY</a>
          <a className="tab" href="/profile">PROFILE</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {/* Connect X Button */}
          {userInfo && (
            xHandle ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 10,
                  color: '#86efac',
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
                title={`Connected as @${xHandle}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>@{xHandle}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            ) : (
              <button
                onClick={() => signIn('twitter', { callbackUrl: '/auth/callback' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: theme === 'light' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.2)',
                  border: `1px solid ${theme === 'light' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: 10,
                  color: theme === 'light' ? '#1d4ed8' : '#93c5fd',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = theme === 'light' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.3)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = theme === 'light' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.2)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>Connect X</span>
              </button>
            )
          )}
          <ThemeToggle />
          <a
            href="https://x.com/fliproyale"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 12,
              background: theme === 'light' ? 'rgba(10,44,33,0.1)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${theme === 'light' ? 'rgba(10,44,33,0.2)' : 'rgba(255,255,255,0.2)'}`,
              color: theme === 'light' ? '#0a2c21' : 'white',
              textDecoration: 'none'
            }}
            title="Follow us on X"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {userInfo ? (
            <>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.25)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                background: 'rgba(255,255,255,0.1)'
              }}>
                <img
                  src={userInfo.avatar || DEFAULT_AVATAR}
                  alt={userInfo.username}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{
                  background: theme === 'light' ? 'rgba(0,207,163,0.25)' : 'rgba(0,207,163,0.15)',
                  border: `1px solid ${theme === 'light' ? 'rgba(0,207,163,0.4)' : 'rgba(0,207,163,0.25)'}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: theme === 'light' ? '#059669' : '#86efac'
                }}>
                  {userInfo.points?.toLocaleString() || 0} pts
                </div>

                <button
                  onClick={handleLogout}
                  style={{
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <a href="/" style={{
              background: 'linear-gradient(135deg, var(--accent-green), var(--accent-2))',
              color: '#03120d',
              padding: '10px 20px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none'
            }}>
              Connect Wallet
            </a>
          )}
        </div>
      </header>

      <div className="panel" style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* HEADER & TIME FILTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ marginBottom: 8, fontSize: 24, fontWeight: 800 }}>Leaderboard</h2>
            <p className="muted">See who's dominating the crypto arena.</p>
          </div>

          <div style={{ display: 'flex', background: theme === 'light' ? '#f1f5f9' : 'rgba(255,255,255,0.1)', padding: 4, borderRadius: 12 }}>
            <button onClick={() => setTimeframe('all')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: timeframe === 'all' ? (theme === 'light' ? 'white' : 'rgba(255,255,255,0.2)') : 'transparent', color: theme === 'light' ? (timeframe === 'all' ? '#0f172a' : '#64748b') : 'white', fontWeight: 700, cursor: 'pointer', boxShadow: timeframe === 'all' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>All Time</button>
            <button onClick={() => setTimeframe('weekly')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: timeframe === 'weekly' ? (theme === 'light' ? 'white' : 'rgba(255,255,255,0.2)') : 'transparent', color: theme === 'light' ? (timeframe === 'weekly' ? '#0f172a' : '#64748b') : 'white', fontWeight: 700, cursor: 'pointer', boxShadow: timeframe === 'weekly' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>Weekly</button>
            <button onClick={() => setTimeframe('daily')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: timeframe === 'daily' ? (theme === 'light' ? 'white' : 'rgba(255,255,255,0.2)') : 'transparent', color: theme === 'light' ? (timeframe === 'daily' ? '#0f172a' : '#64748b') : 'white', fontWeight: 700, cursor: 'pointer', boxShadow: timeframe === 'daily' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>Today</button>
          </div>
        </div>

        {/* Podium */}
        {!loading && leaderboard.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, marginBottom: 40, marginTop: 40, flexWrap: 'wrap' }}>
            {topThree[1] && <PodiumCard entry={topThree[1]} theme={theme} getRankStyle={getRankStyle} style={{ order: 1, transform: 'scale(0.9)' }} />}
            {topThree[0] && <PodiumCard entry={topThree[0]} theme={theme} getRankStyle={getRankStyle} style={{ order: 2, zIndex: 2 }} isFirst />}
            {topThree[2] && <PodiumCard entry={topThree[2]} theme={theme} getRankStyle={getRankStyle} style={{ order: 3, transform: 'scale(0.9)' }} />}
          </div>
        )}

        {/* Current User Rank (Sticky) */}
        {currentUser && !loading && (
          <div style={{ background: theme === 'light' ? 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.1))', border: `1px solid ${theme === 'light' ? '#bae6fd' : 'rgba(59, 130, 246, 0.3)'}`, borderRadius: 16, padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: theme === 'light' ? '#0284c7' : '#60a5fa' }}>#{currentUser.rank}</div>
              <img src={currentUser.avatar} alt="Me" style={{ width: 40, height: 40, borderRadius: '50%' }} onError={(e) => (e.currentTarget.src = DEFAULT_AVATAR)} />
              <div style={{ fontWeight: 700 }}>You ({currentUser.username})</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme === 'light' ? '#0284c7' : '#60a5fa' }}>{currentUser.totalPoints.toLocaleString()} pts</div>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--border)', background: theme === 'light' ? 'white' : 'rgba(255,255,255,0.02)' }}>
          <div className="leaderboard-header" style={{ background: theme === 'light' ? '#f8fafc' : 'rgba(0,0,0,0.2)', padding: '16px 24px' }}>
            <div style={{ opacity: 0.6, fontSize: 12, letterSpacing: 1 }}>RANK</div>
            <div style={{ opacity: 0.6, fontSize: 12, letterSpacing: 1 }}>PLAYER</div>
            <div style={{ textAlign: 'right', opacity: 0.6, fontSize: 12, letterSpacing: 1 }}>TOTAL POINTS</div>
          </div>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>Loading rankings...</div>
          ) : (
            <div>
              {restOfLeaderboard.map((entry) => {
                const rs = getRankStyle(entry.rank)
                return (
                  <div key={entry.userId} className="leaderboard-row" style={{
                    background: entry.isCurrentUser ? (theme === 'light' ? '#f0f9ff' : 'rgba(59,130,246,0.1)') : undefined,
                    padding: '16px 24px',
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr 150px',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border)'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }} className={rs.className}>{entry.rank}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={entry.avatar} alt={entry.username} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.src = DEFAULT_AVATAR)} />
                      <span style={{ fontWeight: entry.isCurrentUser ? 700 : 600 }}>{entry.username}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: 16 }}>{entry.totalPoints.toLocaleString()}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// Sub-component
function PodiumCard({ entry, theme, getRankStyle, style, isFirst }: any) {
  const rs = getRankStyle(entry.rank)
  return (
    <div className="panel" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24,
      flex: isFirst ? '0 0 180px' : '0 0 150px',
      border: isFirst ? `2px solid ${rs.color}` : `1px solid var(--border)`,
      background: theme === 'light' ? 'white' : 'rgba(255,255,255,0.03)',
      ...style
    }}>
      <div style={{ fontSize: isFirst ? 36 : 24, marginBottom: 12 }}>{rs.emoji}</div>
      <div style={{ width: isFirst ? 80 : 60, height: isFirst ? 80 : 60, borderRadius: '50%', overflow: 'hidden', marginBottom: 16, boxShadow: `0 8px 24px ${rs.color}40`, border: `3px solid ${rs.color}` }}>
        <img src={entry.avatar} alt={entry.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.src = DEFAULT_AVATAR)} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, textAlign: 'center' }}>{entry.username}</div>
      <div style={{ fontWeight: 900, fontSize: 20, color: rs.color }}>{entry.totalPoints.toLocaleString()}</div>
    </div>
  )
}
