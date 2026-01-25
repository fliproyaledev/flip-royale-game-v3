/**
 * Flip Duel Result / Replay Page
 * Paketten kart açma animasyonu + sıralı kart yerleşimi + sonuç
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

// Animation phases
type AnimPhase = 'loading' | 'packs_appear' | 'packs_open' | 'cards_emerge' | 'cards_place' | 'reveal_winner'

export default function DuelReplayPage() {
    const { theme } = useTheme()
    const router = useRouter()
    const { id } = router.query

    const [duel, setDuel] = useState<Duel | null>(null)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)

    // Animation states
    const [phase, setPhase] = useState<AnimPhase>('loading')
    const [visibleCards, setVisibleCards] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 })
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
        // Phase 1: Packs appear (0.5s)
        setPhase('packs_appear')

        // Phase 2: Packs open (0.5s delay)
        setTimeout(() => setPhase('packs_open'), 500)

        // Phase 3: Cards emerge from packs (1s)
        setTimeout(() => setPhase('cards_emerge'), 1000)

        // Phase 4: Cards place one by one (alternating)
        const cardCount = duel.player1?.cards?.length || 3
        setTimeout(() => {
            setPhase('cards_place')

            // Alternate cards: P1 Card 1, P2 Card 1, P1 Card 2, P2 Card 2, etc.
            for (let i = 0; i < cardCount; i++) {
                // Player 1 card
                setTimeout(() => {
                    setVisibleCards(prev => ({ ...prev, p1: prev.p1 + 1 }))
                }, i * 1200)

                // Player 2 card (after 600ms delay)
                setTimeout(() => {
                    setVisibleCards(prev => ({ ...prev, p2: prev.p2 + 1 }))
                }, i * 1200 + 600)
            }
        }, 1500)

        // Phase 5: Reveal winner (after all cards)
        const totalAnimTime = 1500 + (cardCount * 1200) + 1000
        setTimeout(() => setPhase('reveal_winner'), totalAnimTime)
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
                    <Link href="/arena/duel">← Go Back</Link>
                </main>
            </div>
        )
    }

    const isP1Winner = duel.winner === duel.player1?.wallet
    const isP2Winner = duel.player2 && duel.winner === duel.player2.wallet

    return (
        <>
            <Head>
                <title>Duel Result | FLIP ROYALE</title>
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: '#f59e0b' }}>
                            ⚔️ Flip Duel
                        </h1>
                        <p style={{ opacity: 0.7 }}>
                            {phase === 'reveal_winner' ? '✅ Battle Complete!' : '🎴 Opening packs...'}
                        </p>
                    </div>

                    {/* Battle Arena */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 1fr',
                        gap: 16,
                        alignItems: 'start',
                        marginBottom: 32,
                        minHeight: 400
                    }}>
                        {/* Player 1 Side */}
                        <div style={{ textAlign: 'center' }}>
                            {/* Player Name */}
                            <p style={{
                                fontWeight: 700,
                                marginBottom: 16,
                                fontSize: 14,
                                color: phase === 'reveal_winner' && isP1Winner ? '#10b981' : '#f59e0b',
                                transition: 'color 0.5s'
                            }}>
                                {phase === 'reveal_winner' && isP1Winner && '🏆 '}
                                {shortenAddress(duel.player1.wallet)}
                            </p>

                            {/* Pack Animation */}
                            <div
                                className="pack-container"
                                style={{
                                    position: 'relative',
                                    height: 120,
                                    marginBottom: 16,
                                    opacity: phase === 'cards_place' || phase === 'reveal_winner' ? 0 : 1,
                                    transform: phase === 'packs_appear' || phase === 'packs_open' || phase === 'cards_emerge'
                                        ? 'translateY(0)'
                                        : 'translateY(-100px)',
                                    transition: 'all 0.5s ease'
                                }}
                            >
                                <div
                                    className="pack"
                                    style={{
                                        width: 100,
                                        height: 120,
                                        margin: '0 auto',
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        borderRadius: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 40,
                                        boxShadow: '0 10px 40px rgba(245, 158, 11, 0.3)',
                                        animation: phase === 'packs_open' ? 'shake 0.5s ease' : 'none',
                                        transform: phase === 'cards_emerge' ? 'scale(1.1)' : 'scale(1)',
                                        transition: 'transform 0.3s'
                                    }}
                                >
                                    🎴
                                </div>
                            </div>

                            {/* Cards Area */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                minHeight: 200
                            }}>
                                {duel.player1.cards.map((card, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: 12,
                                            borderRadius: 12,
                                            background: phase === 'reveal_winner' && isP1Winner
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : 'rgba(255,255,255,0.05)',
                                            border: phase === 'reveal_winner' && isP1Winner
                                                ? '2px solid rgba(16, 185, 129, 0.5)'
                                                : '1px solid rgba(255,255,255,0.1)',
                                            opacity: visibleCards.p1 > i ? 1 : 0,
                                            transform: visibleCards.p1 > i ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.8)',
                                            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <img
                                                src={card.logo}
                                                alt={card.symbol}
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 10,
                                                    border: '2px solid rgba(255,255,255,0.2)'
                                                }}
                                                onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                            />
                                            <div style={{ textAlign: 'left', flex: 1 }}>
                                                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{card.symbol}</p>
                                                <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{card.cardType}</p>
                                            </div>
                                            <div style={{
                                                background: 'rgba(16, 185, 129, 0.2)',
                                                padding: '4px 10px',
                                                borderRadius: 8,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: '#10b981'
                                            }}>
                                                {formatFDV(card.fdv)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Total FDV */}
                            <div style={{
                                marginTop: 16,
                                padding: '12px 20px',
                                background: phase === 'reveal_winner' && isP1Winner
                                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))'
                                    : 'rgba(245, 158, 11, 0.1)',
                                borderRadius: 12,
                                opacity: visibleCards.p1 >= (duel.player1.cards?.length || 0) ? 1 : 0,
                                transform: visibleCards.p1 >= (duel.player1.cards?.length || 0) ? 'scale(1)' : 'scale(0.9)',
                                transition: 'all 0.5s ease'
                            }}>
                                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Total FDV</p>
                                <p style={{
                                    margin: 0,
                                    fontSize: 22,
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
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingTop: 150
                        }}>
                            <div style={{
                                fontSize: 36,
                                fontWeight: 900,
                                color: '#f59e0b',
                                textShadow: '0 0 30px rgba(245,158,11,0.5)',
                                animation: phase === 'reveal_winner' ? 'pulse 1s ease infinite' : 'none'
                            }}>
                                VS
                            </div>
                        </div>

                        {/* Player 2 Side */}
                        <div style={{ textAlign: 'center' }}>
                            {duel.player2 ? (
                                <>
                                    {/* Player Name */}
                                    <p style={{
                                        fontWeight: 700,
                                        marginBottom: 16,
                                        fontSize: 14,
                                        color: phase === 'reveal_winner' && isP2Winner ? '#10b981' : '#f59e0b',
                                        transition: 'color 0.5s'
                                    }}>
                                        {phase === 'reveal_winner' && isP2Winner && '🏆 '}
                                        {shortenAddress(duel.player2.wallet)}
                                    </p>

                                    {/* Pack Animation */}
                                    <div
                                        style={{
                                            position: 'relative',
                                            height: 120,
                                            marginBottom: 16,
                                            opacity: phase === 'cards_place' || phase === 'reveal_winner' ? 0 : 1,
                                            transform: phase === 'packs_appear' || phase === 'packs_open' || phase === 'cards_emerge'
                                                ? 'translateY(0)'
                                                : 'translateY(-100px)',
                                            transition: 'all 0.5s ease'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 100,
                                                height: 120,
                                                margin: '0 auto',
                                                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                                borderRadius: 12,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 40,
                                                boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)',
                                                animation: phase === 'packs_open' ? 'shake 0.5s ease 0.1s' : 'none',
                                                transform: phase === 'cards_emerge' ? 'scale(1.1)' : 'scale(1)',
                                                transition: 'transform 0.3s'
                                            }}
                                        >
                                            🎴
                                        </div>
                                    </div>

                                    {/* Cards Area */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        minHeight: 200
                                    }}>
                                        {duel.player2.cards.map((card, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: 12,
                                                    borderRadius: 12,
                                                    background: phase === 'reveal_winner' && isP2Winner
                                                        ? 'rgba(16, 185, 129, 0.15)'
                                                        : 'rgba(255,255,255,0.05)',
                                                    border: phase === 'reveal_winner' && isP2Winner
                                                        ? '2px solid rgba(16, 185, 129, 0.5)'
                                                        : '1px solid rgba(255,255,255,0.1)',
                                                    opacity: visibleCards.p2 > i ? 1 : 0,
                                                    transform: visibleCards.p2 > i ? 'translateY(0) scale(1)' : 'translateY(-30px) scale(0.8)',
                                                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <img
                                                        src={card.logo}
                                                        alt={card.symbol}
                                                        style={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: 10,
                                                            border: '2px solid rgba(255,255,255,0.2)'
                                                        }}
                                                        onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                                    />
                                                    <div style={{ textAlign: 'left', flex: 1 }}>
                                                        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{card.symbol}</p>
                                                        <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>{card.cardType}</p>
                                                    </div>
                                                    <div style={{
                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                        padding: '4px 10px',
                                                        borderRadius: 8,
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color: '#10b981'
                                                    }}>
                                                        {formatFDV(card.fdv)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total FDV */}
                                    <div style={{
                                        marginTop: 16,
                                        padding: '12px 20px',
                                        background: phase === 'reveal_winner' && isP2Winner
                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))'
                                            : 'rgba(139, 92, 246, 0.1)',
                                        borderRadius: 12,
                                        opacity: visibleCards.p2 >= (duel.player2.cards?.length || 0) ? 1 : 0,
                                        transform: visibleCards.p2 >= (duel.player2.cards?.length || 0) ? 'scale(1)' : 'scale(0.9)',
                                        transition: 'all 0.5s ease'
                                    }}>
                                        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Total FDV</p>
                                        <p style={{
                                            margin: 0,
                                            fontSize: 22,
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
                        <div
                            className="winner-panel"
                            style={{
                                textAlign: 'center',
                                padding: 32,
                                background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                                border: '2px solid rgba(16,185,129,0.4)',
                                borderRadius: 20,
                                animation: 'popIn 0.5s ease-out',
                                boxShadow: '0 20px 60px rgba(16, 185, 129, 0.2)'
                            }}
                        >
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
                                fontWeight: 700,
                                fontSize: 16
                            }}
                        >
                            ← Back to Lobby
                        </Link>
                    </div>
                </main>

                <style jsx global>{`
                    @keyframes shake {
                        0%, 100% { transform: translateX(0) rotate(0); }
                        20% { transform: translateX(-5px) rotate(-3deg); }
                        40% { transform: translateX(5px) rotate(3deg); }
                        60% { transform: translateX(-5px) rotate(-2deg); }
                        80% { transform: translateX(5px) rotate(2deg); }
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
