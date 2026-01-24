/**
 * Taso Lobby - Card Flip Game
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

export default function TasoLobby() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const router = useRouter()
    const { address, isConnected } = useAccount()

    const [user, setUser] = useState<any>(null)
    const [openGames, setOpenGames] = useState<TasoGame[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [joining, setJoining] = useState<string | null>(null)
    const [selectedTier, setSelectedTier] = useState<TasoTier>('low')

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

    const createGame = async () => {
        if (!address) return
        setCreating(true)

        try {
            const res = await fetch('/api/arena/taso/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, tier: selectedTier })
            })
            const data = await res.json()

            if (data.ok) {
                toast(`🃏 Taso room created! ID: ${data.game.id.slice(-6)}`, 'success')
                loadGames()
            } else {
                toast(data.error || 'Failed to create room', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setCreating(false)
        }
    }

    const joinGame = async (gameId: string) => {
        if (!address) return
        setJoining(gameId)

        try {
            const res = await fetch('/api/arena/taso/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, gameId })
            })
            const data = await res.json()

            if (data.ok) {
                toast('🎯 Joined game!', 'success')
                router.push(`/arena/taso/${gameId}`)
            } else {
                toast(data.error || 'Failed to join', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setJoining(null)
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
                                The loser's card becomes <strong>WRECKED</strong> in Taso mode. Wrecked cards cannot be used in any game mode!
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
                                    🆕 Create New Game
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
                                    onClick={createGame}
                                    disabled={creating}
                                    style={{
                                        padding: '12px 32px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #ec4899, #db2777)',
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 800,
                                        cursor: creating ? 'wait' : 'pointer',
                                        opacity: creating ? 0.6 : 1
                                    }}
                                >
                                    {creating ? '⏳ Creating...' : '🃏 Create Room'}
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
                                                    onClick={() => joinGame(game.id)}
                                                    disabled={joining === game.id || game.player1.wallet.toLowerCase() === address?.toLowerCase()}
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
                                                        cursor: joining === game.id ? 'wait' : 'pointer',
                                                        opacity: game.player1.wallet.toLowerCase() === address?.toLowerCase() ? 0.5 : 1
                                                    }}
                                                >
                                                    {game.player1.wallet.toLowerCase() === address?.toLowerCase()
                                                        ? 'Your Room'
                                                        : joining === game.id
                                                            ? '⏳ Joining...'
                                                            : '🎯 Join'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </>
    )
}
