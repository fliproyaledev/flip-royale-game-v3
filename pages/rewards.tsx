/**
 * Rewards / Withdraw Page - Claim your Arena winnings
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../components/Topbar'
import { useTheme } from '../lib/theme'
import { useToast } from '../lib/toast'

interface ClaimRecord {
    id: string
    amount: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    createdAt: number
}

export default function RewardsPage() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const { address, isConnected } = useAccount()

    const [user, setUser] = useState<any>(null)
    const [balance, setBalance] = useState(0)
    const [history, setHistory] = useState<ClaimRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [claimAmount, setClaimAmount] = useState('')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('flipflop-user')
                if (saved) setUser(JSON.parse(saved))
            } catch { }
        }
    }, [])

    useEffect(() => {
        if (address) loadRewards()
    }, [address])

    const loadRewards = async () => {
        if (!address) return
        setLoading(true)

        try {
            const res = await fetch(`/api/arena/rewards?wallet=${address}`)
            const data = await res.json()

            if (data.ok) {
                setBalance(data.balance || 0)
                setHistory(data.history || [])
            }
        } catch (err) {
            console.error('Load rewards error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleClaim = async () => {
        const amount = parseInt(claimAmount)
        if (!amount || amount <= 0) {
            toast('Enter a valid amount', 'error')
            return
        }
        if (amount > balance) {
            toast('Insufficient balance', 'error')
            return
        }

        setClaiming(true)
        try {
            const res = await fetch('/api/arena/rewards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: address, amount })
            })
            const data = await res.json()

            if (data.ok) {
                toast(`🎉 Claim submitted! ${(amount / 1000).toFixed(0)}K $FLIP`, 'success')
                setBalance(data.newBalance)
                setClaimAmount('')
                loadRewards()
            } else {
                toast(data.error || 'Claim failed', 'error')
            }
        } catch (err: any) {
            toast(err.message || 'Error', 'error')
        } finally {
            setClaiming(false)
        }
    }

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return '#10b981'
            case 'pending': return '#f59e0b'
            case 'processing': return '#3b82f6'
            case 'failed': return '#ef4444'
            default: return '#888'
        }
    }

    return (
        <>
            <Head>
                <title>Rewards | FLIP ROYALE</title>
                <meta name="description" content="Claim your Arena winnings" />
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="arena" user={user} />

                <main style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                        <Link href="/arena" style={{ color: 'inherit', opacity: 0.7 }}>← Arena</Link>
                        <h1 style={{
                            fontSize: 28,
                            fontWeight: 900,
                            margin: 0,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            💰 Rewards
                        </h1>
                    </div>

                    {!isConnected ? (
                        <div className="panel" style={{ textAlign: 'center', padding: 32 }}>
                            <p style={{ marginBottom: 16 }}>Connect your wallet to view rewards</p>
                            <ConnectButton />
                        </div>
                    ) : loading ? (
                        <div className="panel" style={{ textAlign: 'center', padding: 32 }}>
                            <p>⏳ Loading...</p>
                        </div>
                    ) : (
                        <>
                            {/* Balance Card */}
                            <div className="panel" style={{
                                padding: 32,
                                marginBottom: 24,
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))',
                                border: '2px solid rgba(16, 185, 129, 0.3)'
                            }}>
                                <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                                    Available Balance
                                </p>
                                <p style={{
                                    fontSize: 42,
                                    fontWeight: 900,
                                    margin: 0,
                                    color: '#10b981'
                                }}>
                                    {(balance / 1000).toFixed(0)}K $FLIP
                                </p>
                                <p style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
                                    ≈ {balance.toLocaleString()} $FLIP
                                </p>
                            </div>

                            {/* Claim Section */}
                            <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🏧 Withdraw
                                </h2>

                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <input
                                        type="number"
                                        value={claimAmount}
                                        onChange={e => setClaimAmount(e.target.value)}
                                        placeholder="Amount ($FLIP)"
                                        style={{
                                            flex: 1,
                                            padding: '12px 16px',
                                            borderRadius: 10,
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'inherit',
                                            fontSize: 16
                                        }}
                                    />
                                    <button
                                        onClick={() => setClaimAmount(balance.toString())}
                                        style={{
                                            padding: '12px 20px',
                                            borderRadius: 10,
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10b981',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        MAX
                                    </button>
                                </div>

                                {/* Quick amounts */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {[10000, 50000, 100000].filter(v => v <= balance).map(amount => (
                                        <button
                                            key={amount}
                                            onClick={() => setClaimAmount(amount.toString())}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(255,255,255,0.05)',
                                                color: 'inherit',
                                                fontSize: 13,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {(amount / 1000).toFixed(0)}K
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleClaim}
                                    disabled={claiming || balance === 0}
                                    style={{
                                        width: '100%',
                                        padding: '14px 24px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: balance > 0
                                            ? 'linear-gradient(135deg, #10b981, #059669)'
                                            : 'rgba(255,255,255,0.1)',
                                        color: balance > 0 ? '#fff' : '#666',
                                        fontSize: 16,
                                        fontWeight: 800,
                                        cursor: claiming || balance === 0 ? 'not-allowed' : 'pointer',
                                        opacity: claiming ? 0.6 : 1
                                    }}
                                >
                                    {claiming ? '⏳ Processing...' : balance === 0 ? 'No Balance to Withdraw' : '💸 Withdraw $FLIP'}
                                </button>

                                <p style={{ fontSize: 12, opacity: 0.5, marginTop: 12, textAlign: 'center' }}>
                                    Withdrawals are processed within 24 hours
                                </p>
                            </div>

                            {/* History */}
                            <div className="panel" style={{ padding: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    📜 Claim History
                                </h2>

                                {history.length === 0 ? (
                                    <p style={{ opacity: 0.6 }}>No claims yet</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {history.map((claim: any, i: number) => (
                                            <div
                                                key={claim.id || i}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: 16,
                                                    borderRadius: 12,
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                            >
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 700 }}>
                                                        {(claim.amount / 1000).toFixed(0)}K $FLIP
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
                                                        {formatDate(claim.createdAt)}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: 6,
                                                    background: `${getStatusColor(claim.status)}20`,
                                                    color: getStatusColor(claim.status),
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {claim.status}
                                                </span>
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
