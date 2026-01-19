import { useEffect, useState, ChangeEvent } from 'react'
import { useToast } from '../lib/toast'
import { useRouter } from 'next/router'
import Topbar from '../components/Topbar'
import ThemeToggle from '../components/ThemeToggle'
import { useDisconnect } from 'wagmi'

const DEFAULT_AVATAR = '/avatars/default-avatar.png'

type User = {
  id: string
  username: string
  name?: string
  walletAddress?: string
  hasChangedUsername?: boolean
  createdAt: string | number
  lastLogin: string | number
  avatar?: string
  totalPoints: number
  bankPoints: number
  currentRound: number
  inventory?: Record<string, number>
  roundHistory?: any[]
}

type RoundHistory = {
  dayKey: string
  roundNumber?: number
  items: Array<{
    symbol: string
    dir: 'UP' | 'DOWN'
    points: number
    duplicateIndex: number
  }>
  totalPoints: number
}

export default function Profile() {
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const { toast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [history, setHistory] = useState<RoundHistory[]>([])
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [isAddingReferral, setIsAddingReferral] = useState(false)

  const saveName = async () => {
    if (!user || !tempName.trim()) return
    if (tempName.length < 3) return toast("Username must be at least 3 characters.", 'error')

    try {
      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, username: tempName })
      })
      const data = await res.json()
      if (data.ok) {
        const updatedUser = { ...user, username: tempName, name: tempName, hasChangedUsername: true }
        setUser(updatedUser)
        setIsEditingName(false)
        try { localStorage.setItem('flipflop-user', JSON.stringify(updatedUser)) } catch { }
      } else {
        toast(data.error || 'Failed to update username', 'error')
      }
    } catch (e) {
      console.error(e)
      toast('Connection error', 'error')
    }
  }

  const handleAddReferral = async () => {
    if (!user || !referralCode.trim()) return
    if (referralCode.length < 6) return toast("Referral code must be at least 6 characters.", 'error')

    setIsAddingReferral(true)
    try {
      const res = await fetch('/api/referral/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, referralCode: referralCode.toUpperCase() })
      })
      const data = await res.json()
      if (data.ok) {
        const updatedUser = { ...user, referredBy: data.referredBy }
        setUser(updatedUser)
        setReferralCode('')
        toast('✅ Referral code added successfully! Your next pack purchase will give commission to your referrer.', 'success')
        try { localStorage.setItem('flipflop-user', JSON.stringify(updatedUser)) } catch { }
      } else {
        toast(data.error || 'Failed to add referral code', 'error')
      }
    } catch (e) {
      console.error(e)
      toast('Connection error', 'error')
    } finally {
      setIsAddingReferral(false)
    }
  }

  useEffect(() => {
    setMounted(true)

    async function load() {
      const savedUser = localStorage.getItem('flipflop-user')
      let userId = ''
      if (savedUser) {
        try { userId = JSON.parse(savedUser).id } catch { }
      }
      if (!userId) {
        // Instead of redirecting to outdated /auth, we just let it render the empty state
        // window.location.href = '/auth'
        setLoading(false)
        return
      }

      try {
        const r = await fetch(`/api/users/me?userId=${encodeURIComponent(userId)}`)
        const j = await r.json()
        if (j.ok && j.user) {
          setUser(j.user)
          if (Array.isArray(j.user.roundHistory)) {
            // Map and sort by date descending (newest first)
            const mappedHistory = j.user.roundHistory
              .map((h: any) => ({
                dayKey: h.date,
                roundNumber: h.roundNumber,
                totalPoints: h.totalPoints,
                items: h.items || []
              }))
              .sort((a: any, b: any) => {
                // Sort by date descending (newest first)
                const dateA = new Date(a.dayKey).getTime()
                const dateB = new Date(b.dayKey).getTime()
                return dateB - dateA
              })
            setHistory(mappedHistory)
          }
        }
      } catch (e) { console.error(e) } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 1 * 1024 * 1024) {
      toast("File is too large. Please choose an image under 1MB.", 'error')
      return
    }

    setIsUploading(true)

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const base64data = reader.result as string

      try {
        const res = await fetch('/api/users/update-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, avatarData: base64data })
        })

        const data = await res.json()
        if (data.ok) {
          setUser({ ...user, avatar: base64data })
          const saved = localStorage.getItem('flipflop-user')
          if (saved) {
            const parsed = JSON.parse(saved)
            localStorage.setItem('flipflop-user', JSON.stringify({ ...parsed, avatar: base64data }))
          }
        } else {
          toast("Failed to update avatar: " + (data.error || 'Unknown error'), 'error')
        }
      } catch (error) {
        console.error("Avatar update error:", error)
        toast("An error occurred while uploading.", 'error')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleLogout = () => {
    disconnect()
    try {
      localStorage.removeItem('flipflop-user')
      localStorage.removeItem('flipflop-next')
      localStorage.removeItem('flipflop-next-saved')
      localStorage.removeItem('flipflop-last-settled-day')
    } catch { }
    window.location.href = '/auth'
  }

  if (!mounted || loading) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="muted">Loading profile...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <Topbar activeTab="profile" user={null} />

        <div className="panel">
          <h2>Profile</h2>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-inv)' }}>
            <p style={{ fontSize: 18, marginBottom: 20 }}>Please connect your wallet to view your profile.</p>
            <a href="/" className="btn primary">Go to Play</a>
          </div>
        </div>
      </div>
    )
  }

  const displayName = user.username || user.name || (user.id ? user.id.substring(0, 8) : 'Unknown Player')
  const totalPoints = user.totalPoints || 0
  const totalRounds = user.currentRound ? user.currentRound - 1 : 0
  const averagePoints = totalRounds > 0 ? Math.round(totalPoints / totalRounds) : 0
  const cardsCollected = user.inventory
    ? Object.values(user.inventory).reduce((sum: number, count: any) => sum + Number(count), 0)
    : 0
  const packsOpened = Math.ceil(cardsCollected / 5)

  return (
    <div className="app">
      <Topbar activeTab="profile" user={user} />

      <div className="panel">
        <h2>Profile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 30 }}>
          <div style={{ background: 'var(--card-2)', padding: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Account Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                  <img src={user.avatar || DEFAULT_AVATAR} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR }} />
                </div>
                <div>
                  <label className={`btn primary ${isUploading ? 'disabled' : ''}`} style={{ display: 'inline-block', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: 13, padding: '8px 16px', opacity: isUploading ? 0.7 : 1 }}>
                    {isUploading ? 'Uploading...' : 'Change Photo'}
                    <input type="file" accept="image/*" disabled={isUploading} style={{ display: 'none' }} onChange={handleAvatarChange} />
                  </label>
                </div>
              </div>
              <div>
                <div className="muted" style={{ marginBottom: 4 }}>Username</div>

                {user.hasChangedUsername ? (
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{displayName} <span className="badge" style={{ fontSize: 10, opacity: 0.7 }}>VERIFIED</span></div>
                ) : isEditingName ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15))}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'white', borderRadius: 6, padding: '4px 8px', width: 140 }}
                    />
                    <button className="btn primary" onClick={saveName} disabled={loading} style={{ padding: '4px 8px', fontSize: 12 }}>Save</button>
                    <button className="btn ghost" onClick={() => setIsEditingName(false)} style={{ padding: '4px 8px', fontSize: 12 }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{displayName}</div>
                    <button
                      className="btn ghost"
                      onClick={() => { setTempName(user.username || ''); setIsEditingName(true) }}
                      style={{ padding: '2px 6px', fontSize: 10, height: 'auto' }}
                      title="You can change your username once."
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}
              </div>
              <div><div className="muted" style={{ marginBottom: 4 }}>Member Since</div><div style={{ fontSize: 16, fontWeight: 600 }}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</div></div>
            </div>
          </div>
          <div style={{ background: 'var(--card-2)', padding: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Game Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card)', borderRadius: 12 }}>
                <div className="muted">Total Points</div><div className="points good" style={{ fontSize: 20 }}>{totalPoints.toLocaleString()}</div>
              </div>
              <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card)', borderRadius: 12 }}>
                <div className="muted">Rounds Played</div><div style={{ fontSize: 20, fontWeight: 700 }}>{totalRounds}</div>
              </div>
              <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card)', borderRadius: 12 }}>
                <div className="muted">Average Points</div><div style={{ fontSize: 20, fontWeight: 700 }}>{averagePoints.toLocaleString()}</div>
              </div>
              <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card)', borderRadius: 12 }}>
                <div className="muted">Packs Opened</div><div style={{ fontSize: 20, fontWeight: 700 }}>{packsOpened}</div>
              </div>
              <div className="stat-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card)', borderRadius: 12 }}>
                <div className="muted">Cards Collected</div><div style={{ fontSize: 20, fontWeight: 700 }}>{cardsCollected}</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--card-2)', padding: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>🎁 Referral System</h3>
            {(user as any).referredBy ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div className="muted" style={{ marginBottom: 4 }}>Referred By</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', background: 'var(--card)', padding: '8px 12px', borderRadius: 8 }}>
                    {(user as any).referredBy}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  ✅ You're linked! Your pack purchases give 10% commission to your referrer.
                </div>
                {(user as any).totalReferrals > 0 && (
                  <div>
                    <div className="muted" style={{ marginBottom: 4 }}>Your Referrals</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
                      {(user as any).totalReferrals} users
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  📌 Forgot to use a referral code when you signed up? No problem! Add one now and your next pack purchase will give 10% commission to your referrer.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Enter referral code"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    disabled={isAddingReferral}
                    style={{
                      flex: 1,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'white',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  />
                  <button
                    className="btn primary"
                    onClick={handleAddReferral}
                    disabled={isAddingReferral || !referralCode.trim()}
                    style={{
                      padding: '10px 20px',
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      opacity: (isAddingReferral || !referralCode.trim()) ? 0.6 : 1,
                      cursor: (isAddingReferral || !referralCode.trim()) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isAddingReferral ? 'Adding...' : 'Add Code'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>Round History</h3>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, borderRadius: 12, border: '2px dashed var(--border)', color: 'var(--muted-inv)' }}>No rounds played yet. Start playing to see your history!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {history.map((round, index) => {
                const roundTotal = round.totalPoints || 0
                const picks = Array.isArray(round.items) ? round.items : []
                // Use actual roundNumber from database if available, otherwise calculate from position
                // history is sorted newest first, so we need to reverse the index for display
                const displayRoundNumber = round.roundNumber || (history.length - index)
                return (
                  <div key={round.dayKey} style={{ background: 'var(--card-2)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="badge">Round #{displayRoundNumber}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{new Date(round.dayKey).toLocaleDateString()}</div></div>
                      <div className={`points ${roundTotal >= 0 ? 'good' : 'bad'}`} style={{ fontSize: 18 }}>{roundTotal > 0 ? '+' : ''}{roundTotal.toLocaleString()} pts</div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {picks.map((pick: any, pickIndex: number) => (
                        <div key={pickIndex} style={{ background: 'var(--card)', padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={pick.dir === 'UP' ? 'dir-up' : 'dir-down'} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{pick.dir === 'UP' ? '▲' : '▼'}</span>
                          <span>${pick.symbol}</span>
                          {pick.duplicateIndex > 1 && (<span style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>x{pick.duplicateIndex}</span>)}
                          <span className={pick.points >= 0 ? 'points good' : 'points bad'} style={{ fontSize: 12, marginTop: 0 }}>{pick.points > 0 ? '+' : ''}{pick.points}</span>
                        </div>
                      ))}
                    </div>
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