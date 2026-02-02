/**
 * Flip Flop Arena - USDC Card Flip Game
 * Players pick front/back when creating or joining rooms
 * Uses FlipRoyaleArena contract for USDC stakes
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../../components/Topbar'
import { useTheme } from '../../lib/theme'
import { useToast } from '../../lib/toast'
import {
    ARENA_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    ARENA_ABI,
    ERC20_ABI,
    TIER_INFO,
    GameMode,
    RoomStatus,
    ArenaTier,
    ArenaRoom,
    formatUSDC,
    shortenAddress
} from '../../lib/contracts/arenaContract'

type TasoChoice = 'front' | 'back'

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
                            border: '2px solid #10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#fff',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎴</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>FRONT</div>
                    </button>
                    <button
                        onClick={() => onSelect('back')}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '2px solid #8b5cf6',
                            background: 'rgba(139, 92, 246, 0.1)',
                            color: '#fff',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔙</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>BACK</div>
                    </button>
                </div>

                <button
                    onClick={onClose}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        opacity: 0.7
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

export default function TasoLobby() {
    const router = useRouter()
    const { theme } = useTheme()
    const { toast } = useToast()
    const { address, isConnected } = useAccount()

    // State
    const [selectedTier, setSelectedTier] = useState<ArenaTier>(0)
    const [openRooms, setOpenRooms] = useState<ArenaRoom[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)
    const [status, setStatus] = useState<'idle' | 'approving' | 'creating' | 'joining'>('idle')
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
    const [user, setUser] = useState<any>(null)
    const [cancellingRoom, setCancellingRoom] = useState<string | null>(null)

    // Contract hooks
    const { writeContractAsync } = useWriteContract()

    // Check USDC allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, ARENA_CONTRACT_ADDRESS as `0x${string}`],
        query: { enabled: Boolean(address) },
    })

    // Check USDC balance
    const { data: usdcBalance } = useReadContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
        query: { enabled: Boolean(address) },
    })

    // Wait for transaction
    const { isSuccess: txSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    })

    // Load user data
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('flipflop-user')
            if (saved) {
                try { setUser(JSON.parse(saved)) } catch { }
            }
        }
    }, [])

    // Load open rooms from contract
    useEffect(() => {
        loadRooms()
        const interval = setInterval(loadRooms, 15000)
        return () => clearInterval(interval)
    }, [])

    const loadRooms = async () => {
        try {
            const res = await fetch('/api/arena/rooms?gameMode=1&status=0')
            const data = await res.json()
            if (data.ok) {
                setOpenRooms(data.rooms || [])
            }
        } catch (err) {
            console.error('Load rooms error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Create room flow
    const handleCreateClick = () => {
        if (!isConnected) {
            toast('Please connect your wallet', 'error')
            return
        }
        setShowCreateModal(true)
    }

    const handleCreateConfirm = async (choice: TasoChoice) => {
        if (!address) return
        setProcessing(true)

        try {
            const stake = BigInt(TIER_INFO[selectedTier].stake)

            // Check allowance
            if (!allowance || allowance < stake) {
                setStatus('approving')
                toast('Approving USDC...', 'info')

                const approveHash = await writeContractAsync({
                    address: USDC_ADDRESS as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [ARENA_CONTRACT_ADDRESS as `0x${string}`, stake * BigInt(10)]
                })

                setTxHash(approveHash)
                toast('USDC approved! Creating room...', 'success')
                await refetchAllowance()
            }

            // Create room on contract
            setStatus('creating')
            toast('Creating room...', 'info')

            const createHash = await writeContractAsync({
                address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
                abi: ARENA_ABI,
                functionName: 'createRoom',
                args: [selectedTier, GameMode.Taso]
            })

            setTxHash(createHash)

            // Save choice to backend for Oracle
            await fetch('/api/arena/taso/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: address,
                    txHash: createHash,
                    choice,
                    tier: selectedTier
                })
            })

            toast(`🃏 Room created! Your choice: ${choice.toUpperCase()}`, 'success')
            setShowCreateModal(false)
            loadRooms()

        } catch (err: any) {
            console.error(err)
            toast(err.shortMessage || err.message || 'Failed to create room', 'error')
        } finally {
            setProcessing(false)
            setStatus('idle')
        }
    }

    // Join room flow
    const handleJoinClick = (roomId: string) => {
        if (!isConnected) {
            toast('Please connect your wallet', 'error')
            return
        }
        setSelectedRoomId(roomId)
        setShowJoinModal(true)
    }

    const handleJoinConfirm = async (choice: TasoChoice) => {
        if (!address || !selectedRoomId) return
        setProcessing(true)

        try {
            const room = openRooms.find(r => r.id === selectedRoomId)
            if (!room) throw new Error('Room not found')

            const stake = room.stake

            // Check allowance
            if (!allowance || allowance < stake) {
                setStatus('approving')
                toast('Approving USDC...', 'info')

                const approveHash = await writeContractAsync({
                    address: USDC_ADDRESS as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [ARENA_CONTRACT_ADDRESS as `0x${string}`, stake * BigInt(10)]
                })

                setTxHash(approveHash)
                toast('USDC approved! Joining room...', 'success')
                await refetchAllowance()
            }

            // Join room on contract
            setStatus('joining')
            toast('Joining room...', 'info')

            const joinHash = await writeContractAsync({
                address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
                abi: ARENA_ABI,
                functionName: 'joinRoom',
                args: [selectedRoomId as `0x${string}`]
            })

            setTxHash(joinHash)

            // Save choice to backend for Oracle resolution
            await fetch('/api/arena/taso/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: address,
                    roomId: selectedRoomId,
                    txHash: joinHash,
                    choice
                })
            })

            toast('🎯 Joined! Resolving game...', 'success')

            // Trigger Oracle resolution
            await fetch('/api/arena/taso/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: selectedRoomId })
            })

            // Navigate to game page
            router.push(`/arena/taso/${selectedRoomId}`)

        } catch (err: any) {
            console.error(err)
            toast(err.shortMessage || err.message || 'Failed to join', 'error')
        } finally {
            setProcessing(false)
            setStatus('idle')
            setShowJoinModal(false)
            setSelectedRoomId(null)
        }
    }

    // Cancel room function
    const handleCancelRoom = async (roomId: string) => {
        if (!address) return

        setCancellingRoom(roomId)
        try {
            toast('Cancelling room...', 'info')

            const cancelHash = await writeContractAsync({
                address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
                abi: ARENA_ABI,
                functionName: 'cancelRoom',
                args: [roomId as `0x${string}`]
            })

            setTxHash(cancelHash)
            toast('Room cancelled! USDC refunded 💰', 'success')

            // Reload rooms
            setTimeout(loadRooms, 2000)

        } catch (err: any) {
            console.error(err)
            toast(err.shortMessage || err.message || 'Failed to cancel', 'error')
        } finally {
            setCancellingRoom(null)
        }
    }

    const balance = usdcBalance ? Number(usdcBalance) / 1_000_000 : 0

    return (
        <>
            <Head>
                <title>Flip Flop | FLIP ROYALE</title>
                <meta name="description" content="USDC card flip arena - Pick FRONT or BACK!" />
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <Link href="/arena" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, opacity: 0.7 }}>
                        ← Arena
                    </Link>

                    <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: '#ec4899' }}>
                        🃏 Flip Flop
                    </h1>

                    {/* USDC Balance */}
                    {isConnected && (
                        <div style={{
                            display: 'inline-block',
                            background: 'rgba(16, 185, 129, 0.2)',
                            padding: '8px 16px',
                            borderRadius: 8,
                            marginBottom: 24,
                            fontSize: 14
                        }}>
                            💵 USDC Balance: <strong>${balance.toFixed(2)}</strong>
                        </div>
                    )}

                    {/* How to Play */}
                    <div className="panel" style={{ padding: 20, marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#ec4899' }}>
                            📖 How to Play
                        </h3>
                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, opacity: 0.85 }}>
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
                            <p style={{ marginBottom: 16 }}>Connect your wallet to play Flip Flop</p>
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
                                        Select Stake Tier (USDC)
                                    </label>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {([0, 1, 2, 3] as ArenaTier[]).map(tier => (
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
                                                {TIER_INFO[tier].name} ({TIER_INFO[tier].stakeFormatted})
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateClick}
                                    disabled={processing}
                                    style={{
                                        padding: '12px 32px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #ec4899, #db2777)',
                                        color: '#fff',
                                        fontSize: 14,
                                        fontWeight: 800,
                                        cursor: processing ? 'wait' : 'pointer',
                                        opacity: processing ? 0.7 : 1
                                    }}
                                >
                                    {processing ? (
                                        status === 'approving' ? '⏳ Approving USDC...' :
                                            status === 'creating' ? '⏳ Creating Room...' :
                                                '⏳ Processing...'
                                    ) : '🃏 Create Room & Choose'}
                                </button>
                            </div>

                            {/* Open Games */}
                            <div className="panel" style={{ padding: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🔥 Open Rooms ({openRooms.length})
                                </h2>

                                {loading ? (
                                    <p style={{ opacity: 0.6 }}>Loading...</p>
                                ) : openRooms.length === 0 ? (
                                    <p style={{ opacity: 0.6 }}>No open rooms. Be the first to create one!</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {openRooms.map(room => (
                                            <div
                                                key={room.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: 16,
                                                    borderRadius: 12,
                                                    background: `${TIER_INFO[room.tier]?.color || '#ec4899'}10`,
                                                    border: `1px solid ${TIER_INFO[room.tier]?.color || '#ec4899'}30`
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <span style={{
                                                            background: TIER_INFO[room.tier]?.color || '#ec4899',
                                                            color: '#000',
                                                            padding: '2px 8px',
                                                            borderRadius: 4,
                                                            fontSize: 11,
                                                            fontWeight: 700
                                                        }}>
                                                            {TIER_INFO[room.tier]?.name || 'Unknown'}
                                                        </span>
                                                        <span style={{ opacity: 0.7, fontSize: 13 }}>
                                                            {shortenAddress(room.player1)}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                                                        🏆 Stake: {formatUSDC(Number(room.stake))} USDC
                                                    </p>
                                                </div>

                                                {room.player1.toLowerCase() === address?.toLowerCase() ? (
                                                    <button
                                                        onClick={() => handleCancelRoom(room.id)}
                                                        disabled={cancellingRoom === room.id}
                                                        style={{
                                                            padding: '10px 20px',
                                                            borderRadius: 8,
                                                            border: 'none',
                                                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                                            color: '#fff',
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            cursor: cancellingRoom === room.id ? 'wait' : 'pointer',
                                                            opacity: cancellingRoom === room.id ? 0.7 : 1
                                                        }}
                                                    >
                                                        {cancellingRoom === room.id ? '⏳ Cancelling...' : '❌ Cancel & Refund'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleJoinClick(room.id)}
                                                        disabled={processing}
                                                        style={{
                                                            padding: '10px 20px',
                                                            borderRadius: 8,
                                                            border: 'none',
                                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                                            color: '#fff',
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        🎯 Join & Choose
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
                    title="Join Room"
                    onClose={() => {
                        setShowJoinModal(false)
                        setSelectedRoomId(null)
                    }}
                    onSelect={handleJoinConfirm}
                    loading={processing}
                />
            </div>
        </>
    )
}
