/**
 * Flip Duel Result / Replay Page
 */

import { useState, useEffect } from 'react'
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

export default function DuelReplayPage() {
    const { theme } = useTheme()
    const router = useRouter()
    const { id } = router.query

    const [duel, setDuel] = useState<Duel | null>(null)
    const [loading, setLoading] = useState(true)
    const [revealed, setRevealed] = useState<number[]>([])
    const [user, setUser] = useState<any>(null)

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
                startRevealAnimation(data.duel)
            }
        } catch (err) {
            console.error('Load duel error:', err)
        } finally {
            setLoading(false)
        }
    }

    const startRevealAnimation = (duel: Duel) => {
        const totalCards = (duel.player1?.cards?.length || 0) + (duel.player2?.cards?.length || 0)
        for (let i = 0; i < totalCards; i++) {
            setTimeout(() => {
                setRevealed(prev => [...prev, i])
            }, 500 * (i + 1))
        }
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

    return (
        <>
            <Head>
                <title>Duel Result | FLIP ROYALE</title>
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
                            ⚔️ Duel Result
                        </h1>
                        <p style={{ opacity: 0.7 }}>
                            {duel.status === 'resolved' ? '✅ Completed' : `⏳ ${duel.status}`}
                        </p>
                    </div>

                    {/* Battle Arena */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: 24,
                        alignItems: 'center',
                        marginBottom: 32
                    }}>
                        {/* Player 1 */}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                fontWeight: 700,
                                marginBottom: 12,
                                color: duel.winner === duel.player1.wallet ? '#10b981' : 'inherit'
                            }}>
                                {duel.winner === duel.player1.wallet && '🏆 '}
                                {shortenAddress(duel.player1.wallet)}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {duel.player1.cards.map((card, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: 12,
                                            borderRadius: 12,
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            transform: revealed.includes(i) ? 'rotateY(0)' : 'rotateY(90deg)',
                                            transition: 'transform 0.5s ease',
                                            opacity: revealed.includes(i) ? 1 : 0.3
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <img
                                                src={card.logo}
                                                alt={card.symbol}
                                                style={{ width: 32, height: 32, borderRadius: 8 }}
                                                onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                            />
                                            <div style={{ textAlign: 'left' }}>
                                                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{card.symbol}</p>
                                                <p style={{ margin: 0, fontSize: 12, color: '#10b981' }}>{formatFDV(card.fdv)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p style={{ marginTop: 12, fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>
                                Total: {formatFDV(duel.player1.totalFdv)}
                            </p>
                        </div>

                        {/* VS */}
                        <div style={{
                            fontSize: 32,
                            fontWeight: 900,
                            color: '#f59e0b',
                            textShadow: '0 0 20px rgba(245,158,11,0.5)'
                        }}>
                            VS
                        </div>

                        {/* Player 2 */}
                        <div style={{ textAlign: 'center' }}>
                            {duel.player2 ? (
                                <>
                                    <p style={{
                                        fontWeight: 700,
                                        marginBottom: 12,
                                        color: duel.winner === duel.player2.wallet ? '#10b981' : 'inherit'
                                    }}>
                                        {duel.winner === duel.player2.wallet && '🏆 '}
                                        {shortenAddress(duel.player2.wallet)}
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {duel.player2.cards.map((card, i) => {
                                            const cardIndex = duel.player1.cards.length + i
                                            return (
                                                <div
                                                    key={i}
                                                    style={{
                                                        padding: 12,
                                                        borderRadius: 12,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        transform: revealed.includes(cardIndex) ? 'rotateY(0)' : 'rotateY(90deg)',
                                                        transition: 'transform 0.5s ease',
                                                        opacity: revealed.includes(cardIndex) ? 1 : 0.3
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <img
                                                            src={card.logo}
                                                            alt={card.symbol}
                                                            style={{ width: 32, height: 32, borderRadius: 8 }}
                                                            onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                                        />
                                                        <div style={{ textAlign: 'left' }}>
                                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{card.symbol}</p>
                                                            <p style={{ margin: 0, fontSize: 12, color: '#10b981' }}>{formatFDV(card.fdv)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <p style={{ marginTop: 12, fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>
                                        Total: {formatFDV(duel.player2.totalFdv)}
                                    </p>
                                </>
                            ) : (
                                <p style={{ opacity: 0.5 }}>Waiting for opponent...</p>
                            )}
                        </div>
                    </div>

                    {/* Prize Info */}
                    {duel.status === 'resolved' && duel.winner && (
                        <div className="panel" style={{
                            textAlign: 'center',
                            padding: 24,
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
                            border: '1px solid rgba(16,185,129,0.3)'
                        }}>
                            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>🏆 Winner</p>
                            <p style={{ fontSize: 18, fontWeight: 800 }}>{shortenAddress(duel.winner)}</p>
                            <p style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 8 }}>
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
                                padding: '12px 32px',
                                borderRadius: 10,
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
            </div>
        </>
    )
}
