/**
 * Flip Flop Arena - USDC Card Flip Game
 * Players pick front/back when creating or joining rooms
 * Uses FlipRoyaleArena contract for USDC stakes
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseEventLogs } from 'viem'
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
import { CardInstance, getDurabilityVisual } from '../../lib/cardInstance'
import { getCardCSSStyles } from '../../lib/cardStyles'
import { TOKEN_MAP } from '../../lib/tokens'

type TasoChoice = 'front' | 'back'

// Card Selector Component
function CardSelector({
    cards,
    selectedId,
    onSelect
}: {
    cards: any[] // enriched cards with token data
    selectedId: string | null
    onSelect: (id: string) => void
}) {
    if (cards.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 20, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12 }}>
                <p style={{ color: '#ef4444', marginBottom: 8 }}>❌ You have no active cards!</p>
                <Link href="/cards/buy" style={{ textDecoration: 'underline', fontSize: 14 }}>
                    Buy a Pack to Play
                </Link>
            </div>
        )
    }

    return (
        <div style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            padding: '8px 4px',
            marginBottom: 24,
            scrollbarWidth: 'thin'
        }}>
            {cards.map(card => {
                const isSelected = card.id === selectedId
                const styles = getCardCSSStyles(card.cardType || 'pegasus')

                return (
                    <div
                        key={card.id}
                        onClick={() => onSelect(card.id)}
                        style={{
                            minWidth: 100,
                            height: 140,
                            borderRadius: 12,
                            border: isSelected ? '3px solid #ec4899' : `2px solid ${styles.borderColor}`,
                            background: styles.background,
                            position: 'relative',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                            opacity: isSelected ? 1 : 0.8,
                            boxShadow: isSelected ? '0 0 15px rgba(236, 72, 153, 0.5)' : 'none'
                        }}
                    >
                        {/* Card Content Mockup */}
                        <img
                            src={card.logo || '/token-logos/placeholder.png'}
                            alt={card.symbol}
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                marginBottom: 8,
                                objectFit: 'cover'
                            }}
                            onError={(e) => (e.currentTarget.src = '/token-logos/placeholder.png')}
                        />
                        <div style={{
                            fontSize: 12,
                            fontWeight: 900,
                            color: styles.textColor,
                            textAlign: 'center'
                        }}>
                            {card.symbol}
                        </div>
                        <div style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: styles.typeColor,
                            background: 'rgba(0,0,0,0.3)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginTop: 4
                        }}>
                            {String(card.cardType || 'Item').toUpperCase()}
                        </div>

                        {isSelected && (
                            <div style={{
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                background: '#ec4899',
                                color: '#fff',
                                borderRadius: '50%',
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                fontWeight: 'bold',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                            }}>✓</div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// Choice Selection Modal
function ChoiceModal({
    isOpen,
    title,
    onClose,
    onSelect,
    loading,
    cards,
    selectedCardId,
    setSelectedCardId
}: {
    isOpen: boolean
    title: string
    onClose: () => void
    onSelect: (choice: TasoChoice) => void
    loading: boolean
    cards: any[]
    selectedCardId: string | null
    setSelectedCardId: (id: string) => void
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
                maxWidth: 480,
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

                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 10px', opacity: 0.9 }}>
                    1. Select Wager Card
                </h3>
                <p style={{ fontSize: 12, opacity: 0.6, margin: '-5px 0 12px' }}>
                    If you lose, this card will be <strong>WRECKED!</strong> 💀
                </p>

                <CardSelector
                    cards={cards}
                    selectedId={selectedCardId}
                    onSelect={setSelectedCardId}
                />

                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 10px', opacity: 0.9 }}>
                    2. Choose Side
                </h3>

                <div style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 24
                }}>
                    <button
                        onClick={() => selectedCardId && onSelect('front')}
                        disabled={loading || !selectedCardId}
                        style={{
                            flex: 1,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '2px solid #10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#fff',
                            cursor: (loading || !selectedCardId) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: (loading || !selectedCardId) ? 0.5 : 1
                        }}
                    >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎴</div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>FRONT</div>
                    </button>
                    <button
                        onClick={() => selectedCardId && onSelect('back')}
                        disabled={loading || !selectedCardId}
                        style={{
                            flex: 1,
                            padding: '24px 16px',
                            borderRadius: 16,
                            border: '2px solid #8b5cf6',
                            background: 'rgba(139, 92, 246, 0.1)',
                            color: '#fff',
                            cursor: (loading || !selectedCardId) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: (loading || !selectedCardId) ? 0.5 : 1
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
    const publicClient = usePublicClient()

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

    // Cards State
    const [userCards, setUserCards] = useState<any[]>([])
    const [cardsLoading, setCardsLoading] = useState(false)
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

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

    // Load user cards
    useEffect(() => {
        if (address) {
            fetchUserCards(address)
        } else {
            setUserCards([])
        }
    }, [address])

    const fetchUserCards = async (wallet: string) => {
        setCardsLoading(true)
        try {
            // First sync to ensure latest
            await fetch('/api/cards/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet })
            })

            // Then fetch inventory
            const res = await fetch(`/api/cards/inventory?wallet=${wallet}`)
            const data = await res.json()
            if (data.ok) {
                // Filter only active cards with > 0 durability
                const active = data.cards.filter((c: any) => c.status === 'active' && (c.durability > 0 || c.durability === undefined))

                // Enrich with token metadata if needed (though sync usually does this via KV logic or we do it here)
                // For now assuming inventory returns enriched data or we have it. 
                // Actually inventory.ts returns CardInstance[], which has tokenId but NO logo/symbol.
                // We need to match with TOKENS locally or fetch enriched. 
                // Let's assume we need to enrich here for display.

                // Fetch tokens
                const tokensRes = await import('../../lib/tokens') // Dynamic import for client side safety? 
                // Better: fetch user cards endpoint is simpler. 
                // Actually, let's just map locally if we can or fetch enriched.
                // Since I cannot easily import server-side libs here, I will rely on what I have.
                // Or I can update `inventory.ts` to return enriched cards. 
                // Optimization: Update inventory logic or map on client.

                // Let's use a simpler approach: client-side mapping for now if possible, 
                // or just show placeholders? No, user wants REAL visuals.
                // I'll assume `inventory` endpoint can be updated or I fetch tokens list.
                // Wait, tokens list is large.
                // Let's quickly update `inventory.ts` to return enriched data? 
                // No, sticking to client side enrichment if possible.
                // I will add a `/api/tokens` endpoint? 
                // Actually, I can just use the provided styles helper `getCardCSSStyles` which handles colors.
                // Only LOGO and NAME are missing.
                // I'll blindly attempt to use `/token-logos/{tokenId}.png` as a heuristic.

                const enriched = active.map((c: any) => {
                    const tokenData = TOKEN_MAP[c.tokenId.toLowerCase()]
                    return {
                        ...c,
                        symbol: tokenData?.symbol || c.tokenId.toUpperCase(),
                        logo: tokenData?.logo || `/token-logos/${c.tokenId.toLowerCase()}.png`
                    }
                })

                setUserCards(enriched)
                if (enriched.length > 0) setSelectedCardId(enriched[0].id)
            }
        } catch (err) {
            console.error('Fetch cards error:', err)
        } finally {
            setCardsLoading(false)
        }
    }

    // Load open rooms from contract
    useEffect(() => {
        loadRooms()
        const interval = setInterval(loadRooms, 5000)
        return () => clearInterval(interval)
    }, [])

    const loadRooms = async () => {
        try {
            // Use KV-based instant list instead of RPC scan
            const res = await fetch('/api/arena/taso/list')
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
        if (!address || !publicClient) return
        if (!selectedCardId) {
            toast('Please select a card to wager!', 'error')
            return
        }

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
                // Wait for approval to be mined
                await publicClient.waitForTransactionReceipt({ hash: approveHash })
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
            toast('Waiting for confirmation...', 'info')

            // Wait for receipt to get Room ID
            const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash })

            // Parse Event to find Room Creation logs
            const logs = parseEventLogs({
                abi: ARENA_ABI,
                eventName: 'RoomCreated',
                logs: receipt.logs,
            })

            const createdRoomId = logs[0]?.args.roomId

            if (!createdRoomId) {
                throw new Error('Room created but ID not found in logs')
            }

            console.log('Room Created:', createdRoomId)

            // Save choice to backend for Oracle
            await fetch('/api/arena/taso/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: address,
                    gameId: createdRoomId, // Use the real ID
                    txHash: createHash,
                    choice,
                    tier: selectedTier,
                    cardId: selectedCardId // PASS CARD ID
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
        if (!address || !selectedRoomId || !publicClient) return
        if (!selectedCardId) {
            toast('Please select a card to wager!', 'error')
            return
        }

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
                await publicClient.waitForTransactionReceipt({ hash: approveHash })
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
            toast('Waiting for confirmation...', 'info')

            // Wait for receipt to ensure we are in contract
            await publicClient.waitForTransactionReceipt({ hash: joinHash })

            // Save choice to backend for Oracle resolution
            await fetch('/api/arena/taso/choice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: address,
                    gameId: selectedRoomId, // Use gameId as expected by backend
                    roomId: selectedRoomId, // Fallback alias
                    txHash: joinHash,
                    choice,
                    cardId: selectedCardId // PASS CARD ID
                })
            })

            toast('🎯 Joined! Resolving game...', 'success')

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

            // 1. Cancel on Chain (Refund USDC)
            const cancelHash = await writeContractAsync({
                address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
                abi: ARENA_ABI,
                functionName: 'cancelRoom',
                args: [roomId as `0x${string}`]
            })

            setTxHash(cancelHash)
            toast('Refund TX Sent! Updating list...', 'success')

            // 2. Remove from KV (Instant UI update)
            await fetch('/api/arena/taso/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, gameId: roomId })
            })

            // Reload rooms immediately
            loadRooms()

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
                            <li><strong>Select Your Wager Card</strong> (Active cards only)</li>
                            <li><strong>Make your choice:</strong> FRONT or BACK</li>
                            <li>Cards flip and the result is determined</li>
                            <li>The correct guess wins, loser's card becomes <strong>WRECKED!</strong></li>
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
                    cards={userCards}
                    selectedCardId={selectedCardId}
                    setSelectedCardId={setSelectedCardId}
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
                    cards={userCards}
                    selectedCardId={selectedCardId}
                    setSelectedCardId={setSelectedCardId}
                />
            </div>
        </>
    )
}
