import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useToast } from '../lib/toast'
import Topbar from '../components/Topbar'
import { TOKENS, getTokenById } from '../lib/tokens'

function getGradientColor(index: number) {
  const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6']
  return colors[index % colors.length]
}

function handleImageFallback(e: any) {
  const target = e.currentTarget as HTMLImageElement
  if (target.dataset.fallbackApplied === '1') return
  target.dataset.fallbackApplied = '1'
  target.onerror = null
  target.src = '/token-logos/placeholder.png'
}

export default function MyPacksPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [packs, setPacks] = useState<Record<string, number>>({})
  const [opening, setOpening] = useState(false)
  const [showMysteryResults, setShowMysteryResults] = useState<{ open: boolean; cards: string[] }>({ open: false, cards: [] })
  const router = useRouter()
  const { toast } = useToast()

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
      const res = await fetch(`/api/users/me?userId=${encodeURIComponent(user.id)}&_t=${Date.now()}`)
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
    if (!user?.id) return toast('Please login first', 'error')
    setOpening(true)
    try {
      const res = await fetch('/api/users/openPack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user.id).toLowerCase() },
        body: JSON.stringify({ userId: String(user.id).toLowerCase(), packType })
      })
      const data = await res.json()
      if (!res.ok) return toast(data?.error || 'Failed to open pack', 'error')
      // show results then reload packs using modal
      setShowMysteryResults({ open: true, cards: data.newCards || [] })
      await loadPacks()
      // refresh user cache on client
      try { localStorage.setItem('flipflop-user', JSON.stringify(data.user)) } catch { }
    } catch (e) {
      console.error(e)
      toast('Connection error', 'error')
    } finally { setOpening(false) }
  }

  async function openAll(packType: string) {
    if (!user?.id) return toast('Please login first', 'error')
    const count = packs[packType] || 0
    if (count < 1) return toast('No packs to open', 'error')
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
      setShowMysteryResults({ open: true, cards: totalNewCards })
      await loadPacks()
      try {
        const meRes = await fetch(`/api/users/me?userId=${encodeURIComponent(user.id)}&_t=${Date.now()}`)
        if (meRes.ok) {
          const meData = await meRes.json()
          if (meData?.user) {
            localStorage.setItem('flipflop-user', JSON.stringify(meData.user))
          }
        }
      } catch { }
    } catch (e) {
      console.error(e)
      toast('Connection error while opening packs', 'error')
    } finally { setOpening(false) }
  }

  function addMysteryToInventory() {
    // close modal and reload packs/user
    setShowMysteryResults({ open: false, cards: [] })
    // Refresh packs and local user data
    loadPacks()
    try {
      const saved = localStorage.getItem('flipflop-user')
      if (saved) setUser(JSON.parse(saved))
    } catch { }
  }

  if (!user) {
    return (
      <div className="app">
        <Topbar activeTab="my-packs" user={null} />
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
      <Topbar activeTab="my-packs" user={user} />

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
                {Object.entries(packs).map(([type, count]) => {
                  // Determine image source based on type
                  const isRare = type.toLowerCase().includes('rare')
                  const imgSrc = isRare ? '/rare-pack.jpg' : '/common-pack.jpg'
                  const color = isRare ? '#fbbf24' : '#94a3b8'
                  const borderColor = isRare ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)'
                  const bgGradient = isRare
                    ? 'linear-gradient(180deg, rgba(30,27,75,0.8), rgba(23,37,84,0.6))'
                    : 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(11,19,36,0.6))'

                  return (
                    <div key={type} style={{
                      width: 240,
                      padding: 12,
                      borderRadius: 16,
                      background: bgGradient,
                      border: `1px solid ${borderColor}`,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      {/* Image Container */}
                      <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <img src={imgSrc} alt={`${type} Pack`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                          <div style={{ color: 'white', fontWeight: 800, textAlign: 'center', textShadow: '0 2px 4px black' }}>{count}x</div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 900, fontSize: 16, color: color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{type} PACK</div>
                      </div>

                      <div style={{ display: 'grid', gap: 8 }}>
                        <button className="btn" style={{ fontSize: 14, padding: '8px 16px' }} onClick={() => openPack(type)} disabled={opening}>
                          Open One
                        </button>
                        {count > 1 && (
                          <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => openAll(type)} disabled={opening}>
                            Open All ({count})
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        )}
      </div>
      {/* Mystery Pack Results Modal */}
      {showMysteryResults.open && (
        <div className="modal-backdrop" onClick={() => setShowMysteryResults({ open: false, cards: [] })}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '96%' }}>
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: 26, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2 }}>Mystery Pack Results</h3>
              <button onClick={() => setShowMysteryResults({ open: false, cards: [] })} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              {showMysteryResults.cards.map((id, idx) => {
                const tok = getTokenById(id) || TOKENS[0]
                return (
                  <div key={idx} style={{ background: `linear-gradient(135deg, ${getGradientColor(idx)}, ${getGradientColor(idx + 1)})`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, border: '1px solid rgba(255,255,255,.22)', boxShadow: '0 14px 32px rgba(0,0,0,0.28)' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,.3)', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>
                      <img src={tok.logo} alt={tok.symbol} style={{ width: 94, height: 94, borderRadius: '50%', objectFit: 'cover' }} onError={handleImageFallback} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 900, color: '#fff', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>{tok.symbol}</div>
                      <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, marginTop: 4 }}>{tok.name}</div>
                      {tok.about && (<div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 1.5, marginTop: 2, textTransform: 'uppercase' }}>{tok.about}</div>)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn primary" onClick={addMysteryToInventory} style={{ marginRight: 8 }}>Add to Inventory</button>
              <button className="btn" onClick={() => setShowMysteryResults({ open: false, cards: [] })}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
