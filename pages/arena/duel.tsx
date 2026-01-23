/**
 * Flip Duel Lobby - FDV Battle Matchmaking
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

type DuelTier = 'bronze' | 'silver' | 'gold' | 'diamond'

interface Duel {
    id: string
    tier: DuelTier
    status: string
    createdAt: number
    player1: {
        wallet: string
        cards: any[]
        totalFdv: number
    }
    stake: number
    pot: number
    winnerPayout: number
}

const TIER_INFO: Record<DuelTier, { name: string; color: string; stake: string }> = {
    bronze: { name: 'Bronze', color: '#cd7f32', stake: '10K' },
    silver: { name: 'Silver', color: '#c0c0c0', stake: '50K' },
    gold: { name: 'Gold', color: '#ffd700', stake: '100K' },
    diamond: { name: 'Diamond', color: '#b9f2ff', stake: '500K' },
}

export default function FlipDuelLobby() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const router = useRouter()
    const { address, isConnected } = useAccount()

    const [user, setUser] = useState<any>(null)
    const [openDuels, setOpenDuels] = useState<Duel[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [joining, setJoining] = useState<string | null>(null)
    const [selectedTier, setSelectedTier] = useState<DuelTier>('bronze')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('flipflop-user')
                if (saved) setUser(JSON.parse(saved))
            } catch { }
        }
    }, [])

    useEffect(() => {
        loadDuels()
        const interval = setInterval(loadDuels, 10000)
        return () => clearInterval(interval)
    }, [])

    const loadDuels = async () => {
        try {
            const res = await fetch('/api/arena/duel/list')
            const data = await res.json()
            if (data.ok) {
                setOpenDuels(data.duels || [])
            }
        } catch (err) {
            console.error('Load duels error:', err)
        } finally {
            setLoading(false)
        }
    }

    const createDuel = async () => {
        if (!address) return
        setCreating(true)

        try {
            const res = await fetch('/api/arena/duel/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, tier: selectedTier })
            })
            const data = await res.json()

            if (data.ok) {
                toast(`⚔️ Duel odası oluşturuldu! ID: ${data.duel.id.slice(-6)}`, 'success')
                loadDuels()
            } else {
                toast(data.error || 'Oda oluşturulamadı', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Hata', 'error')
        } finally {
            setCreating(false)
        }
    }

    const joinDuel = async (duelId: string) => {
        if (!address) return
        setJoining(duelId)

        try {
            const res = await fetch('/api/arena/duel/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, duelId })
            })
            const data = await res.json()

            if (data.ok) {
                toast('🎯 Duel sonuçlandı!', 'success')
                // Navigate to result page
                router.push(`/arena/duel/${duelId}`)
            } else {
                toast(data.error || 'Katılım başarısız', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Hata', 'error')
        } finally {
            setJoining(null)
        }
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    return (
        <>
            <Head>
                <title>Flip Duel | FLIP ROYALE</title>
                <meta name="description" content="FDV tabanlı 1v1 PvP - Kartlarının FDV değerini test et!" />
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
                            color: '#f59e0b'
                        }}>
                            ⚔️ Flip Duel
                        </h1>
                    </div>

                    {!isConnected ? (
                        <div className="panel" style={{ textAlign: 'center', padding: 32 }}>
                            <p style={{ marginBottom: 16 }}>Duel'e girmek için cüzdanını bağla</p>
                            <ConnectButton />
                        </div>
                    ) : (
                        <>
                            {/* Create Duel Section */}
                            <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🆕 Yeni Duel Oluştur
                                </h2>

                                {/* Tier Selection */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {(Object.keys(TIER_INFO) as DuelTier[]).map(tier => (
                                        <button
                                            key={tier}
                                            onClick={() => setSelectedTier(tier)}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: 10,
                                                border: selectedTier === tier ? `2px solid ${TIER_INFO[tier].color}` : '2px solid transparent',
                                                background: selectedTier === tier ? `${TIER_INFO[tier].color}20` : 'rgba(255,255,255,0.05)',
                                                color: TIER_INFO[tier].color,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {TIER_INFO[tier].name} ({TIER_INFO[tier].stake} $FLIP)
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={createDuel}
                                    disabled={creating}
                                    style={{
                                        padding: '12px 32px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        color: '#000',
                                        fontSize: 14,
                                        fontWeight: 800,
                                        cursor: creating ? 'wait' : 'pointer',
                                        opacity: creating ? 0.6 : 1
                                    }}
                                >
                                    {creating ? '⏳ Oluşturuluyor...' : '⚔️ Oda Oluştur'}
                                </button>
                            </div>

                            {/* Open Duels */}
                            <div className="panel" style={{ padding: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🔥 Açık Odalar ({openDuels.length})
                                </h2>

                                {loading ? (
                                    <p style={{ opacity: 0.6 }}>Yükleniyor...</p>
                                ) : openDuels.length === 0 ? (
                                    <p style={{ opacity: 0.6 }}>Açık oda yok. İlk sen oluştur!</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {openDuels.map(duel => (
                                            <div
                                                key={duel.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: 16,
                                                    borderRadius: 12,
                                                    background: `${TIER_INFO[duel.tier].color}10`,
                                                    border: `1px solid ${TIER_INFO[duel.tier].color}30`
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{
                                                            background: TIER_INFO[duel.tier].color,
                                                            color: '#000',
                                                            padding: '2px 8px',
                                                            borderRadius: 4,
                                                            fontSize: 11,
                                                            fontWeight: 700
                                                        }}>
                                                            {TIER_INFO[duel.tier].name}
                                                        </span>
                                                        <span style={{ opacity: 0.7, fontSize: 13 }}>
                                                            {shortenAddress(duel.player1.wallet)}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                                                        🏆 Pot: {(duel.pot / 1000).toFixed(0)}K $FLIP
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => joinDuel(duel.id)}
                                                    disabled={joining === duel.id || duel.player1.wallet.toLowerCase() === address?.toLowerCase()}
                                                    style={{
                                                        padding: '10px 20px',
                                                        borderRadius: 8,
                                                        border: 'none',
                                                        background: duel.player1.wallet.toLowerCase() === address?.toLowerCase()
                                                            ? 'rgba(255,255,255,0.1)'
                                                            : 'linear-gradient(135deg, #10b981, #059669)',
                                                        color: '#fff',
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        cursor: joining === duel.id ? 'wait' : 'pointer',
                                                        opacity: duel.player1.wallet.toLowerCase() === address?.toLowerCase() ? 0.5 : 1
                                                    }}
                                                >
                                                    {duel.player1.wallet.toLowerCase() === address?.toLowerCase()
                                                        ? 'Senin Odan'
                                                        : joining === duel.id
                                                            ? '⏳ Katılıyor...'
                                                            : '🎯 Katıl'}
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
