import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import Topbar from '../components/Topbar'
import { TOKENS } from '../lib/tokens'

function handleImageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget
  if (target.dataset.fallbackApplied === '1') return
  target.dataset.fallbackApplied = '1'
  target.onerror = null
  target.src = '/token-logos/placeholder.png'
}

// Card CSS Styles - same as index.tsx
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

export default function Inventory() {
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const [user, setUser] = useState<any>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const savedUser = localStorage.getItem('flipflop-user')
      let userId = ''
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser)
          setUser(u)
          userId = u.id
        } catch { }
      }

      if (userId) {
        try {
          const r = await fetch(`/api/users/me?userId=${encodeURIComponent(userId)}`)
          const j = await r.json()
          if (j.ok && j.user) {
            setUser(j.user)
            if (j.user.inventory) setInventory(j.user.inventory)
          }
        } catch (e) { console.error(e) }
      }
    }
    load()
  }, [])

  const filterButtons = [
    { key: 'all', label: 'All', color: '#ffffff' },
    { key: 'unicorn', label: 'Unicorn', color: '#ffd700' },
    { key: 'pegasus', label: 'Pegasus', color: '#4ade80' },
    { key: 'genesis', label: 'Genesis', color: '#c084fc' },
    { key: 'sentient', label: 'Sentient', color: '#60a5fa' },
  ]

  const filteredTokens = TOKENS.filter(t => {
    const hasInventory = (inventory[t.id] || 0) > 0
    if (!hasInventory) return false
    if (filter === 'all') return true
    return t.about?.toLowerCase() === filter
  })

  return (
    <div className="app">
      <Topbar activeTab="inventory" user={user} />

      <div className="panel">
        <h2>Token Collection</h2>
        <div className="sep"></div>

        {/* Filter Buttons */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 16,
          marginBottom: 20,
          flexWrap: 'wrap'
        }}>
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: filter === btn.key ? `2px solid ${btn.color}` : '2px solid rgba(255,255,255,0.2)',
                background: filter === btn.key ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)',
                color: btn.color,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'flex-start'
        }}>
          {filteredTokens.map((tok) => {
            const count = inventory[tok.id] || 0
            const cardStyles = getCardCSSStyles(tok.about)

            return (
              <div key={tok.id} className="card-texture" style={{
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
                cursor: 'pointer',
                overflow: 'hidden',
                flexShrink: 0
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                }}>

                {/* Count badge */}
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.75)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontWeight: 700,
                  zIndex: 10
                }}>
                  x{count}
                </div>

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

                {/* Owned count display */}
                <div style={{
                  position: 'absolute',
                  top: '68%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.4)',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center'
                }}>
                  Owned: {count}
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
      </div>
    </div>
  )
}
