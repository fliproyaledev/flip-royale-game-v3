/**
 * Taso Game - Card Flip Choice & Result Page
 * Enhanced with 3D card flip animation showing front/back
 */

import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import Topbar from '../../../components/Topbar'
import { useTheme } from '../../../lib/theme'
import { useToast } from '../../../lib/toast'

// Card type styles
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
            textColor: '#000000',
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
    }
    return styles[type?.toLowerCase()] || styles.sentient
}

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
    loserCardWrecked?: string
    resolvedAt?: number
}

// 3D Flippable Card Component
function FlippableCard({
    card,
    isFlipped,
    isWrecked = false,
    isWinner = false,
}: {
    card: TasoCard
    isFlipped: boolean
    isWrecked?: boolean
    isWinner?: boolean
}) {
    const styles = getCardCSSStyles(card.cardType)

    return (
        <div
            className="card-flip-container"
            style={{
                width: 180,
                height: 280,
                perspective: 1000,
            }}
        >
            <div
                className="card-flipper"
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
            >
                {/* Back Side - Shows First */}
                <div
                    className="card-face card-back"
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        borderRadius: 16,
                        overflow: 'hidden',
                        border: '3px solid #d4a017',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                >
                    <img
                        src="/card-back.png"
                        alt="Card Back"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                    />
                </div>

                {/* Front Side - Shows After Flip */}
                <div
                    className="card-face card-front"
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: styles.background,
                        border: `3px solid ${isWinner ? '#10b981' : isWrecked ? '#ef4444' : styles.borderColor}`,
                        borderRadius: 16,
                        boxShadow: isWinner
                            ? '0 0 30px rgba(16, 185, 129, 0.5)'
                            : isWrecked
                                ? '0 0 30px rgba(239, 68, 68, 0.5)'
                                : styles.boxShadow,
                        filter: isWrecked ? 'grayscale(70%) brightness(0.7)' : 'none',
                    }}
                >
                    {/* Glowing ring */}
                    <div style={{
                        position: 'absolute',
                        top: '28%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        border: `3px solid ${styles.ringColor}`,
                        boxShadow: styles.ringGlow,
                    }} />

                    {/* Token Logo */}
                    <div style={{
                        position: 'absolute',
                        top: '28%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 96,
                        height: 96,
                        borderRadius: '50%',
                        overflow: 'hidden',
                    }}>
                        <img
                            src={card.logo}
                            alt={card.symbol}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                            onError={e => { (e.target as HTMLImageElement).src = '/token-logos/placeholder.png' }}
                        />
                    </div>

                    {/* Token Name */}
                    <div style={{
                        position: 'absolute',
                        top: '58%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        textAlign: 'center',
                        width: '90%'
                    }}>
                        <div style={{
                            fontSize: 18,
                            fontWeight: 900,
                            color: styles.textColor,
                        }}>
                            {card.symbol}
                        </div>
                        <div style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: styles.typeColor,
                            marginTop: 2
                        }}>
                            {card.cardType}
                        </div>
                    </div>

                    {/* Winner/Loser badge */}
                    {(isWinner || isWrecked) && (
                        <div style={{
                            position: 'absolute',
                            top: '78%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: isWinner ? '#10b981' : '#ef4444',
                            color: '#fff',
                            padding: '6px 16px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 800,
                        }}>
                            {isWinner ? '🏆 WINNER' : '💀 WRECKED'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
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
    const [user, setUser] = useState<any>(null)

    // Animation states
    const [cardsFlipped, setCardsFlipped] = useState(false)
    const [showResult, setShowResult] = useState(false)
    const [isColliding, setIsColliding] = useState(false)
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

                // Start animation ONCE when game is resolved
                if (data.game.status === 'resolved' && !animationRan.current) {
                    animationRan.current = true
                    startFlipAnimation()
                }
            }
        } catch (err) {
            console.error('Load game error:', err)
        } finally {
            setLoading(false)
        }
    }

    const startFlipAnimation = () => {
        // Phase 1: Cards fly toward each other
        setTimeout(() => {
            setIsColliding(true)
        }, 500)

        // Phase 2: Collision shake
        setTimeout(() => {
            setIsColliding(false)
        }, 1200)

        // Phase 3: Cards flip to reveal front
        setTimeout(() => {
            setCardsFlipped(true)
        }, 1500)

        // Phase 4: Show result
        setTimeout(() => {
            setShowResult(true)
        }, 2500)
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
                toast(`✅ Choice: ${choice === 'front' ? 'Front' : 'Back'}`, 'success')
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

    const isP1Winner = game.winner === game.player1.wallet
    const isP2Winner = game.player2 && game.winner === game.player2.wallet

    return (
        <>
            <Head>
                <title>Taso Game | FLIP ROYALE</title>
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: '#ec4899' }}>
                            🃏 Taso Game
                        </h1>
                        <p style={{ opacity: 0.7 }}>
                            {game.status === 'open' && '⏳ Waiting for opponent...'}
                            {game.status === 'waiting_choices' && '🎯 Choose: Front or Back!'}
                            {game.status === 'resolved' && '✅ Game completed!'}
                        </p>
                    </div>

                    {/* Battle Arena */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 30,
                        marginBottom: 32,
                        minHeight: 380,
                        position: 'relative',
                    }}>
                        {/* Player 1 Card */}
                        <div
                            className={`player-card ${isColliding ? 'collide-right' : ''}`}
                            style={{
                                textAlign: 'center',
                                transition: 'transform 0.5s ease',
                                transform: showResult && !isP1Winner ? 'translateY(30px) rotate(-5deg)' : 'none',
                                opacity: showResult && !isP1Winner ? 0.7 : 1,
                            }}
                        >
                            <p style={{
                                fontWeight: 700,
                                marginBottom: 12,
                                color: showResult
                                    ? (isP1Winner ? '#10b981' : '#ef4444')
                                    : '#ec4899'
                            }}>
                                {showResult && isP1Winner && '🏆 '}
                                {showResult && !isP1Winner && '💀 '}
                                {shortenAddress(game.player1.wallet)}
                            </p>

                            <FlippableCard
                                card={game.player1.card}
                                isFlipped={cardsFlipped}
                                isWinner={showResult && !!isP1Winner}
                                isWrecked={showResult && !isP1Winner}
                            />

                            {showResult && game.player1.choice && (
                                <p style={{ marginTop: 12, fontSize: 14, color: '#888' }}>
                                    Choice: {game.player1.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                                </p>
                            )}
                        </div>

                        {/* Center - Result Display */}
                        <div style={{
                            textAlign: 'center',
                            zIndex: 10,
                            minWidth: 100,
                        }}>
                            {game.status === 'resolved' ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    opacity: showResult ? 1 : 0.5,
                                    transition: 'opacity 0.5s ease',
                                }}>
                                    <div style={{
                                        fontSize: 60,
                                        marginBottom: 8,
                                        animation: isColliding ? 'spin3d 0.6s ease' : 'none',
                                    }}>
                                        {showResult
                                            ? (game.flipResult === 'front' ? '🎴' : '🔙')
                                            : '❓'}
                                    </div>
                                    {showResult && (
                                        <div style={{
                                            background: game.flipResult === 'front'
                                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                            padding: '10px 20px',
                                            borderRadius: 12,
                                            fontWeight: 900,
                                            fontSize: 18,
                                            color: '#fff',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                        }}>
                                            {game.flipResult === 'front' ? 'FRONT' : 'BACK'}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{
                                    fontSize: 48,
                                    fontWeight: 900,
                                    color: '#ec4899',
                                    textShadow: '0 0 30px rgba(236, 72, 153, 0.5)'
                                }}>
                                    VS
                                </div>
                            )}
                        </div>

                        {/* Player 2 Card */}
                        <div
                            className={`player-card ${isColliding ? 'collide-left' : ''}`}
                            style={{
                                textAlign: 'center',
                                transition: 'transform 0.5s ease',
                                transform: showResult && !isP2Winner ? 'translateY(30px) rotate(5deg)' : 'none',
                                opacity: showResult && !isP2Winner && game.player2 ? 0.7 : 1,
                            }}
                        >
                            {game.player2 ? (
                                <>
                                    <p style={{
                                        fontWeight: 700,
                                        marginBottom: 12,
                                        color: showResult
                                            ? (isP2Winner ? '#10b981' : '#ef4444')
                                            : '#ec4899'
                                    }}>
                                        {showResult && isP2Winner && '🏆 '}
                                        {showResult && !isP2Winner && '💀 '}
                                        {shortenAddress(game.player2.wallet)}
                                    </p>

                                    <FlippableCard
                                        card={game.player2.card}
                                        isFlipped={cardsFlipped}
                                        isWinner={showResult && !!isP2Winner}
                                        isWrecked={showResult && !isP2Winner}
                                    />

                                    {showResult && game.player2.choice && (
                                        <p style={{ marginTop: 12, fontSize: 14, color: '#888' }}>
                                            Choice: {game.player2.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div style={{
                                    width: 180,
                                    height: 280,
                                    border: '3px dashed rgba(236, 72, 153, 0.3)',
                                    borderRadius: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#666'
                                }}>
                                    Waiting...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Choice Selection */}
                    {game.status === 'waiting_choices' && isPlayer && myPlayer && !myPlayer.choice && (
                        <div className="panel" style={{
                            padding: 32,
                            textAlign: 'center',
                            background: 'linear-gradient(180deg, rgba(236, 72, 153, 0.1), transparent)',
                            border: '2px solid rgba(236, 72, 153, 0.3)'
                        }}>
                            <h3 style={{ marginBottom: 8, fontSize: 24, color: '#ec4899' }}>
                                🎯 Make Your Choice!
                            </h3>
                            <p style={{ marginBottom: 24, opacity: 0.7 }}>
                                Will the card land on Front or Back?
                            </p>

                            <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
                                <button
                                    onClick={() => submitChoice('front')}
                                    disabled={submitting}
                                    style={{
                                        padding: '20px 40px',
                                        borderRadius: 16,
                                        border: '3px solid #10b981',
                                        background: selectedChoice === 'front' ? '#10b981' : 'rgba(16, 185, 129, 0.1)',
                                        color: selectedChoice === 'front' ? '#fff' : '#10b981',
                                        fontSize: 20,
                                        fontWeight: 800,
                                        cursor: submitting ? 'wait' : 'pointer',
                                    }}
                                >
                                    🎴 FRONT
                                </button>
                                <button
                                    onClick={() => submitChoice('back')}
                                    disabled={submitting}
                                    style={{
                                        padding: '20px 40px',
                                        borderRadius: 16,
                                        border: '3px solid #8b5cf6',
                                        background: selectedChoice === 'back' ? '#8b5cf6' : 'rgba(139, 92, 246, 0.1)',
                                        color: selectedChoice === 'back' ? '#fff' : '#8b5cf6',
                                        fontSize: 20,
                                        fontWeight: 800,
                                        cursor: submitting ? 'wait' : 'pointer',
                                    }}
                                >
                                    🔙 BACK
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Waiting for choice */}
                    {game.status === 'waiting_choices' && isPlayer && myPlayer?.choice && (
                        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
                            <p style={{ opacity: 0.7, marginBottom: 8 }}>
                                ⏳ Waiting for opponent's choice...
                            </p>
                            <p style={{ color: '#ec4899', fontWeight: 700 }}>
                                Your choice: {myPlayer.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                            </p>
                        </div>
                    )}

                    {/* Result */}
                    {game.status === 'resolved' && showResult && game.winner && (
                        <div className="panel" style={{
                            textAlign: 'center',
                            padding: 32,
                            background: game.winner.toLowerCase() === address?.toLowerCase()
                                ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.15), transparent)'
                                : 'linear-gradient(180deg, rgba(239, 68, 68, 0.15), transparent)',
                            border: game.winner.toLowerCase() === address?.toLowerCase()
                                ? '2px solid rgba(16, 185, 129, 0.4)'
                                : '2px solid rgba(239, 68, 68, 0.4)'
                        }}>
                            {game.winner.toLowerCase() === address?.toLowerCase() ? (
                                <>
                                    <p style={{ fontSize: 32, marginBottom: 8 }}>🎉 You Won!</p>
                                    <p style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>
                                        +{((game.stake * 2 * 0.9) / 1000).toFixed(0)}K $FLIP
                                    </p>
                                </>
                            ) : myPlayer ? (
                                <>
                                    <p style={{ fontSize: 32, marginBottom: 8 }}>😢 You Lost</p>
                                    <p style={{ fontSize: 14, color: '#ef4444' }}>
                                        Your card has been wrecked.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p style={{ fontSize: 18, opacity: 0.7, marginBottom: 8 }}>🏆 Winner</p>
                                    <p style={{ fontSize: 24, fontWeight: 800 }}>{shortenAddress(game.winner)}</p>
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
          @keyframes collideRight {
            0% { transform: translateX(0); }
            50% { transform: translateX(40px); }
            70% { transform: translateX(30px) rotate(3deg); }
            100% { transform: translateX(0); }
          }
          
          @keyframes collideLeft {
            0% { transform: translateX(0); }
            50% { transform: translateX(-40px); }
            70% { transform: translateX(-30px) rotate(-3deg); }
            100% { transform: translateX(0); }
          }
          
          @keyframes spin3d {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(360deg); }
          }
          
          @keyframes shake {
            0%, 100% { transform: translateX(0) rotate(0deg); }
            20% { transform: translateX(-8px) rotate(-3deg); }
            40% { transform: translateX(8px) rotate(3deg); }
            60% { transform: translateX(-6px) rotate(-2deg); }
            80% { transform: translateX(6px) rotate(2deg); }
          }
          
          .collide-right {
            animation: collideRight 0.7s ease forwards, shake 0.3s ease 0.7s;
          }
          
          .collide-left {
            animation: collideLeft 0.7s ease forwards, shake 0.3s ease 0.7s;
          }
        `}</style>
            </div>
        </>
    )
}
