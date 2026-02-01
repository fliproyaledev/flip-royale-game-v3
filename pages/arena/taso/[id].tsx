/**
 * Taso Game - Card Flip with REAL spinning animation
 * Cards spin on Y-axis showing front and back alternating
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

// Animated Spinning Card with real rotation
function SpinningCard({
    card,
    isSpinning,
    showFinalSide,
    finalSide,
    isWrecked = false,
    isWinner = false,
}: {
    card: TasoCard
    isSpinning: boolean
    showFinalSide: boolean
    finalSide: 'front' | 'back'
    isWrecked?: boolean
    isWinner?: boolean
}) {
    const styles = getCardCSSStyles(card.cardType)
    const [rotation, setRotation] = useState(0)
    const animationRef = useRef<number | null>(null)
    const startTimeRef = useRef<number>(0)

    useEffect(() => {
        if (isSpinning) {
            startTimeRef.current = Date.now()

            const animate = () => {
                const elapsed = Date.now() - startTimeRef.current
                const totalDuration = 3000 // 3 seconds total spin

                if (elapsed < totalDuration) {
                    // Easing: start fast, slow down
                    const progress = elapsed / totalDuration
                    const easeOut = 1 - Math.pow(1 - progress, 3) // Cubic ease out

                    // Calculate target rotation based on finalSide
                    // front = 180° (or odd multiples), back = 0° (or even multiples)
                    // Do 5 full rotations + land on correct side
                    const targetRotation = finalSide === 'front'
                        ? (5 * 360) + 180  // 1980° - ends showing front
                        : (6 * 360)         // 2160° - ends showing back

                    const degrees = easeOut * targetRotation
                    setRotation(degrees)

                    animationRef.current = requestAnimationFrame(animate)
                } else {
                    // Animation complete - set final rotation
                    const finalRotation = finalSide === 'front' ? 1980 : 2160
                    setRotation(finalRotation)
                }
            }

            animationRef.current = requestAnimationFrame(animate)

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current)
                }
            }
        }
    }, [isSpinning, finalSide])

    // Calculate final rotation
    const getFinalRotation = () => {
        if (showFinalSide) {
            return finalSide === 'front' ? 180 : 0
        }
        return rotation
    }

    const currentRotation = showFinalSide ? getFinalRotation() : rotation

    return (
        <div
            style={{
                width: 180,
                height: 280,
                perspective: 1200,
                position: 'relative',
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: showFinalSide ? 'transform 0.5s ease-out' : 'none',
                    transform: `rotateY(${currentRotation}deg)`,
                }}
            >
                {/* Back Side (default facing camera) */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: showFinalSide
                        ? (isWinner ? '4px solid #10b981' : isWrecked ? '4px solid #ef4444' : '3px solid #d4a017')
                        : '3px solid #d4a017',
                    boxShadow: showFinalSide && isWinner
                        ? '0 0 40px rgba(16, 185, 129, 0.6)'
                        : showFinalSide && isWrecked
                            ? '0 0 30px rgba(239, 68, 68, 0.5)'
                            : '0 8px 32px rgba(0,0,0,0.4)',
                    filter: showFinalSide && isWrecked ? 'grayscale(50%) brightness(0.7)' : 'none',
                }}>
                    <img
                        src="/card-back.png"
                        alt="Card Back"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Card name overlay on back */}
                    <div style={{
                        position: 'absolute',
                        bottom: 35,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.85)',
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: `2px solid ${styles.borderColor}`,
                    }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                            {card.symbol}
                        </div>
                        <div style={{ fontSize: 10, color: styles.typeColor, textAlign: 'center' }}>
                            {card.cardType}
                        </div>
                    </div>
                    {/* Badge on back */}
                    {showFinalSide && (isWinner || isWrecked) && (
                        <div style={{
                            position: 'absolute',
                            top: 12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: isWinner ? '#10b981' : '#ef4444',
                            color: '#fff',
                            padding: '6px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 800,
                        }}>
                            {isWinner ? '🏆 WINNER' : '💀 WRECKED'}
                        </div>
                    )}
                </div>

                {/* Front Side (rotated 180deg - shows when card flips) */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: styles.background,
                    border: showFinalSide
                        ? (isWinner ? '4px solid #10b981' : isWrecked ? '4px solid #ef4444' : `3px solid ${styles.borderColor}`)
                        : `3px solid ${styles.borderColor}`,
                    borderRadius: 16,
                    boxShadow: showFinalSide && isWinner
                        ? '0 0 40px rgba(16, 185, 129, 0.6)'
                        : showFinalSide && isWrecked
                            ? '0 0 30px rgba(239, 68, 68, 0.5)'
                            : styles.boxShadow,
                    filter: showFinalSide && isWrecked ? 'grayscale(70%) brightness(0.7)' : 'none',
                }}>
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
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                        <div style={{ fontSize: 18, fontWeight: 900, color: styles.textColor }}>
                            {card.symbol}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: styles.typeColor, marginTop: 2 }}>
                            {card.cardType}
                        </div>
                    </div>

                    {/* Badge on front */}
                    {showFinalSide && (isWinner || isWrecked) && (
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
    const [isColliding, setIsColliding] = useState(false)
    const [isSpinning, setIsSpinning] = useState(false)
    const [showFinal, setShowFinal] = useState(false)
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
        // Phase 1: Collision (0.8s)
        setIsColliding(true)

        // Phase 2: Start spinning (after collision)
        setTimeout(() => {
            setIsColliding(false)
            setIsSpinning(true)
        }, 800)

        // Phase 3: Show final result (after spin completes)
        setTimeout(() => {
            setIsSpinning(false)
            setShowFinal(true)
        }, 3800) // 800ms collision + 3000ms spin
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
                            {game.status === 'resolved' && !showFinal && '🎰 Flipping...'}
                            {game.status === 'resolved' && showFinal && '✅ Game completed!'}
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
                            style={{
                                textAlign: 'center',
                                animation: isColliding ? 'collideRight 0.8s ease' : 'none',
                                transform: showFinal && !isP1Winner ? 'translateY(20px) rotate(-3deg)' : 'none',
                                opacity: showFinal && !isP1Winner ? 0.75 : 1,
                                transition: showFinal ? 'all 0.5s ease' : 'none',
                            }}
                        >
                            <p style={{
                                fontWeight: 700,
                                marginBottom: 12,
                                fontSize: 14,
                                color: showFinal
                                    ? (isP1Winner ? '#10b981' : '#ef4444')
                                    : '#ec4899'
                            }}>
                                {showFinal && isP1Winner && '🏆 '}
                                {showFinal && !isP1Winner && '💀 '}
                                {shortenAddress(game.player1.wallet)}
                            </p>

                            <SpinningCard
                                card={game.player1.card}
                                isSpinning={isSpinning}
                                showFinalSide={showFinal}
                                finalSide={game.flipResult || 'front'}
                                isWinner={showFinal && !!isP1Winner}
                                isWrecked={showFinal && !isP1Winner}
                            />

                            {showFinal && game.player1.choice && (
                                <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
                                    Choice: {game.player1.choice === 'front' ? '🎴 Front' : '🔙 Back'}
                                </p>
                            )}
                        </div>

                        {/* Center - Result Display */}
                        <div style={{ textAlign: 'center', zIndex: 10, minWidth: 100 }}>
                            {game.status === 'resolved' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{
                                        fontSize: 70,
                                        marginBottom: 12,
                                        animation: isSpinning ? 'spin 0.3s linear infinite' : 'none',
                                        filter: !showFinal ? 'drop-shadow(0 0 20px rgba(236, 72, 153, 0.8))' : 'none',
                                    }}>
                                        {showFinal
                                            ? (game.flipResult === 'front' ? '🎴' : '🔙')
                                            : '❓'}
                                    </div>
                                    {showFinal && (
                                        <div style={{
                                            background: game.flipResult === 'front'
                                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                            padding: '12px 28px',
                                            borderRadius: 14,
                                            fontWeight: 900,
                                            fontSize: 22,
                                            color: '#fff',
                                            boxShadow: '0 6px 25px rgba(0,0,0,0.4)',
                                            animation: 'popIn 0.4s ease-out',
                                        }}>
                                            {game.flipResult === 'front' ? 'FRONT!' : 'BACK!'}
                                        </div>
                                    )}
                                    {(isColliding || isSpinning) && (
                                        <p style={{
                                            color: '#ec4899',
                                            fontWeight: 700,
                                            marginTop: 12,
                                            animation: 'pulse 0.5s ease infinite'
                                        }}>
                                            Flipping...
                                        </p>
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
                            style={{
                                textAlign: 'center',
                                animation: isColliding ? 'collideLeft 0.8s ease' : 'none',
                                transform: showFinal && !isP2Winner && game.player2 ? 'translateY(20px) rotate(3deg)' : 'none',
                                opacity: showFinal && !isP2Winner && game.player2 ? 0.75 : 1,
                                transition: showFinal ? 'all 0.5s ease' : 'none',
                            }}
                        >
                            {game.player2 ? (
                                <>
                                    <p style={{
                                        fontWeight: 700,
                                        marginBottom: 12,
                                        fontSize: 14,
                                        color: showFinal
                                            ? (isP2Winner ? '#10b981' : '#ef4444')
                                            : '#ec4899'
                                    }}>
                                        {showFinal && isP2Winner && '🏆 '}
                                        {showFinal && !isP2Winner && '💀 '}
                                        {shortenAddress(game.player2.wallet)}
                                    </p>

                                    <SpinningCard
                                        card={game.player2.card}
                                        isSpinning={isSpinning}
                                        showFinalSide={showFinal}
                                        finalSide={game.flipResult || 'front'}
                                        isWinner={showFinal && !!isP2Winner}
                                        isWrecked={showFinal && !isP2Winner}
                                    />

                                    {showFinal && game.player2.choice && (
                                        <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
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
                                Will the card land on its Front or Back?
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
                                        transition: 'all 0.2s ease',
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
                                        transition: 'all 0.2s ease',
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

                    {/* Draw Result */}
                    {game.status === 'draw' && showFinal && (
                        <div className="panel" style={{
                            textAlign: 'center',
                            padding: 32,
                            background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.2), transparent)',
                            border: '3px solid rgba(234, 179, 8, 0.5)',
                            animation: 'fadeInUp 0.5s ease-out'
                        }}>
                            <p style={{ fontSize: 36, marginBottom: 8 }}>🤝 Draw!</p>
                            <p style={{ fontSize: 18, color: '#eab308' }}>
                                Both players chose the same. No winner, no cards wrecked.
                            </p>
                            <p style={{ fontSize: 14, opacity: 0.7, marginTop: 12 }}>
                                Your card is safe. Try again!
                            </p>
                        </div>
                    )}

                    {/* Result */}
                    {game.status === 'resolved' && showFinal && game.winner && (
                        <div className="panel" style={{
                            textAlign: 'center',
                            padding: 32,
                            background: game.winner.toLowerCase() === address?.toLowerCase()
                                ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.2), transparent)'
                                : 'linear-gradient(180deg, rgba(239, 68, 68, 0.2), transparent)',
                            border: game.winner.toLowerCase() === address?.toLowerCase()
                                ? '3px solid rgba(16, 185, 129, 0.5)'
                                : '3px solid rgba(239, 68, 68, 0.5)',
                            animation: 'fadeInUp 0.5s ease-out'
                        }}>
                            {game.winner.toLowerCase() === address?.toLowerCase() ? (
                                <>
                                    <p style={{ fontSize: 36, marginBottom: 8 }}>🎉 You Won!</p>
                                    <p style={{ fontSize: 32, fontWeight: 900, color: '#10b981' }}>
                                        +{((game.stake * 2 * 0.9) / 1000).toFixed(0)}K $FLIP
                                    </p>
                                </>
                            ) : myPlayer ? (
                                <>
                                    <p style={{ fontSize: 36, marginBottom: 8 }}>😢 You Lost</p>
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
            40% { transform: translateX(60px) scale(1.05); }
            60% { transform: translateX(50px) rotate(5deg); }
            100% { transform: translateX(0) rotate(0); }
          }
          
          @keyframes collideLeft {
            0% { transform: translateX(0); }
            40% { transform: translateX(-60px) scale(1.05); }
            60% { transform: translateX(-50px) rotate(-5deg); }
            100% { transform: translateX(0) rotate(0); }
          }
          
          @keyframes spin {
            from { transform: rotateY(0deg); }
            to { transform: rotateY(360deg); }
          }
          
          @keyframes popIn {
            0% { transform: scale(0.5); opacity: 0; }
            70% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          
          @keyframes fadeInUp {
            0% { transform: translateY(30px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
            </div>
        </>
    )
}
