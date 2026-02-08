import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import Head from 'next/head'
import Topbar from '../components/Topbar'
import { TOKENS } from '../lib/tokens'
import { RENEWAL_PRICES, CardType, DURABILITY_DAYS } from '../lib/cardInstance'
import { useAccount, useReadContract } from 'wagmi'
import { ERC20_ABI, VIRTUAL_TOKEN_ADDRESS, weiToFlip } from '../lib/contracts/packShopV2'

interface CardInstanceData {
  id: string;
  tokenId: string;
  cardType: CardType;
  durability: number;
  status: 'active' | 'expired' | 'wrecked';
  visualState: 'fresh' | 'normal' | 'fading' | 'critical' | 'expired' | 'wrecked';
  expiresAt: number;
  acquiredAt: number;
}

function handleImageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const target = event.currentTarget
  if (target.dataset.fallbackApplied === '1') return
  target.dataset.fallbackApplied = '1'
  target.onerror = null
  target.src = '/token-logos/placeholder.png'
}

// Card CSS Styles
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
      ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342, 0 0 45px rgba(124, 179, 66, 0.6)',
      textColor: '#ffffff',
      typeColor: '#4ade80',
    },
    genesis: {
      background: 'linear-gradient(180deg, #6b3d8f 0%, #4a2c6a 50%, #0a0510 100%)',
      borderColor: '#7c4a9e',
      boxShadow: '0 0 15px rgba(124, 74, 158, 0.3)',
      ringColor: '#9c27b0',
      ringGlow: '0 0 15px #9c27b0, 0 0 30px #9c27b0, 0 0 45px rgba(156, 39, 176, 0.6)',
      textColor: '#ffffff',
      typeColor: '#c084fc',
    },
    unicorn: {
      background: 'linear-gradient(180deg, #f0c14b 0%, #daa520 50%, #4a3000 100%)',
      borderColor: '#daa520',
      boxShadow: '0 0 15px rgba(218, 165, 32, 0.3)',
      ringColor: '#ffd700',
      ringGlow: '0 0 15px #ffd700, 0 0 30px #ffd700, 0 0 45px rgba(255, 215, 0, 0.6)',
      textColor: '#ffffff',
      typeColor: '#78350f',
    },
    sentient: {
      background: 'linear-gradient(180deg, #2a4a6a 0%, #1a3050 50%, #050a10 100%)',
      borderColor: '#3a5a8a',
      boxShadow: '0 0 15px rgba(58, 90, 138, 0.3)',
      ringColor: '#2196f3',
      ringGlow: '0 0 15px #2196f3, 0 0 30px #2196f3, 0 0 45px rgba(33, 150, 243, 0.6)',
      textColor: '#ffffff',
      typeColor: '#60a5fa',
    },
    firstborn: {
      background: 'linear-gradient(180deg, #2d5a3f 0%, #1a3a28 50%, #050a07 100%)',
      borderColor: '#4a7c59',
      boxShadow: '0 0 15px rgba(74, 124, 89, 0.3)',
      ringColor: '#7cb342',
      ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342, 0 0 45px rgba(124, 179, 66, 0.6)',
      textColor: '#ffffff',
      typeColor: '#4ade80',
    },
  };
  return styles[type?.toLowerCase()] || styles.sentient;
}

function getDurabilityColor(visualState: string): string {
  switch (visualState) {
    case 'fresh': return '#22c55e';
    case 'normal': return '#eab308';
    case 'fading': return '#f97316';
    case 'critical': return '#ef4444';
    case 'expired': return '#6b7280';
    case 'wrecked': return '#dc2626';
    default: return '#6b7280';
  }
}

function getRemainingUses(card: any): number {
  if (card.remainingDays !== undefined) return card.remainingDays;
  // Legacy fallback: Return FULL duration per user request (Reset)
  return DURABILITY_DAYS[card.cardType as CardType] || 5;
}

export default function Inventory() {
  const { address } = useAccount()
  const [cards, setCards] = useState<CardInstanceData[]>([])
  const [user, setUser] = useState<any>(null)
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [renewingCardId, setRenewingCardId] = useState<string | null>(null)
  const [showRenewModal, setShowRenewModal] = useState<CardInstanceData | null>(null)

  // Real-time FLIP balance check
  const { data: flipBalanceData, refetch: refetchBalance } = useReadContract({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  const realFlipBalance = flipBalanceData ? weiToFlip(flipBalanceData as bigint) : (user?.flip || 0);


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
          // Get user data
          const userRes = await fetch(`/api/users/me?userId=${encodeURIComponent(userId)}`)
          const userData = await userRes.json()
          if (userData.ok && userData.user) {
            setUser(userData.user)
          }

          // Get card instances with durability
          const cardsRes = await fetch(`/api/cards/inventory?wallet=${encodeURIComponent(userId)}`)
          const cardsData = await cardsRes.json()

          // If no cards locally, try to sync from Oracle (for old purchases)
          if (cardsData.ok && (!cardsData.cards || cardsData.cards.length === 0)) {
            console.log('[Inventory] No local cards, attempting Oracle sync...')
            const syncRes = await fetch('/api/cards/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wallet: userId })
            })
            const syncData = await syncRes.json()
            if (syncData.ok && syncData.synced > 0) {
              console.log(`[Inventory] Synced ${syncData.synced} cards from Oracle`)
              // Re-fetch cards after sync
              const retryRes = await fetch(`/api/cards/inventory?wallet=${encodeURIComponent(userId)}`)
              const retryData = await retryRes.json()
              if (retryData.ok) {
                setCards(retryData.cards || [])
              }
            }
          } else if (cardsData.ok) {
            setCards(cardsData.cards || [])
          }
        } catch (e) {
          console.error(e)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleRenew = async (card: CardInstanceData) => {
    if (!user?.id) return
    setRenewingCardId(card.id)

    try {
      const res = await fetch('/api/cards/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: user.id, cardId: card.id })
      })
      const data = await res.json()

      if (data.ok) {
        // Update card in state
        setCards(prev => prev.map(c =>
          c.id === card.id ? { ...c, ...data.card, visualState: 'fresh' } : c
        ))
        // Update user flip balance
        setUser((prev: any) => ({ ...prev, flip: data.newBalance }))
        refetchBalance() // Refresh on-chain data
        setShowRenewModal(null)
      } else {
        alert(data.error || 'Failed to renew card')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to renew card')
    }
    setRenewingCardId(null)
  }

  // Status filters
  const statusFilters = [
    { key: 'all', label: 'All', color: '#ffffff' },
    { key: 'active', label: '✅ Active', color: '#22c55e' },
    { key: 'expired', label: '⏰ Expired', color: '#f97316' },
    { key: 'wrecked', label: '💀 Wrecked', color: '#dc2626' },
  ]

  // CardType filters
  const typeFilters = [
    { key: 'all-type', label: 'All Types', color: '#ffffff' },
    { key: 'pegasus', label: '🦄 Pegasus', color: '#4ade80' },
    { key: 'genesis', label: '💜 Genesis', color: '#c084fc' },
    { key: 'unicorn', label: '🌟 Unicorn', color: '#ffd700' },
    { key: 'sentient', label: '🧠 Sentient', color: '#60a5fa' },
  ]

  const [typeFilter, setTypeFilter] = useState<string>('all-type')

  const filteredCards = cards.filter(card => {
    // Status filter
    let passesStatus = true
    if (filter === 'active') passesStatus = card.status === 'active' && card.durability > 0
    else if (filter === 'expired') passesStatus = card.status === 'expired' || card.durability === 0
    else if (filter === 'wrecked') passesStatus = card.status === 'wrecked'

    // CardType filter
    let passesType = true
    if (typeFilter !== 'all-type') {
      passesType = card.cardType?.toLowerCase() === typeFilter.toLowerCase()
    }

    return passesStatus && passesType
  })

  // Group cards by tokenId for display
  const groupedCards = filteredCards.reduce((acc, card) => {
    if (!acc[card.tokenId]) acc[card.tokenId] = []
    acc[card.tokenId].push(card)
    return acc
  }, {} as Record<string, CardInstanceData[]>)

  return (
    <>
      <Head>
        <title>Inventory | Flip Royale</title>
      </Head>
      <div className="app">
        <Topbar activeTab="inventory" user={user} />

        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h2>Card Collection</h2>
            <div style={{ color: '#9ca3af', fontSize: 14 }}>
              💰 $FLIP Balance: <span style={{ color: '#10b981', fontWeight: 700 }}>{realFlipBalance.toLocaleString()}</span>
            </div>
          </div>
          <div className="sep"></div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            {statusFilters.map(btn => (
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

          {/* CardType Filter Buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {typeFilters.map(btn => (
              <button
                key={btn.key}
                onClick={() => setTypeFilter(btn.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: typeFilter === btn.key ? `2px solid ${btn.color}` : '2px solid rgba(255,255,255,0.1)',
                  background: typeFilter === btn.key ? `${btn.color}20` : 'rgba(0,0,0,0.2)',
                  color: btn.color,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading cards...</div>
          ) : filteredCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              No cards found. Open packs to get cards!
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' }}>
              {filteredCards.map((card) => {
                const token = TOKENS.find(t => t.id === card.tokenId)
                if (!token) return null

                const cardStyles = getCardCSSStyles(card.cardType)
                const durabilityColor = getDurabilityColor(card.visualState)
                const usesLeft = getRemainingUses(card)
                const isExpiredOrWrecked = card.status === 'expired' || card.status === 'wrecked' || card.durability === 0

                return (
                  <div
                    key={card.id}
                    className="card-texture"
                    style={{
                      background: cardStyles.background,
                      border: `3px solid ${cardStyles.borderColor}`,
                      boxShadow: cardStyles.boxShadow,
                      borderRadius: 16,
                      padding: 0,
                      position: 'relative',
                      height: 380,
                      width: 180,
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      flexShrink: 0,
                      opacity: isExpiredOrWrecked ? 0.7 : 1,
                      filter: card.status === 'wrecked' ? 'grayscale(0.8)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isExpiredOrWrecked) {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    }}
                  >
                    {/* Status Badge */}
                    {card.status === 'wrecked' && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(-15deg)',
                        background: 'rgba(220, 38, 38, 0.9)',
                        color: 'white',
                        padding: '8px 20px',
                        borderRadius: 8,
                        fontSize: 16,
                        fontWeight: 800,
                        zIndex: 20,
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                      }}>
                        💀 WRECKED
                      </div>
                    )}

                    {card.status === 'expired' || (card.status === 'active' && card.durability === 0) ? (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        zIndex: 20,
                        textAlign: 'center'
                      }}>
                        ⏰ EXPIRED
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowRenewModal(card)
                          }}
                          style={{
                            display: 'block',
                            marginTop: 8,
                            padding: '6px 12px',
                            background: '#10b981',
                            border: 'none',
                            borderRadius: 6,
                            color: 'white',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🔄 RENEW
                        </button>
                      </div>
                    ) : null}

                    {/* Durability Bar */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 40,
                      background: 'rgba(0,0,0,0.7)',
                      padding: '8px 12px',
                      zIndex: 15
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                        fontSize: 11,
                        color: '#9ca3af'
                      }}>
                        <span>Durability</span>
                        <span style={{ color: durabilityColor }}>{usesLeft} uses left</span>
                      </div>
                      <div style={{
                        height: 6,
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: 3,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${card.durability}%`,
                          background: durabilityColor,
                          borderRadius: 3,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    {/* Glowing ring */}
                    <div style={{
                      position: 'absolute',
                      top: '22%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 100,
                      height: 100,
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
                      width: 95,
                      height: 95,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      zIndex: 5
                    }}>
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        style={{
                          width: 92,
                          height: 92,
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                        onError={handleImageFallback}
                      />
                    </div>

                    {/* Token Name & Type */}
                    <div style={{
                      position: 'absolute',
                      top: '48%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      textAlign: 'center',
                      width: '90%'
                    }}>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: cardStyles.textColor,
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        marginBottom: 4
                      }}>
                        {token.symbol}
                      </div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: cardStyles.typeColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {card.cardType}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Renewal Modal */}
        {showRenewModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <div style={{
              background: '#1f2937',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', color: 'white' }}>🔄 Renew Card</h3>

              <div style={{ marginBottom: 20, color: '#9ca3af' }}>
                <p>Renew your <strong style={{ color: '#60a5fa' }}>{TOKENS.find(t => t.id === showRenewModal.tokenId)?.symbol}</strong> card to restore full durability.</p>

                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>Card Type:</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{showRenewModal.cardType}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Renewal Cost:</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>
                      {(RENEWAL_PRICES[showRenewModal.cardType as CardType] || 0).toLocaleString()} $FLIP
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span>Your Balance:</span>
                    <span style={{ color: (user?.flip || 0) >= (RENEWAL_PRICES[showRenewModal.cardType as CardType] || 0) ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {(user?.flip || 0).toLocaleString()} $FLIP
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowRenewModal(null)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRenew(showRenewModal)}
                  disabled={renewingCardId !== null || (user?.flip || 0) < (RENEWAL_PRICES[showRenewModal.cardType as CardType] || 0)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: (user?.flip || 0) >= (RENEWAL_PRICES[showRenewModal.cardType as CardType] || 0) ? '#10b981' : '#4b5563',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontWeight: 700,
                    cursor: (user?.flip || 0) >= (RENEWAL_PRICES[showRenewModal.cardType as CardType] || 0) ? 'pointer' : 'not-allowed',
                    opacity: renewingCardId ? 0.7 : 1
                  }}
                >
                  {renewingCardId ? 'Renewing...' : 'Confirm Renewal'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
