/**
 * Arena History - View your PvP game results and winnings
 * Shows stats from FlipRoyaleArena contract
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../components/Topbar'
import { useTheme } from '../lib/theme'
import {
    ARENA_CONTRACT_ADDRESS,
    ARENA_ABI,
    TIER_INFO,
    RoomStatus,
    GameMode,
    formatUSDC,
    shortenAddress
} from '../lib/contracts/arenaContract'

interface GameRecord {
    roomId: string
    tier: number
    gameMode: number
    opponent: string
    stake: bigint
    result: 'win' | 'loss' | 'draw' | 'pending'
    payout: bigint
    timestamp: number
}

export default function ArenaHistoryPage() {
    const { theme } = useTheme()
    const { address, isConnected } = useAccount()

    const [user, setUser] = useState<any>(null)

    // Get user stats from contract
    const { data: userStats } = useReadContract({
        address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
        abi: ARENA_ABI,
        functionName: 'getUserStats',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    }) as { data: [bigint, bigint, bigint, bigint] | undefined }

    // Get user room IDs from contract
    const { data: userRoomIds } = useReadContract({
        address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
        abi: ARENA_ABI,
        functionName: 'getUserRooms',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    }) as { data: `0x${string}`[] | undefined }

    // Prepare batch call for recent games (last 10)
    // Slice first to avoid massive call
    const recentRoomIds = userRoomIds ? [...userRoomIds].slice(-10).reverse() : []

    const { data: roomsData, isLoading: roomsLoading } = useReadContracts({
        contracts: recentRoomIds.map(id => ({
            address: ARENA_CONTRACT_ADDRESS as `0x${string}`,
            abi: ARENA_ABI,
            functionName: 'rooms',
            args: [id]
        })),
        query: { enabled: recentRoomIds.length > 0 }
    })

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('flipflop-user')
                if (saved) setUser(JSON.parse(saved))
            } catch { }
        }
    }, [])

    // Calculate stats
    const wins = userStats ? Number(userStats[0]) : 0
    const losses = userStats ? Number(userStats[1]) : 0
    const totalWinnings = userStats ? Number(userStats[2]) / 1_000_000 : 0
    const totalGames = wins + losses
    const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0'

    return (
        <>
            <Head>
                <title>Arena History | Flip Royale</title>
            </Head>
            <div className="app">
                <Topbar activeTab="arena" user={user} />

                <div className="panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <h2>⚔️ Arena History</h2>
                        <Link href="/arena" style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            borderRadius: 8,
                            color: '#000',
                            fontWeight: 700,
                            textDecoration: 'none',
                            fontSize: 14
                        }}>
                            Play Now →
                        </Link>
                    </div>
                    <div className="sep"></div>

                    {!isConnected ? (
                        <div style={{ textAlign: 'center', padding: 60 }}>
                            <div style={{ fontSize: 48, marginBottom: 20 }}>🎮</div>
                            <h3 style={{ marginBottom: 16, color: '#fff' }}>Connect to View History</h3>
                            <p style={{ color: '#9ca3af', marginBottom: 24 }}>
                                Connect your wallet to see your Arena game history and stats
                            </p>
                            <ConnectButton />
                        </div>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: 16,
                                marginTop: 20
                            }}>
                                <StatCard
                                    label="Total Games"
                                    value={totalGames.toString()}
                                    icon="🎮"
                                    color="#60a5fa"
                                />
                                <StatCard
                                    label="Wins"
                                    value={wins.toString()}
                                    icon="🏆"
                                    color="#22c55e"
                                />
                                <StatCard
                                    label="Losses"
                                    value={losses.toString()}
                                    icon="💔"
                                    color="#ef4444"
                                />
                                <StatCard
                                    label="Win Rate"
                                    value={`${winRate}%`}
                                    icon="📊"
                                    color="#f59e0b"
                                />
                                <StatCard
                                    label="Total Winnings"
                                    value={`$${totalWinnings.toFixed(2)}`}
                                    icon="💰"
                                    color="#10b981"
                                />
                            </div>

                            {/* Recent Games */}
                            <div style={{ marginTop: 32 }}>
                                <h3 style={{ marginBottom: 16, fontSize: 18 }}>Recent Games</h3>

                                {(!userRoomIds && !roomsData) ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                                        Loading games...
                                    </div>
                                ) : recentRoomIds.length > 0 ? (
                                    <div style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: 12,
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 100px 100px',
                                            padding: '12px 16px',
                                            background: 'rgba(255,255,255,0.05)',
                                            fontWeight: 700,
                                            fontSize: 12,
                                            color: '#9ca3af'
                                        }}>
                                            <div>Room ID</div>
                                            <div style={{ textAlign: 'center' }}>Type</div>
                                            <div style={{ textAlign: 'right' }}>Status</div>
                                        </div>
                                        {recentRoomIds.map((roomId, i) => (
                                            <RoomRow
                                                key={roomId}
                                                roomId={roomId}
                                                userAddress={address!}
                                                // roomsData is array of { result, status } objects
                                                roomData={roomsData?.[i]?.result}
                                                isLoading={roomsLoading}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: 40,
                                        background: 'rgba(0,0,0,0.2)',
                                        borderRadius: 12
                                    }}>
                                        <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                                        <p style={{ color: '#9ca3af' }}>No games yet. Start playing in the Arena!</p>
                                        <Link href="/arena" style={{
                                            display: 'inline-block',
                                            marginTop: 16,
                                            padding: '10px 24px',
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            borderRadius: 8,
                                            color: '#000',
                                            fontWeight: 700,
                                            textDecoration: 'none'
                                        }}>
                                            Enter Arena
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Info Box */}
                            <div style={{
                                marginTop: 24,
                                padding: 16,
                                background: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: 12,
                                border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 18 }}>ℹ️</span>
                                    <span style={{ fontWeight: 700, color: '#60a5fa' }}>How Payouts Work</span>
                                </div>
                                <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.6 }}>
                                    When you win a game, USDC is <strong style={{ color: '#10b981' }}>automatically sent</strong> to your wallet!
                                    Winners receive 90% of the pot. No manual claiming required.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

// Stat Card Component
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
    return (
        <div style={{
            padding: 16,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            border: `1px solid ${color}30`,
            textAlign: 'center'
        }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{label}</div>
        </div>
    )
}

// Room Row Component
function RoomRow({ roomId, userAddress, roomData, isLoading }: { roomId: `0x${string}`; userAddress: string; roomData?: any; isLoading: boolean }) {
    if (isLoading) return (
        <div style={{ padding: '16px', color: '#666', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            Loading...
        </div>
    )

    if (!roomData) return null // Or show error state

    const room = roomData
    // Ensure status is a number (Wagmi returns BigInt)
    // Handle both Object (if named params) and Array (if anonymous) returns
    // ABI: id, player1, player2, stake, tier, gameMode, status, winner...
    const status = Number(room.status !== undefined ? room.status : room[6])
    const gameMode = Number(room.gameMode !== undefined ? room.gameMode : room[5])
    const tierRaw = Number(room.tier !== undefined ? room.tier : room[4])
    const winner = room.winner || room[7]
    const tier = TIER_INFO[tierRaw as 0 | 1 | 2 | 3]

    const isWinner = winner?.toLowerCase() === userAddress.toLowerCase()

    // Check local storage for pending status if on-chain is 0/1 but we have a result
    // This fixes the "Pending" flash for optimistic UI or finding local result

    // Status Logic
    const isResolved = status === 2 // Resolved
    const isDraw = status === 3     // Draw
    const isCancelled = status === 4 // Cancelled
    const isOpen = status === 0      // Open
    const isFilled = status === 1    // Filled / In Progress

    // Updated Type Labels
    const gameType = gameMode === 0 ? 'Flip Duel' : 'Card Flip'

    let statusColor = '#9ca3af'
    let statusText = 'Pending' // Default fallback

    if (isCancelled) {
        statusColor = '#ef4444'
        statusText = 'Cancelled'
    } else if (isResolved) {
        if (isWinner) {
            statusColor = '#22c55e'
            statusText = 'Won'
        } else {
            statusColor = '#ef4444'
            statusText = 'Lost'
        }
    } else if (isDraw) {
        statusColor = '#f59e0b'
        statusText = 'Draw'
    } else if (isFilled) {
        statusColor = '#3b82f6'
        statusText = 'In Progress'
    } else if (isOpen) {
        statusColor = '#10b981'
        statusText = 'Open/Waiting'
    }

    const targetLink = `/arena/${gameMode === 0 ? 'duel' : 'card-flip'}/${roomId}`

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 100px',
            padding: '16px 16px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            alignItems: 'center',
            transition: 'background 0.2s',
        }}
            className="room-row"
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* ID and Link */}
                <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: 'monospace' }}>
                    {roomId.slice(0, 6)}...{roomId.slice(-4)}
                </div>

                {/* Replay / View Button */}
                <Link href={targetLink} style={{ textDecoration: 'none' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(255,255,255,0.1)',
                        padding: '4px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 11,
                        color: '#fff',
                        opacity: 0.8
                    }} className="hover-btn">
                        <span>{isResolved || isDraw ? '📺 Replay' : '👀 View'}</span>
                    </div>
                </Link>
            </div>

            <div style={{ textAlign: 'center' }}>
                <span style={{
                    padding: '4px 8px',
                    background: `${tier?.color || '#888'}20`,
                    color: tier?.color || '#888',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600
                }}>
                    {gameType}
                </span>
            </div>

            <div style={{
                textAlign: 'right',
                fontWeight: 700,
                color: statusColor,
                fontSize: 13
            }}>
                {statusText}
            </div>

            {/* CSS for hover effect */}
            <style jsx>{`
                .room-row:hover {
                    background: rgba(255,255,255,0.05);
                }
                .hover-btn:hover {
                    opacity: 1 !important;
                    background: rgba(255,255,255,0.2) !important;
                }
            `}</style>
        </div>
    )
}
