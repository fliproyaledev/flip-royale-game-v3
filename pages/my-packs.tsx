import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/ThemeToggle'

export default function MyPacksPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [packs, setPacks] = useState<Record<string, number>>({})
  const [opening, setOpening] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('flipflop-user')
    if (saved) {
      try { setUser(JSON.parse(saved)) } catch { setUser(null) }
    }
    if (!saved) {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return setLoading(false)
    loadPacks()
  }, [user])

  async function loadPacks() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/me?userId=${encodeURIComponent(user.id)}`)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data?.error || 'Unable to load user')
        setPacks({})
      } else {
        const inv = data.user.inventory || {}
        // find pack keys: keys that end with '_pack' or are exactly 'common'/'rare'
        const packCounts: Record<string, number> = {}
        for (const k of Object.keys(inv)) {
          if (/_pack$/.test(k) || k === 'common' || k === 'rare') {
            const normalized = k.replace(/_pack$/, '')
            packCounts[normalized] = (packCounts[normalized] || 0) + (inv[k] || 0)
          }
        }
        setPacks(packCounts)
      }
    } catch (e: any) {
      setError(e?.message || 'Error')
      setPacks({})
    } finally {
      setLoading(false)
    }
  }

  async function openPack(packType: string) {
    if (!user?.id) return alert('Please login first')
    setOpening(true)
    try {
      const res = await fetch('/api/users/openPack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user.id).toLowerCase() },
        body: JSON.stringify({ userId: String(user.id).toLowerCase(), packType })
      })
      const data = await res.json()
      if (!res.ok) return alert(data?.error || 'Failed to open pack')
      // show results then reload packs
      alert(`You opened ${data.newCards?.length || 0} cards.`)
      loadPacks()
      // refresh user cache on client
      try { localStorage.setItem('flipflop-user', JSON.stringify(data.user)) } catch {}
    } catch (e) {
      console.error(e)
      alert('Connection error')
    } finally { setOpening(false) }
  }

  async function openAll(packType: string) {
    if (!user?.id) return alert('Please login first')
    const count = packs[packType] || 0
    if (count < 1) return alert('No packs to open')
    setOpening(true)
    try {
      let totalNewCards: string[] = []
      for (let i = 0; i < count; i++) {
        const res = await fetch('/api/users/openPack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(user.id).toLowerCase() },
          body: JSON.stringify({ userId: String(user.id).toLowerCase(), packType })
        })
        const data = await res.json()
        if (!res.ok) {
          console.warn('Open pack failed on iteration', i, data)
          break
        }
        totalNewCards = totalNewCards.concat(data.newCards || [])
      }
      alert(`Opened ${totalNewCards.length} card(s) from ${count} pack(s).`)
      await loadPacks()
      try {
        const meRes = await fetch(`/api/users/me?userId=${encodeURIComponent(user.id)}`)
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData?.user) {
            localStorage.setItem('flipflop-user', JSON.stringify(meData.user))
          }
        }
      } catch {}
    } catch (e) {
      console.error(e)
      alert('Connection error while opening packs')
    } finally { setOpening(false) }
  }

  if (!user) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand"><img src="/logo.png" alt="FLIP ROYALE" className="logo" /></div>
          <nav className="tabs">
            <a className="tab" href="/">PLAY</a>
            <a className="tab" href="/prices">PRICES</a>
            <a className="tab" href="/arena">ARENA</a>
            <a className="tab active" href="/my-packs">MY PACKS</a>
          </nav>
          <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
        </header>
        <div className="panel">
          <h2>My Packs</h2>
          <div style={{ padding: 24 }}>
            <p>Please connect / login to view your packs.</p>
            <button className="btn" onClick={() => router.push('/')}>Go to Play</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><img src="/logo.png" alt="FLIP ROYALE" className="logo" /></div>
        <nav className="tabs">
          <a className="tab" href="/">PLAY</a>
          <a className="tab" href="/prices">PRICES</a>
          <a className="tab" href="/arena">ARENA</a>
          <a className="tab active" href="/my-packs">MY PACKS</a>
        </nav>
        <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
      </header>

      <div className="panel">
        <div className="row">
          <h2>My Packs</h2>
        </div>

        {loading ? (
          <div style={{ padding: 48 }}>Loading...</div>
        ) : (
          <div>
            {error && <div style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</div>}

            {Object.keys(packs).length === 0 ? (
              <div style={{ padding: 24 }}>You have no unopened packs.</div>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(packs).map(([type, count]) => (
                  <div key={type} style={{ width: 220, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight: 800, marginBottom: 8, color: 'white' }}>{type.toUpperCase()} PACK</div>
                    <div style={{ marginBottom: 12, color: '#94a3b8' }}>{count} pack(s)</div>
                    <button className="btn" style={{ marginBottom: 8 }} onClick={() => openPack(type)} disabled={opening}>Open One</button>
                    <button className="btn ghost" onClick={() => openAll(type)} disabled={opening}>Open All ({count})</button>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
