/**
 * Taso Game / Choice / Result Page
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
    tier: string
    status: string
    player1: TasoPlayer
    player2?: TasoPlayer
    flipResult?: 'front' | 'back'
    winner?: string
    loserCardWrecked?: string
    pot: number
    winnerPayout: number
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
    const [showFlip, setShowFlip] = useState(false)
    const [flipComplete, setFlipComplete] = useState(false)
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
        if (id) loadGame()
    }, [id])

    const loadGame = async () => {
        try {
            const res = await fetch(`/api/arena/taso/${id}`)
            const data = await res.json()
            if (data.ok) {
                setGame(data.game)

                // If resolved, start flip animation
                if (data.game.status === 'resolved') {
                    setTimeout(() => setShowFlip(true), 500)
                    setTimeout(() => setFlipComplete(true), 2000)
                }
            }
        } catch (err) {
            console.error('Load game error:', err)
        } finally {
            setLoading(false)
        }
    }

    const submitChoice = async (choice: 'front' | 'back') => {
        if (!address || !id) return
        setSubmitting(true)

        try {
            const res = await fetch('/api/arena/taso/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, gameId: id, choice })
            })
            const data = await res.json()

            if (data.ok) {
                setGame(data.game)
                if (data.resolved) {
                    toast('🎴 Kartlar çevrildi!', 'success')
                    setTimeout(() => setShowFlip(true), 500)
                    setTimeout(() => setFlipComplete(true), 2000)
                } else {
                    toast('✅ Seçimin kaydedildi. Rakibi bekle.', 'info')
                }
            } else {
                toast(data.error || 'Seçim başarısız', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Hata', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    const myPlayer = game?.player1?.wallet?.toLowerCase() === address?.toLowerCase()
        ? game?.player1
        : game?.player2?.wallet?.toLowerCase() === address?.toLowerCase()
            ? game?.player2
            : null

    const hasChosen = myPlayer?.choice !== undefined

    if (loading) {
        return (
            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />
                <main style={{ padding: 40, textAlign: 'center' }}>
                    <p>⏳ Yükleniyor...</p>
                </main>
            </div>
        )
    }

    if (!game) {
        return (
            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />
                <main style={{ padding: 40, textAlign: 'center' }}>
                    <p>Oyun bulunamadı</p>
                    <Link href="/arena/taso">← Geri Dön</Link>
                </main>
            </div>
        )
    }

    return (
        <>
            <Head>
                <title>Taso Oyunu | FLIP ROYALE</title>
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: '#ec4899' }}>
                            🃏 Taso
                        </h1>
                        <p style={{ opacity: 0.7 }}>
                            {game.status === 'resolved' ? '✅ Tamamlandı' :
                                game.status === 'waiting_choices' ? '⏳ Seçim Bekleniyor' :
                                    `⏳ ${game.status}`}
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
                            <p style={{ fontWeight: 700, marginBottom: 12 }}>
                                {shortenAddress(game.player1.wallet)}
                                {game.winner === game.player1.wallet && ' 🏆'}
                            </p>
                            <div style={{
                                padding: 16,
                                borderRadius: 16,
                                background: game.loserCardWrecked === game.player1.card.tokenId
                                    ? 'rgba(239,68,68,0.2)'
                                    : 'rgba(255,255,255,0.05)',
                                border: game.loserCardWrecked === game.player1.card.tokenId
                                    ? '2px solid #ef4444'
                                    : '1px solid rgba(255,255,255,0.1)',
                                transform: showFlip ? 'rotateY(360deg)' : 'rotateY(0)',
                                transition: 'transform 1s ease-in-out',
                                position: 'relative'
                            }}>
                                <img
                                    src={game.player1.card.logo}
                                    alt={game.player1.card.symbol}
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 12,
                                        filter: game.loserCardWrecked === game.player1.card.tokenId
                                            ? 'grayscale(80%) brightness(0.6)'
                                            : 'none'
                                    }}
                                    onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                />
                                <p style={{ margin: '8px 0 0', fontWeight: 700 }}>{game.player1.card.symbol}</p>
                                {game.loserCardWrecked === game.player1.card.tokenId && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%) rotate(-15deg)',
                                        fontSize: 20,
                                        color: '#ef4444',
                                        fontWeight: 900,
                                        textShadow: '0 0 10px rgba(239,68,68,0.8)'
                                    }}>
                                        💀 WRECKED
                                    </span>
                                )}
                            </div>
                            {game.player1.choice && flipComplete && (
                                <p style={{ marginTop: 8, fontSize: 14 }}>
                                    Seçim: {game.player1.choice === 'front' ? '🔵 ÖN' : '🔴 ARKA'}
                                </p>
                            )}
                        </div>

                        {/* VS */}
                        <div style={{
                            fontSize: 32,
                            fontWeight: 900,
                            color: '#ec4899',
                            textShadow: '0 0 20px rgba(236,72,153,0.5)'
                        }}>
                            VS
                        </div>

                        {/* Player 2 Card */}
                        <div style={{ textAlign: 'center' }}>
                            {game.player2 ? (
                                <>
                                    <p style={{ fontWeight: 700, marginBottom: 12 }}>
                                        {shortenAddress(game.player2.wallet)}
                                        {game.winner === game.player2.wallet && ' 🏆'}
                                    </p>
                                    <div style={{
                                        padding: 16,
                                        borderRadius: 16,
                                        background: game.loserCardWrecked === game.player2.card.tokenId
                                            ? 'rgba(239,68,68,0.2)'
                                            : 'rgba(255,255,255,0.05)',
                                        border: game.loserCardWrecked === game.player2.card.tokenId
                                            ? '2px solid #ef4444'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        transform: showFlip ? 'rotateY(360deg)' : 'rotateY(0)',
                                        transition: 'transform 1s ease-in-out',
                                        transitionDelay: '0.3s',
                                        position: 'relative'
                                    }}>
                                        <img
                                            src={game.player2.card.logo}
                                            alt={game.player2.card.symbol}
                                            style={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: 12,
                                                filter: game.loserCardWrecked === game.player2.card.tokenId
                                                    ? 'grayscale(80%) brightness(0.6)'
                                                    : 'none'
                                            }}
                                            onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                                        />
                                        <p style={{ margin: '8px 0 0', fontWeight: 700 }}>{game.player2.card.symbol}</p>
                                        {game.loserCardWrecked === game.player2.card.tokenId && (
                                            <span style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%) rotate(-15deg)',
                                                fontSize: 20,
                                                color: '#ef4444',
                                                fontWeight: 900,
                                                textShadow: '0 0 10px rgba(239,68,68,0.8)'
                                            }}>
                                                💀 WRECKED
                                            </span>
                                        )}
                                    </div>
                                    {game.player2.choice && flipComplete && (
                                        <p style={{ marginTop: 8, fontSize: 14 }}>
                                            Seçim: {game.player2.choice === 'front' ? '🔵 ÖN' : '🔴 ARKA'}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p style={{ opacity: 0.5 }}>Rakip bekliyor...</p>
                            )}
                        </div>
                    </div>

                    {/* Choice Section */}
                    {game.status === 'waiting_choices' && myPlayer && !hasChosen && (
                        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
                            <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Seçimini Yap!</h3>
                            <p style={{ opacity: 0.7, marginBottom: 20 }}>
                                Kartın hangi yüzü gelecek?
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                                <button
                                    onClick={() => submitChoice('front')}
                                    disabled={submitting}
                                    style={{
                                        padding: '16px 40px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                        color: '#fff',
                                        fontSize: 18,
                                        fontWeight: 800,
                                        cursor: submitting ? 'wait' : 'pointer'
                                    }}
                                >
                                    🔵 ÖN
                                </button>
                                <button
                                    onClick={() => submitChoice('back')}
                                    disabled={submitting}
                                    style={{
                                        padding: '16px 40px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        color: '#fff',
                                        fontSize: 18,
                                        fontWeight: 800,
                                        cursor: submitting ? 'wait' : 'pointer'
                                    }}
                                >
                                    🔴 ARKA
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Waiting for opponent */}
                    {game.status === 'waiting_choices' && hasChosen && (
                        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
                            <p>⏳ Rakibin seçimini bekliyor...</p>
                            <p style={{ opacity: 0.7, fontSize: 14, marginTop: 8 }}>
                                Senin seçimin: {myPlayer?.choice === 'front' ? '🔵 ÖN' : '🔴 ARKA'}
                            </p>
                        </div>
                    )}

                    {/* Result */}
                    {game.status === 'resolved' && flipComplete && (
                        <div className="panel" style={{
                            padding: 24,
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
                            border: '1px solid rgba(16,185,129,0.3)'
                        }}>
                            <p style={{ fontSize: 18, marginBottom: 8 }}>
                                Sonuç: {game.flipResult === 'front' ? '🔵 ÖN' : '🔴 ARKA'}
                            </p>
                            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>🏆 Kazanan</p>
                            <p style={{ fontSize: 18, fontWeight: 800 }}>{game.winner ? shortenAddress(game.winner) : '-'}</p>
                            <p style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 8 }}>
                                +{(game.winnerPayout / 1000).toFixed(0)}K $FLIP
                            </p>
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
                            ← Lobby'ye Dön
                        </Link>
                    </div>
                </main>
            </div>
        </>
    )
}
