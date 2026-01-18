import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useToast } from '../lib/toast'
import Topbar from '../components/Topbar'
import { TOKENS, getTokenById } from '../lib/tokens'
import { PACK_INFO } from '../lib/contracts/packShopV2'

// Card CSS Styles - consistent with index.tsx and inventory.tsx
interface CardCSSStyles {
  background: string;
  borderColor: string;
  boxShadow: string;
  ringColor: string;
  ringGlow: string;
  textColor: string;
  typeColor: string;
}

function getCardCSSStyles(type: string): CardCSSStyles {
  const styles: Record<string, CardCSSStyles> = {
    pegasus: {
      background: 'linear-gradient(180deg, #2d5a3f 0%, #1a3a28 50%, #050a07 100%)',
      borderColor: '#4a7c59',
      boxShadow: '0 0 15px rgba(74, 124, 89, 0.3)',
      ringColor: '#7cb342',
      ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342, 0 0 45px rgba(124, 179, 66, 0.6), inset 0 0 15px rgba(124, 179, 66, 0.3)',
      textColor: '#ffffff',
      typeColor: '#4ade80',
    },
    genesis: {
      background: 'linear-gradient(180deg, #6b3d8f 0%, #4a2c6a 50%, #0a0510 100%)',
      borderColor: '#7c4a9e',
      boxShadow: '0 0 15px rgba(124, 74, 158, 0.3)',
      ringColor: '#9c27b0',
      ringGlow: '0 0 15px #9c27b0, 0 0 30px #9c27b0, 0 0 45px rgba(156, 39, 176, 0.6), inset 0 0 15px rgba(156, 39, 176, 0.3)',
      textColor: '#ffffff',
      typeColor: '#c084fc',
    },
    unicorn: {
      background: 'linear-gradient(180deg, #f0c14b 0%, #daa520 50%, #4a3000 100%)',
      borderColor: '#daa520',
      boxShadow: '0 0 15px rgba(218, 165, 32, 0.3)',
      ringColor: '#ffd700',
      ringGlow: '0 0 15px #ffd700, 0 0 30px #ffd700, 0 0 45px rgba(255, 215, 0, 0.6), inset 0 0 15px rgba(255, 215, 0, 0.3)',
      textColor: '#ffffff',
      typeColor: '#78350f',
    },
    sentient: {
      background: 'linear-gradient(180deg, #2a4a6a 0%, #1a3050 50%, #050a10 100%)',
      borderColor: '#3a5a8a',
      boxShadow: '0 0 15px rgba(58, 90, 138, 0.3)',
      ringColor: '#2196f3',
      ringGlow: '0 0 15px #2196f3, 0 0 30px #2196f3, 0 0 45px rgba(33, 150, 243, 0.6), inset 0 0 15px rgba(33, 150, 243, 0.3)',
      textColor: '#ffffff',
      typeColor: '#60a5fa',
    },
    firstborn: {
      background: 'linear-gradient(180deg, #2d5a3f 0%, #1a3a28 50%, #050a07 100%)',
      borderColor: '#4a7c59',
      boxShadow: '0 0 15px rgba(74, 124, 89, 0.3)',
      ringColor: '#7cb342',
      ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342, 0 0 45px rgba(124, 179, 66, 0.6), inset 0 0 15px rgba(124, 179, 66, 0.3)',
      textColor: '#ffffff',
      typeColor: '#4ade80',
    },
  };
  return styles[type?.toLowerCase()] || styles.sentient;
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
                  const typeKey = type.toLowerCase() as any
                  const info = PACK_INFO[typeKey]

                  // Use info if available, otherwise fallbacks
                  const imgSrc = info?.image || (type.includes('rare') ? '/rare-pack.jpg' : '/common-pack.jpg')
                  const color = info?.color || (type.includes('rare') ? '#fbbf24' : '#94a3b8')
                  const borderColor = info?.color ? `${info.color}40` : (type.includes('rare') ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)')
                  const bgGradient = info?.bgGradient || (type.includes('rare')
                    ? 'linear-gradient(180deg, rgba(30,27,75,0.8), rgba(23,37,84,0.6))'
                    : 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(11,19,36,0.6))')

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
                        <img src={imgSrc} alt={`${type} Pack`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1100, width: '96%' }}>
            <div className="modal-header">
              <h3 style={{ color: 'white', fontSize: 26, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2 }}>Mystery Pack Results</h3>
              <button onClick={() => setShowMysteryResults({ open: false, cards: [] })} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 20,
              marginBottom: 16,
              justifyContent: 'center',
              maxHeight: '60vh',
              overflowY: 'auto',
              padding: 10
            }}>
              {showMysteryResults.cards.map((id, idx) => {
                const tok = getTokenById(id) || TOKENS[0]
                const cardStyles = getCardCSSStyles(tok.about)

                return (
                  <div key={idx} className="card-texture" style={{
                    background: cardStyles.background,
                    border: `3px solid ${cardStyles.borderColor}`,
                    boxShadow: cardStyles.boxShadow,
                    borderRadius: 16,
                    padding: 0,
                    position: 'relative',
                    height: 340,
                    width: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>

                    {/* Glowing ring */}
                    <div style={{
                      position: 'absolute',
                      top: '22%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      border: `3px solid ${cardStyles.ringColor}`,
                      boxShadow: cardStyles.ringGlow,
                      pointerEvents: 'none'
                    }} />

                    {/* Token Logo */}
                    <div style={{
                      position: 'absolute',
                      top: '22%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 110,
                      height: 110,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      zIndex: 5
                    }}>
                      <img
                        src={tok.logo}
                        alt={tok.symbol}
                        style={{
                          width: 106,
                          height: 106,
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                        onError={handleImageFallback}
                      />
                    </div>

                    {/* Token Name & Type */}
                    <div style={{
                      position: 'absolute',
                      top: '45%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      textAlign: 'center',
                      width: '90%'
                    }}>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: cardStyles.textColor,
                        letterSpacing: 0.5
                      }}>
                        {tok.symbol}
                      </div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: cardStyles.typeColor,
                        marginTop: 2
                      }}>
                        {tok.about}
                      </div>
                    </div>

                    {/* FLIP ROYALE Badge */}
                    <div style={{
                      position: 'absolute',
                      bottom: -2,
                      left: '50%',
                      transform: 'translateX(-50%)'
                    }}>
                      <img
                        src="/logo.png"
                        alt="Flip Royale"
                        style={{
                          height: 48,
                          width: 'auto',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
                        }}
                      />
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
