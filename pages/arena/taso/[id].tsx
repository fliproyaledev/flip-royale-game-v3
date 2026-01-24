/**
 * Taso Game - Card Flip Choice & Result Page
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import Topbar from '../../../components/Topbar'
import { useTheme } from '../../../lib/theme'
import { useToast } from '../../../lib/toast'

interface TasoCard {
    tokenId: string
    symbol: string
    name: string
    logo: string
    cardType: string
}

interface TasoPlayer {
    wallet: string
    card: TasoCard
    choice?: 'front' | 'back'
}

interface TasoGame {
    id: string
    status: string
    stake: number
    player1: TasoPlayer
    player2?: TasoPlayer
    flipResult?: 'front' | 'back'
    winner?: string
    loser?: string
    wreckedCard?: TasoCard
    resolvedAt?: number
}

export default function TasoGamePage() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const router = useRouter()
    const { id } = router.query
    const { address } = useAccount()

    const [game, setGame] = useState<TasoGame | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [selectedChoice, setSelectedChoice] = useState<'front' | 'back' | null>(null)
    const [showFlipAnimation, setShowFlipAnimation] = useState(false)
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
        if (id) {
            loadGame()
            const interval = setInterval(loadGame, 5000)
            return () => clearInterval(interval)
        }
    }, [id])

    const loadGame = async () => {
        try {
            const res = await fetch(`/api/arena/taso/${id}`)
            const data = await res.json()
            if (data.ok) {
                setGame(data.game)

                // Show flip animation when result is determined
                if (data.game.status === 'resolved' && data.game.flipResult && !showFlipAnimation) {
                    setShowFlipAnimation(true)
                }
            }
        } catch (err) {
            console.error('Load game error:', err)
        } finally {
            setLoading(false)
        }
    }

    const submitChoice = async (choice: 'front' | 'back') => {
        if (!address || submitting) return
        setSubmitting(true)
        setSelectedChoice(choice)

        try {
            const res = await fetch('/api/arena/taso/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, gameId: id, choice })
            })
            const data = await res.json()

            if (data.ok) {
                toast(`✅ Choice submitted: ${choice === 'front' ? 'Front' : 'Back'}`, 'success')
                loadGame()
            } else {
                toast(data.error || 'Failed to submit choice', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    const isPlayer = address && game && (
        game.player1.wallet.toLowerCase() === address.toLowerCase() ||
        game.player2?.wallet.toLowerCase() === address.toLowerCase()
    )

    const myPlayer = address && game && (
        game.player1.wallet.toLowerCase() === address.toLowerCase() ? game.player1 :
            game.player2?.wallet.toLowerCase() === address.toLowerCase() ? game.player2 : null
    )

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

    if (!game) {
        return (
            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />
                <main style={{ padding: 40, textAlign: 'center' }}>
                    <p>Game not found</p>
                    <Link href="/arena/taso">← Go Back</Link>
                </main>
            </div>
        )
    }

    return (
        <>
            <Head>
                <title>Taso Game | FLIP ROYALE</title>
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
                            🃏 Taso Game
                        </h1>
                        <p style={{ opacity: 0.7 }}>
                            {game.status === 'waiting' && '⏳ Waiting for opponent...'}
                            {game.status === 'choosing' && '🎯 Both players make their choice!'}
                            {game.status === 'resolved' && '✅ Game completed!'}
                        </p>
                    </div>

                    {/* Cards Display */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: 24,
                        alignItems: 'center',
                        marginBottom: 32
                    }}>
                        {/* Player 1 Card */}
                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                fontWeight: 700,
                                marginBottom: 12,
                                color: game.winner === game.player1.wallet ? '#10b981' :
                                    game.loser === game.player1.wallet ? '#ef4444' : 'inherit'
                            }}>
                                {game.winner === game.player1.wallet && '🏆 '}
                                {game.loser === game.player1.wallet && '💀 '}
                                {shortenAddress(game.player1.wallet)}
                            </p>

                            <div style={{
                                padding: 20,
                                borderRadius: 16,
                                background: game.loser === game.player1.wallet
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(255,255,255,0.05)',
                                border: game.loser === game.player1.wallet
                                    ? '2px solid rgba(239, 68, 68, 0.5)'
                                    : '1px solid rgba(255,255,255,0.1)',
                                filter: game.loser === game.player1.wallet ? 'grayscale(80%)' : 'none'
                            }}>
                                <img
                                    src={game.player1.card.logo}
                                    alt={game.player1.card.symbol}
                                    style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 8 }}
                                    onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                />
                                <p style={{ margin: 0, fontWeight: 700 }}>{game.player1.card.symbol}</p>
                                {game.player1.choice && (
                                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#ec4899' }}>
                                        Choice: {game.player1.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                                    </p>
                                )}
                                {game.loser === game.player1.wallet && (
                                    <p style={{
                                        margin: '8px 0 0',
                                        padding: '4px 8px',
                                        background: '#ef4444',
                                        color: '#fff',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 700
                                    }}>
                                        WRECKED
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* VS / Flip Animation */}
                        <div style={{ textAlign: 'center' }}>
                            {showFlipAnimation && game.flipResult ? (
                                <div style={{
                                    fontSize: 48,
                                    animation: 'flip 1s ease-in-out'
                                }}>
                                    {game.flipResult === 'front' ? '🎴' : '🔙'}
                                </div>
                            ) : (
                                <div style={{
                                    fontSize: 32,
                                    fontWeight: 900,
                                    color: '#ec4899',
                                    textShadow: '0 0 20px rgba(236, 72, 153, 0.5)'
                                }}>
                                    VS
                                </div>
                            )}
                            {game.flipResult && (
                                <p style={{ marginTop: 8, fontWeight: 700 }}>
                                    Result: {game.flipResult === 'front' ? 'Front' : 'Back'}
                                </p>
                            )}
                        </div>

                        {/* Player 2 Card */}
                        <div style={{ textAlign: 'center' }}>
                            {game.player2 ? (
                                <>
                                    <p style={{
                                        fontWeight: 700,
                                        marginBottom: 12,
                                        color: game.winner === game.player2.wallet ? '#10b981' :
                                            game.loser === game.player2.wallet ? '#ef4444' : 'inherit'
                                    }}>
                                        {game.winner === game.player2.wallet && '🏆 '}
                                        {game.loser === game.player2.wallet && '💀 '}
                                        {shortenAddress(game.player2.wallet)}
                                    </p>

                                    <div style={{
                                        padding: 20,
                                        borderRadius: 16,
                                        background: game.loser === game.player2.wallet
                                            ? 'rgba(239, 68, 68, 0.1)'
                                            : 'rgba(255,255,255,0.05)',
                                        border: game.loser === game.player2.wallet
                                            ? '2px solid rgba(239, 68, 68, 0.5)'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        filter: game.loser === game.player2.wallet ? 'grayscale(80%)' : 'none'
                                    }}>
                                        <img
                                            src={game.player2.card.logo}
                                            alt={game.player2.card.symbol}
                                            style={{ width: 64, height: 64, borderRadius: 12, marginBottom: 8 }}
                                            onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                        />
                                        <p style={{ margin: 0, fontWeight: 700 }}>{game.player2.card.symbol}</p>
                                        {game.player2.choice && (
                                            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#ec4899' }}>
                                                Choice: {game.player2.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                                            </p>
                                        )}
                                        {game.loser === game.player2.wallet && (
                                            <p style={{
                                                margin: '8px 0 0',
                                                padding: '4px 8px',
                                                background: '#ef4444',
                                                color: '#fff',
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 700
                                            }}>
                                                WRECKED
                                            </p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p style={{ opacity: 0.5 }}>Waiting for opponent...</p>
                            )}
                        </div>
                    </div>

                    {/* Choice Selection - Only for players who haven't chosen yet */}
                    {game.status === 'choosing' && isPlayer && myPlayer && !myPlayer.choice && (
                        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
                            <h3 style={{ marginBottom: 16, color: '#ec4899' }}>🎯 Make Your Choice!</h3>
                            <p style={{ marginBottom: 16, opacity: 0.7 }}>Will the card show Front or Back?</p>

                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                <button
                                    onClick={() => submitChoice('front')}
                                    disabled={submitting}
                                    style={{
                                        padding: '16px 32px',
                                        borderRadius: 12,
                                        border: '2px solid #10b981',
                                        background: selectedChoice === 'front' ? '#10b981' : 'rgba(16, 185, 129, 0.1)',
                                        color: selectedChoice === 'front' ? '#fff' : '#10b981',
                                        fontSize: 18,
                                        fontWeight: 800,
                                        cursor: submitting ? 'wait' : 'pointer'
                                    }}
                                >
                                    🎴 Front
                                </button>
                                <button
                                    onClick={() => submitChoice('back')}
                                    disabled={submitting}
                                    style={{
                                        padding: '16px 32px',
                                        borderRadius: 12,
                                        border: '2px solid #8b5cf6',
                                        background: selectedChoice === 'back' ? '#8b5cf6' : 'rgba(139, 92, 246, 0.1)',
                                        color: selectedChoice === 'back' ? '#fff' : '#8b5cf6',
                                        fontSize: 18,
                                        fontWeight: 800,
                                        cursor: submitting ? 'wait' : 'pointer'
                                    }}
                                >
                                    🔙 Back
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Waiting for other player's choice */}
                    {game.status === 'choosing' && isPlayer && myPlayer?.choice && (
                        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
                            <p style={{ opacity: 0.7 }}>
                                ⏳ Waiting for opponent's choice...
                            </p>
                            <p style={{ marginTop: 8, color: '#ec4899' }}>
                                Your choice: {myPlayer.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                            </p>
                        </div>
                    )}

                    {/* Result */}
                    {game.status === 'resolved' && game.winner && (
                        <div className="panel" style={{
                            textAlign: 'center',
                            padding: 24,
                            background: game.winner.toLowerCase() === address?.toLowerCase()
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))'
                                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
                            border: game.winner.toLowerCase() === address?.toLowerCase()
                                ? '1px solid rgba(16, 185, 129, 0.3)'
                                : '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                            {game.winner.toLowerCase() === address?.toLowerCase() ? (
                                <>
                                    <p style={{ fontSize: 24, marginBottom: 8 }}>🎉 You Won!</p>
                                    <p style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>
                                        +{((game.stake * 2 * 0.9) / 1000).toFixed(0)}K $FLIP
                                    </p>
                                </>
                            ) : game.loser?.toLowerCase() === address?.toLowerCase() ? (
                                <>
                                    <p style={{ fontSize: 24, marginBottom: 8 }}>😢 You Lost</p>
                                    <p style={{ fontSize: 14, color: '#ef4444' }}>
                                        Your card "{game.wreckedCard?.symbol}" has been wrecked.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>🏆 Winner</p>
                                    <p style={{ fontSize: 18, fontWeight: 800 }}>{shortenAddress(game.winner)}</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Back Button */}
                    <div style={{ textAlign: 'center', marginTop: 32 }}>
                        <Link
                            href="/arena/taso"
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

                <style jsx>{`
          @keyframes flip {
            0% { transform: rotateY(0deg); }
            50% { transform: rotateY(180deg); }
            100% { transform: rotateY(360deg); }
          }
        `}</style>
            </div>
        </>
    )
}
