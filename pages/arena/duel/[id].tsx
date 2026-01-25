/**
 * Flip Duel Result / Replay Page
 * Pack opening animation with proper card visuals
 */

import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Topbar from '../../../components/Topbar'
import { useTheme } from '../../../lib/theme'

interface DuelCard {
    tokenId: string
    symbol: string
    name: string
    logo: string
    cardType: string
    fdv: number
}

interface DuelPlayer {
    wallet: string
    cards: DuelCard[]
    totalFdv: number
}

interface Duel {
    id: string
    tier: string
    status: string
    player1: DuelPlayer
    player2?: DuelPlayer
    winner?: string
    pot: number
    winnerPayout: number
    resolvedAt?: number
}

// Card CSS styles matching shop/inventory
interface CardCSSStyles {
    background: string
    borderColor: string
    boxShadow: string
    ringColor: string
    ringGlow: string
    textColor: string
    typeColor: string
}

function getCardCSSStyles(type: string): CardCSSStyles {
    const styles: Record<string, CardCSSStyles> = {
        pegasus: {
            background: 'linear-gradient(180deg, #2d5a3f 0%, #1a3a28 50%, #050a07 100%)',
            borderColor: '#4a7c59',
            boxShadow: '0 0 15px rgba(74, 124, 89, 0.3)',
            ringColor: '#7cb342',
            ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342',
            textColor: '#ffffff',
            typeColor: '#4ade80',
        },
        genesis: {
            background: 'linear-gradient(180deg, #6b3d8f 0%, #4a2c6a 50%, #0a0510 100%)',
            borderColor: '#7c4a9e',
            boxShadow: '0 0 15px rgba(124, 74, 158, 0.3)',
            ringColor: '#9c27b0',
            ringGlow: '0 0 15px #9c27b0, 0 0 30px #9c27b0',
            textColor: '#ffffff',
            typeColor: '#c084fc',
        },
        unicorn: {
            background: 'linear-gradient(180deg, #f0c14b 0%, #daa520 50%, #4a3000 100%)',
            borderColor: '#daa520',
            boxShadow: '0 0 15px rgba(218, 165, 32, 0.3)',
            ringColor: '#ffd700',
            ringGlow: '0 0 15px #ffd700, 0 0 30px #ffd700',
            textColor: '#ffffff',
            typeColor: '#78350f',
        },
        sentient: {
            background: 'linear-gradient(180deg, #2a4a6a 0%, #1a3050 50%, #050a10 100%)',
            borderColor: '#3a5a8a',
            boxShadow: '0 0 15px rgba(58, 90, 138, 0.3)',
            ringColor: '#2196f3',
            ringGlow: '0 0 15px #2196f3, 0 0 30px #2196f3',
            textColor: '#ffffff',
            typeColor: '#60a5fa',
        },
        firstborn: {
            background: 'linear-gradient(180deg, #2d5a3f 0%, #1a3a28 50%, #050a07 100%)',
            borderColor: '#4a7c59',
            boxShadow: '0 0 15px rgba(74, 124, 89, 0.3)',
            ringColor: '#7cb342',
            ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342',
            textColor: '#ffffff',
            typeColor: '#4ade80',
        },
    }
    return styles[type?.toLowerCase()] || styles.sentient
}

// Get pack image based on card type
function getPackImage(): string {
    return '/sentient-pack.png'
}

// Animation phases
type AnimPhase = 'loading' | 'packs_appear' | 'packs_open' | 'cards_dealing' | 'reveal_winner'

// Card Component matching shop style
function DuelCardDisplay({
    card,
    isVisible,
    delay,
    isWinner
}: {
    card: DuelCard
    isVisible: boolean
    delay: number
    isWinner: boolean
}) {
    const styles = getCardCSSStyles(card.cardType)

    const formatFDV = (fdv: number) => {
        if (fdv >= 1e9) return `$${(fdv / 1e9).toFixed(2)}B`
        if (fdv >= 1e6) return `$${(fdv / 1e6).toFixed(2)}M`
        if (fdv >= 1e3) return `$${(fdv / 1e3).toFixed(0)}K`
        return `$${fdv.toFixed(0)}`
    }

    return (
        <div
            style={{
                width: 130,
                height: 180,
                borderRadius: 12,
                background: styles.background,
                border: `2px solid ${isWinner ? '#10b981' : styles.borderColor}`,
                boxShadow: isWinner ? '0 0 20px rgba(16, 185, 129, 0.5)' : styles.boxShadow,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 8px',
                position: 'relative',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(-50px) scale(0.8)',
                transition: `all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
            }}
        >
            {/* Card Type Badge */}
            <div style={{
                position: 'absolute',
                top: 6,
                right: 6,
                fontSize: 8,
                fontWeight: 700,
                color: styles.typeColor,
                textTransform: 'uppercase',
                letterSpacing: 0.5
            }}>
                {card.cardType}
            </div>

            {/* Logo with ring glow */}
            <div style={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: styles.ringGlow,
                border: `3px solid ${styles.ringColor}`,
                marginTop: 8,
                marginBottom: 10,
            }}>
                <img
                    src={card.logo}
                    alt={card.symbol}
                    style={{
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        objectFit: 'cover'
                    }}
                    onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                />
            </div>

            {/* Symbol */}
            <p style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 14,
                color: styles.textColor,
                textAlign: 'center'
            }}>
                {card.symbol}
            </p>

            {/* FDV Badge */}
            <div style={{
                marginTop: 'auto',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '4px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: '#10b981'
            }}>
                {formatFDV(card.fdv)}
            </div>
        </div>
    )
}

export default function DuelReplayPage() {
    const { theme } = useTheme()
    const router = useRouter()
    const { id } = router.query

    const [duel, setDuel] = useState<Duel | null>(null)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    // Animation states
    const [phase, setPhase] = useState<AnimPhase>('loading')
    const [visibleCards, setVisibleCards] = useState<{ p1: boolean[]; p2: boolean[] }>({ p1: [], p2: [] })
    const animationRan = useRef(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('flipflop-user')
                if (saved) setUser(JSON.parse(saved))
            } catch { }
        }
    }, [])

    useEffect(() => {
        if (id) loadDuel()
    }, [id])

    const loadDuel = async () => {
        try {
            const res = await fetch(`/api/arena/duel/${id}`)
            const data = await res.json()
            if (data.ok) {
                setDuel(data.duel)
                if (data.duel.status === 'resolved' && !animationRan.current) {
                    animationRan.current = true
                    startAnimation(data.duel)
                }
            }
        } catch (err) {
            console.error('Load duel error:', err)
        } finally {
            setLoading(false)
        }
    }

    const startAnimation = (duel: Duel) => {
        const cardCount = duel.player1?.cards?.length || 3

        // Initialize visible cards array
        setVisibleCards({
            p1: new Array(cardCount).fill(false),
            p2: new Array(cardCount).fill(false)
        })

        // Phase 1: Packs appear
        setPhase('packs_appear')

        // Phase 2: Packs shake and open
        setTimeout(() => setPhase('packs_open'), 600)

        // Phase 3: Cards deal one by one (alternating)
        setTimeout(() => {
            setPhase('cards_dealing')

            for (let i = 0; i < cardCount; i++) {
                // Player 1 card
                setTimeout(() => {
                    setVisibleCards(prev => {
                        const newP1 = [...prev.p1]
                        newP1[i] = true
                        return { ...prev, p1: newP1 }
                    })
                }, i * 800)

                // Player 2 card (400ms after P1)
                setTimeout(() => {
                    setVisibleCards(prev => {
                        const newP2 = [...prev.p2]
                        newP2[i] = true
                        return { ...prev, p2: newP2 }
                    })
                }, i * 800 + 400)
            }
        }, 1200)

        // Phase 4: Reveal winner
        const totalTime = 1200 + (cardCount * 800) + 1500
        setTimeout(() => setPhase('reveal_winner'), totalTime)
    }

    const formatFDV = (fdv: number) => {
        if (fdv >= 1e9) return `$${(fdv / 1e9).toFixed(2)}B`
        if (fdv >= 1e6) return `$${(fdv / 1e6).toFixed(2)}M`
        if (fdv >= 1e3) return `$${(fdv / 1e3).toFixed(0)}K`
        return `$${fdv.toFixed(0)}`
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    if (loading) {
        return (
            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />
                <main style={{ padding: 40, textAlign: 'center' }}>
                    <p>⏳ Loading...</p>
                </main>
            </div>
        )
    }

    if (!duel) {
        return (
            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />
                <main style={{ padding: 40, textAlign: 'center' }}>
                    <p>Duel not found</p>
                    <Link href="/arena/duel">← Back</Link>
                </main>
            </div>
        )
    }

    const isP1Winner = duel.winner === duel.player1?.wallet
    const isP2Winner = duel.player2 && duel.winner === duel.player2.wallet
    const allP1Visible = visibleCards.p1.every(v => v)
    const allP2Visible = visibleCards.p2.every(v => v)

    return (
        <>
            <Head>
                <title>Duel Result | FLIP ROYALE</title>
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: '#f59e0b' }}>
                            ⚔️ Flip Duel
                        </h1>
                        <p style={{ opacity: 0.7, fontSize: 14 }}>
                            {phase === 'reveal_winner' ? '✅ Battle Complete!' : '🎴 Opening packs...'}
                        </p>
                    </div>

                    {/* Battle Arena */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: 24,
                        alignItems: 'start',
                        marginBottom: 32,
                    }}>
                        {/* Player 1 Side */}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                fontWeight: 700,
                                fontSize: 14,
                                marginBottom: 16,
                                color: phase === 'reveal_winner' && isP1Winner ? '#10b981' : '#f59e0b'
                            }}>
                                {phase === 'reveal_winner' && isP1Winner && '🏆 '}
                                {shortenAddress(duel.player1.wallet)}
                            </p>

                            {/* Pack Image */}
                            <div style={{
                                marginBottom: 20,
                                opacity: phase === 'cards_dealing' || phase === 'reveal_winner' ? 0 : 1,
                                transform: phase === 'packs_open' ? 'scale(1.1)' : 'scale(1)',
                                transition: 'all 0.5s ease',
                                animation: phase === 'packs_open' ? 'shake 0.5s ease' : 'none'
                            }}>
                                <img
                                    src={getPackImage()}
                                    alt="Pack"
                                    style={{
                                        width: 120,
                                        height: 160,
                                        objectFit: 'contain',
                                        filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))'
                                    }}
                                />
                            </div>

                            {/* Cards Grid */}
                            <div style={{
                                display: 'flex',
                                gap: 10,
                                justifyContent: 'center',
                                flexWrap: 'wrap',
                                minHeight: 200
                            }}>
                                {duel.player1.cards.map((card, i) => (
                                    <DuelCardDisplay
                                        key={i}
                                        card={card}
                                        isVisible={visibleCards.p1[i] || false}
                                        delay={0}
                                        isWinner={phase === 'reveal_winner' && isP1Winner}
                                    />
                                ))}
                            </div>

                            {/* Total FDV */}
                            <div style={{
                                marginTop: 20,
                                padding: '14px 24px',
                                background: phase === 'reveal_winner' && isP1Winner
                                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))'
                                    : 'rgba(245, 158, 11, 0.15)',
                                border: phase === 'reveal_winner' && isP1Winner
                                    ? '2px solid rgba(16, 185, 129, 0.5)'
                                    : '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: 12,
                                opacity: allP1Visible ? 1 : 0,
                                transform: allP1Visible ? 'scale(1)' : 'scale(0.9)',
                                transition: 'all 0.5s ease'
                            }}>
                                <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>Total FDV</p>
                                <p style={{
                                    margin: 0,
                                    fontSize: 24,
                                    fontWeight: 900,
                                    color: phase === 'reveal_winner' && isP1Winner ? '#10b981' : '#f59e0b'
                                }}>
                                    {formatFDV(duel.player1.totalFdv)}
                                </p>
                            </div>
                        </div>

                        {/* VS Center */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingTop: 100
                        }}>
                            <div style={{
                                fontSize: 40,
                                fontWeight: 900,
                                color: '#f59e0b',
                                textShadow: '0 0 30px rgba(245, 158, 11, 0.5)',
                                animation: phase === 'reveal_winner' ? 'pulse 1s ease infinite' : 'none'
                            }}>
                                VS
                            </div>
                        </div>

                        {/* Player 2 Side */}
                        <div style={{ textAlign: 'center' }}>
                            {duel.player2 ? (
                                <>
                                    <p style={{
                                        fontWeight: 700,
                                        fontSize: 14,
                                        marginBottom: 16,
                                        color: phase === 'reveal_winner' && isP2Winner ? '#10b981' : '#8b5cf6'
                                    }}>
                                        {phase === 'reveal_winner' && isP2Winner && '🏆 '}
                                        {shortenAddress(duel.player2.wallet)}
                                    </p>

                                    {/* Pack Image */}
                                    <div style={{
                                        marginBottom: 20,
                                        opacity: phase === 'cards_dealing' || phase === 'reveal_winner' ? 0 : 1,
                                        transform: phase === 'packs_open' ? 'scale(1.1)' : 'scale(1)',
                                        transition: 'all 0.5s ease 0.1s',
                                        animation: phase === 'packs_open' ? 'shake 0.5s ease 0.1s' : 'none'
                                    }}>
                                        <img
                                            src="/genesis-pack.png"
                                            alt="Pack"
                                            style={{
                                                width: 120,
                                                height: 160,
                                                objectFit: 'contain',
                                                filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))'
                                            }}
                                        />
                                    </div>

                                    {/* Cards Grid */}
                                    <div style={{
                                        display: 'flex',
                                        gap: 10,
                                        justifyContent: 'center',
                                        flexWrap: 'wrap',
                                        minHeight: 200
                                    }}>
                                        {duel.player2.cards.map((card, i) => (
                                            <DuelCardDisplay
                                                key={i}
                                                card={card}
                                                isVisible={visibleCards.p2[i] || false}
                                                delay={0}
                                                isWinner={phase === 'reveal_winner' && (isP2Winner || false)}
                                            />
                                        ))}
                                    </div>

                                    {/* Total FDV */}
                                    <div style={{
                                        marginTop: 20,
                                        padding: '14px 24px',
                                        background: phase === 'reveal_winner' && isP2Winner
                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))'
                                            : 'rgba(139, 92, 246, 0.15)',
                                        border: phase === 'reveal_winner' && isP2Winner
                                            ? '2px solid rgba(16, 185, 129, 0.5)'
                                            : '1px solid rgba(139, 92, 246, 0.3)',
                                        borderRadius: 12,
                                        opacity: allP2Visible ? 1 : 0,
                                        transform: allP2Visible ? 'scale(1)' : 'scale(0.9)',
                                        transition: 'all 0.5s ease'
                                    }}>
                                        <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>Total FDV</p>
                                        <p style={{
                                            margin: 0,
                                            fontSize: 24,
                                            fontWeight: 900,
                                            color: phase === 'reveal_winner' && isP2Winner ? '#10b981' : '#8b5cf6'
                                        }}>
                                            {formatFDV(duel.player2.totalFdv)}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <p style={{ opacity: 0.5, paddingTop: 100 }}>Waiting for opponent...</p>
                            )}
                        </div>
                    </div>

                    {/* Winner Announcement */}
                    {phase === 'reveal_winner' && duel.winner && (
                        <div style={{
                            textAlign: 'center',
                            padding: 32,
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                            border: '2px solid rgba(16,185,129,0.4)',
                            borderRadius: 20,
                            animation: 'popIn 0.5s ease-out',
                            boxShadow: '0 20px 60px rgba(16, 185, 129, 0.2)'
                        }}>
                            <p style={{ fontSize: 48, margin: 0 }}>🏆</p>
                            <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>Winner</p>
                            <p style={{ fontSize: 20, fontWeight: 800, margin: '8px 0' }}>
                                {shortenAddress(duel.winner)}
                            </p>
                            <p style={{ fontSize: 32, fontWeight: 900, color: '#10b981', margin: 0 }}>
                                +{(duel.winnerPayout / 1000).toFixed(0)}K $FLIP
                            </p>
                        </div>
                    )}

                    {/* Back Button */}
                    <div style={{ textAlign: 'center', marginTop: 32 }}>
                        <Link
                            href="/arena/duel"
                            style={{
                                display: 'inline-block',
                                padding: '14px 40px',
                                borderRadius: 12,
                                background: 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                textDecoration: 'none',
                                fontWeight: 700
                            }}
                        >
                            ← Back to Lobby
                        </Link>
                    </div>
                </main>

                <style jsx global>{`
                    @keyframes shake {
                        0%, 100% { transform: translateX(0) rotate(0) scale(1.1); }
                        20% { transform: translateX(-8px) rotate(-5deg) scale(1.1); }
                        40% { transform: translateX(8px) rotate(5deg) scale(1.1); }
                        60% { transform: translateX(-6px) rotate(-3deg) scale(1.1); }
                        80% { transform: translateX(6px) rotate(3deg) scale(1.1); }
                    }
                    
                    @keyframes popIn {
                        0% { transform: scale(0.5); opacity: 0; }
                        70% { transform: scale(1.05); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.7; transform: scale(1.1); }
                    }
                `}</style>
            </div>
        </>
    )
}
