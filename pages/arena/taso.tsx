/**
 * Taso Lobby - Card Flip Game
 * Players pick front/back when creating or joining rooms
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../../components/Topbar'
import { useTheme } from '../../lib/theme'
import { useToast } from '../../lib/toast'

type TasoTier = 'low' | 'mid' | 'high'
type TasoChoice = 'front' | 'back'

const TIER_INFO: Record<TasoTier, { name: string; stake: string; color: string }> = {
    low: { name: 'Low', stake: '25K', color: '#10b981' },
    mid: { name: 'Medium', stake: '50K', color: '#f59e0b' },
    high: { name: 'High', stake: '100K', color: '#ef4444' },
}

interface TasoGame {
    id: string
    tier: TasoTier
    status: string
    stake: number
    player1: {
        wallet: string
        card: any
    }
}

// Choice Selection Modal
function ChoiceModal({
    isOpen,
    title,
    onClose,
    onSelect,
    loading
}: {
    isOpen: boolean
    title: string
    onClose: () => void
    onSelect: (choice: TasoChoice) => void
    loading: boolean
}) {
    if (!isOpen) return null

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
        }}>
            <div style={{
                background: 'linear-gradient(180deg, #1a1a2e, #0f0f1a)',
                borderRadius: 24,
                padding: 32,
                maxWidth: 400,
                width: '100%',
                border: '2px solid rgba(236, 72, 153, 0.4)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}>
                <h2 style={{
                    textAlign: 'center',
                    marginBottom: 8,
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#ec4899'
                }}>
                    🎯 {title}
                </h2>
                <p style={{
                    textAlign: 'center',
                    marginBottom: 24,
                    opacity: 0.7,
                    fontSize: 14
                }}>
                    Which side will the card land on?
                </p>

                <div style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 24
                }}>
                    <button
                        onClick={() => onSelect('front')}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '3px solid #10b981',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontSize: 18,
                            fontWeight: 800,
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <span style={{ fontSize: 40 }}>🎴</span>
                        FRONT
                    </button>
                    <button
                        onClick={() => onSelect('back')}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '3px solid #8b5cf6',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#8b5cf6',
                            fontSize: 18,
                            fontWeight: 800,
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <span style={{ fontSize: 40 }}>🔙</span>
                        BACK
                    </button>
                </div>

                {loading && (
                    <p style={{ textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>
                        ⏳ Processing...
                    </p>
                )}

                <button
                    onClick={onClose}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: loading ? 0.5 : 1
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

export default function TasoLobby() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const router = useRouter()
    const { address, isConnected } = useAccount()

    const [user, setUser] = useState<any>(null)
    const [openGames, setOpenGames] = useState<TasoGame[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTier, setSelectedTier] = useState<TasoTier>('low')

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('flipflop-user')
                if (saved) setUser(JSON.parse(saved))
            } catch { }
        }
    }, [])

    useEffect(() => {
        loadGames()
        const interval = setInterval(loadGames, 10000)
        return () => clearInterval(interval)
    }, [])

    const loadGames = async () => {
        try {
            const res = await fetch('/api/arena/taso/list')
            const data = await res.json()
            if (data.ok) {
                setOpenGames(data.games || [])
            }
        } catch (err) {
            console.error('Load games error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateClick = () => {
        setShowCreateModal(true)
    }

    const handleCreateConfirm = async (choice: TasoChoice) => {
        if (!address) return
        setProcessing(true)

        try {
            const res = await fetch('/api/arena/taso/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, tier: selectedTier, choice })
            })
            const data = await res.json()

            if (data.ok) {
                toast(`🃏 Room created! Your choice: ${choice === 'front' ? 'FRONT' : 'BACK'}`, 'success')
                setShowCreateModal(false)
                loadGames()
            } else {
                toast(data.error || 'Failed to create room', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setProcessing(false)
        }
    }

    const handleJoinClick = (gameId: string) => {
        setSelectedGameId(gameId)
        setShowJoinModal(true)
    }

    const handleJoinConfirm = async (choice: TasoChoice) => {
        if (!address || !selectedGameId) return
        setProcessing(true)

        try {
            const res = await fetch('/api/arena/taso/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, gameId: selectedGameId, choice })
            })
            const data = await res.json()

            if (data.ok) {
                toast('🎯 Joined game! Revealing result...', 'success')
                router.push(`/arena/taso/${selectedGameId}`)
            } else {
                toast(data.error || 'Failed to join', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setProcessing(false)
            setShowJoinModal(false)
            setSelectedGameId(null)
        }
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    return (
        <>
            <Head>
                <title>Taso | FLIP ROYALE</title>
                <meta name="description" content="Card flip game - Front or Back, test your luck!" />
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <Link href="/arena" style={{ color: 'inherit', opacity: 0.7 }}>← Arena</Link>
                        <h1 style={{
                            fontSize: 28,
                            fontWeight: 900,
                            margin: 0,
                            color: '#ec4899'
                        }}>
                            🃏 Taso
                        </h1>
                    </div>

                    {/* How to Play */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 16
                    }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#8b5cf6' }}>🎮 How to Play</h3>
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                            <li>Create a room or join an existing one</li>
                            <li><strong>Make your choice:</strong> FRONT or BACK</li>
                            <li>Cards flip and the result is determined</li>
                            <li>The correct guess wins, loser's card becomes WRECKED!</li>
                        </ol>
                    </div>

                    {/* Warning */}
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <span style={{ fontSize: 24 }}>⚠️</span>
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, color: '#ef4444' }}>Card Risk Warning</p>
                            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                                The loser's card becomes <strong>WRECKED</strong>. Wrecked cards cannot be used in any mode!
                            </p>
                        </div>
                    </div>

                    {!isConnected ? (
                        <div className="panel" style={{ textAlign: 'center', padding: 32 }}>
                            <p style={{ marginBottom: 16 }}>Connect your wallet to play Taso</p>
                            <ConnectButton />
                        </div>
                    ) : (
                        <>
                            {/* Create Game */}
                            <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🆕 Create New Room
                                </h2>

                                {/* Tier Selection */}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', marginBottom: 8, opacity: 0.7 }}>
                                        Select Stake Tier
                                    </label>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {(Object.keys(TIER_INFO) as TasoTier[]).map(tier => (
                                            <button
                                                key={tier}
                                                onClick={() => setSelectedTier(tier)}
                                                style={{
                                                    padding: '12px 24px',
                                                    borderRadius: 10,
                                                    border: selectedTier === tier ? `2px solid ${TIER_INFO[tier].color}` : '2px solid transparent',
                                                    background: selectedTier === tier ? `${TIER_INFO[tier].color}20` : 'rgba(255,255,255,0.05)',
                                                    color: selectedTier === tier ? TIER_INFO[tier].color : 'inherit',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {TIER_INFO[tier].name} ({TIER_INFO[tier].stake} $FLIP)
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateClick}
                                    style={{
                                        padding: '12px 32px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #ec4899, #db2777)',
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🃏 Create Room & Choose
                                </button>
                            </div>

                            {/* Open Games */}
                            <div className="panel" style={{ padding: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🔥 Open Rooms ({openGames.length})
                                </h2>

                                {loading ? (
                                    <p style={{ opacity: 0.6 }}>Loading...</p>
                                ) : openGames.length === 0 ? (
                                    <p style={{ opacity: 0.6 }}>No open rooms. Be the first to create one!</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {openGames.map(game => (
                                            <div
                                                key={game.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: 16,
                                                    borderRadius: 12,
                                                    background: `${TIER_INFO[game.tier]?.color || '#ec4899'}10`,
                                                    border: `1px solid ${TIER_INFO[game.tier]?.color || '#ec4899'}30`
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{
                                                            background: TIER_INFO[game.tier]?.color || '#ec4899',
                                                            color: '#000',
                                                            padding: '2px 8px',
                                                            borderRadius: 4,
                                                            fontSize: 11,
                                                            fontWeight: 700
                                                        }}>
                                                            {TIER_INFO[game.tier]?.name || game.tier}
                                                        </span>
                                                        <span style={{ opacity: 0.7, fontSize: 13 }}>
                                                            {shortenAddress(game.player1.wallet)}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                                                        🏆 Stake: {(game.stake / 1000).toFixed(0)}K $FLIP
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => handleJoinClick(game.id)}
                                                    disabled={game.player1.wallet.toLowerCase() === address?.toLowerCase()}
                                                    style={{
                                                        padding: '10px 20px',
                                                        borderRadius: 8,
                                                        border: 'none',
                                                        background: game.player1.wallet.toLowerCase() === address?.toLowerCase()
                                                            ? 'rgba(255,255,255,0.1)'
                                                            : 'linear-gradient(135deg, #10b981, #059669)',
                                                        color: '#fff',
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        opacity: game.player1.wallet.toLowerCase() === address?.toLowerCase() ? 0.5 : 1
                                                    }}
                                                >
                                                    {game.player1.wallet.toLowerCase() === address?.toLowerCase()
                                                        ? 'Your Room'
                                                        : '🎯 Join & Choose'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </main>

                {/* Create Modal */}
                <ChoiceModal
                    isOpen={showCreateModal}
                    title="Create Room"
                    onClose={() => setShowCreateModal(false)}
                    onSelect={handleCreateConfirm}
                    loading={processing}
                />

                {/* Join Modal */}
                <ChoiceModal
                    isOpen={showJoinModal}
                    title="Odaya Katıl"
                    onClose={() => {
                        setShowJoinModal(false)
                        setSelectedGameId(null)
                    }}
                    onSelect={handleJoinConfirm}
                    loading={processing}
                />
            </div>
        </>
    )
}
