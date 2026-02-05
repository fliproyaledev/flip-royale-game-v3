/**
 * Flip Duel Lobby - FDV Battle Matchmaking
 * Uses FlipRoyaleArena contract for USDC stakes
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../../components/Topbar'
import { useTheme } from '../../lib/theme'
import { useToast } from '../../lib/toast'
import {
    ARENA_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    ARENA_ABI,
    ERC20_ABI,
    TIER_INFO as CONTRACT_TIERS,
    GameMode
} from '../../lib/contracts/arenaContract'

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

const TIER_ORDER: DuelTier[] = ['bronze', 'silver', 'gold', 'diamond']

const TIER_INFO: Record<DuelTier, { name: string; color: string; stake: string; amount: number }> = {
    bronze: { name: 'Bronze', color: '#cd7f32', stake: '$10', amount: 10_000_000 },
    silver: { name: 'Silver', color: '#c0c0c0', stake: '$25', amount: 25_000_000 },
    gold: { name: 'Gold', color: '#ffd700', stake: '$50', amount: 50_000_000 },
    diamond: { name: 'Diamond', color: '#b9f2ff', stake: '$100', amount: 100_000_000 },
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
    const [approving, setApproving] = useState(false)
    const [cancellingRoom, setCancellingRoom] = useState<string | null>(null)

    // Contract hooks
    const { writeContract: approveUSDC, data: approveHash, isPending: approvePending } = useWriteContract()
    const { writeContract: createRoomContract, data: createHash, isPending: createPending } = useWriteContract()
    const { writeContract: joinRoomContract, data: joinHash, isPending: joinPending } = useWriteContract()
    const { writeContractAsync } = useWriteContract()

    // Wait for transactions
    const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
    const { isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createHash })
    const { isSuccess: joinSuccess } = useWaitForTransactionReceipt({ hash: joinHash })

    // Check USDC allowance
    const { data: allowance } = useReadContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, ARENA_CONTRACT_ADDRESS as `0x${string}`] : undefined,
        query: { enabled: !!address }
    })

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
                toast(`⚔️ Duel room created! ID: ${data.duel.id.slice(-6)}`, 'success')
                loadDuels()
            } else {
                toast(data.error || 'Failed to create room', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
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
                toast('🎯 Duel resolved!', 'success')
                router.push(`/arena/duel/${duelId}`)
            } else {
                toast(data.error || 'Failed to join', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setJoining(null)
        }
    }

    // Cancel room function
    const handleCancelRoom = async (roomId: string) => {
        if (!address) return

        setCancellingRoom(roomId)
        try {
            toast('Cancelling room...', 'info')

            await writeContractAsync({
                address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
                abi: ARENA_ABI,
                functionName: 'cancelRoom',
                args: [roomId as `0x${string}`]
            })

            toast('Room cancelled! USDC refunded 💰', 'success')

            // Reload rooms
            setTimeout(loadDuels, 2000)

        } catch (err: any) {
            console.error(err)
            toast(err.shortMessage || err.message || 'Failed to cancel', 'error')
        } finally {
            setCancellingRoom(null)
        }
    }

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    return (
        <>
            <Head>
                <title>Flip Duel | FLIP ROYALE</title>
                <meta name="description" content="FDV-based 1v1 PvP - Test your cards' FDV value!" />
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
                            <p style={{ marginBottom: 16 }}>Connect your wallet to enter duels</p>
                            <ConnectButton />
                        </div>
                    ) : (
                        <>
                            {/* Create Duel Section */}
                            <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🆕 Create New Duel
                                </h2>

                                {/* Tier Selection */}
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {TIER_ORDER.map(tier => (
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
                                            {TIER_INFO[tier].name} ({TIER_INFO[tier].stake} USDC)
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
                                    {creating ? '⏳ Creating...' : '⚔️ Create Room'}
                                </button>
                            </div>

                            {/* Open Duels */}
                            <div className="panel" style={{ padding: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🔥 Open Rooms ({openDuels.length})
                                </h2>

                                {loading ? (
                                    <p style={{ opacity: 0.6 }}>Loading...</p>
                                ) : openDuels.length === 0 ? (
                                    <p style={{ opacity: 0.6 }}>No open rooms. Be the first to create one!</p>
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
                                                        🏆 Pot: ${(duel.pot / 1_000_000).toFixed(0)} USDC
                                                    </p>
                                                </div>

                                                {duel.player1.wallet.toLowerCase() === address?.toLowerCase() ? (
                                                    <button
                                                        onClick={() => handleCancelRoom(duel.id)}
                                                        disabled={cancellingRoom === duel.id}
                                                        style={{
                                                            padding: '10px 20px',
                                                            borderRadius: 8,
                                                            border: 'none',
                                                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                            color: '#fff',
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            cursor: cancellingRoom === duel.id ? 'wait' : 'pointer',
                                                            opacity: cancellingRoom === duel.id ? 0.7 : 1
                                                        }}
                                                    >
                                                        {cancellingRoom === duel.id ? '⏳ Cancelling...' : '❌ Cancel & Refund'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => joinDuel(duel.id)}
                                                        disabled={joining === duel.id}
                                                        style={{
                                                            padding: '10px 20px',
                                                            borderRadius: 8,
                                                            border: 'none',
                                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                                            color: '#fff',
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            cursor: joining === duel.id ? 'wait' : 'pointer'
                                                        }}
                                                    >
                                                        {joining === duel.id ? '⏳ Joining...' : '🎯 Join'}
                                                    </button>
                                                )}
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
