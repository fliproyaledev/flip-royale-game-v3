/**
 * Rewards / Withdraw Page - Claim USDC Arena winnings via contract
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../components/Topbar'
import { useTheme } from '../lib/theme'
import { useToast } from '../lib/toast'
import {
    REWARDS_CLAIM_ADDRESS,
    REWARDS_CLAIM_ABI,
    USDC_ADDRESS,
    formatUSDC
} from '../lib/contracts/rewardsClaim'

interface ClaimRecord {
    id: string
    amount: number
    txHash?: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    createdAt: number
}

export default function RewardsPage() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const { address, isConnected } = useAccount()

    const [user, setUser] = useState<any>(null)
    const [pendingBalance, setPendingBalance] = useState(0) // Off-chain pending rewards
    const [history, setHistory] = useState<ClaimRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [claimAmount, setClaimAmount] = useState('')
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

    // Contract hooks
    const { writeContractAsync } = useWriteContract()

    // Check if contract is configured
    const isContractConfigured = REWARDS_CLAIM_ADDRESS && REWARDS_CLAIM_ADDRESS.length > 10

    // Get user's claim nonce from contract
    const { data: claimNonce } = useReadContract({
        address: REWARDS_CLAIM_ADDRESS as `0x${string}`,
        abi: REWARDS_CLAIM_ABI,
        functionName: 'getNonce',
        args: [address!],
        query: { enabled: Boolean(address) && Boolean(isContractConfigured) },
    })

    // Get user's total claimed from contract
    const { data: totalClaimed } = useReadContract({
        address: REWARDS_CLAIM_ADDRESS as `0x${string}`,
        abi: REWARDS_CLAIM_ABI,
        functionName: 'totalClaimed',
        args: [address!],
        query: { enabled: Boolean(address) && Boolean(isContractConfigured) },
    })

    // Wait for transaction
    const { isSuccess: txSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
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
        if (address) loadRewards()
    }, [address])

    useEffect(() => {
        if (txSuccess) {
            toast('🎉 Claim successful! USDC sent to your wallet', 'success')
            loadRewards()
        }
    }, [txSuccess])

    const loadRewards = async () => {
        if (!address) return
        setLoading(true)

        try {
            const res = await fetch(`/api/arena/rewards?wallet=${address}`)
            const data = await res.json()

            if (data.ok) {
                setPendingBalance(data.balance || 0) // In USDC (6 decimals)
                setHistory(data.history || [])
            }
        } catch (err) {
            console.error('Load rewards error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleClaim = async () => {
        if (!isContractConfigured) {
            toast('Claim contract not configured yet', 'error')
            return
        }

        const amount = parseInt(claimAmount)
        if (!amount || amount <= 0) {
            toast('Enter a valid amount', 'error')
            return
        }
        if (amount > pendingBalance) {
            toast('Insufficient balance', 'error')
            return
        }

        setClaiming(true)
        try {
            // 1. Get signature from Oracle API
            const signRes = await fetch('/api/arena/rewards/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: address,
                    amount,
                    nonce: claimNonce ? Number(claimNonce) : 0
                })
            })
            const signData = await signRes.json()

            if (!signData.ok) {
                throw new Error(signData.error || 'Failed to get signature')
            }

            // 2. Call contract claim function
            toast('Claiming USDC...', 'info')
            const hash = await writeContractAsync({
                address: REWARDS_CLAIM_ADDRESS as `0x${string}`,
                abi: REWARDS_CLAIM_ABI,
                functionName: 'claim',
                args: [BigInt(amount), BigInt(signData.nonce), signData.signature as `0x${string}`]
            })

            setTxHash(hash)
            setClaimAmount('')

            // 3. Update backend to deduct balance
            await fetch('/api/arena/rewards/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: address,
                    amount,
                    txHash: hash
                })
            })

        } catch (err: any) {
            console.error(err)
            toast(err.shortMessage || err.message || 'Claim failed', 'error')
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

    // Format balance for display (USDC has 6 decimals)
    const displayBalance = pendingBalance / 1_000_000
    const displayTotalClaimed = totalClaimed ? Number(totalClaimed) / 1_000_000 : 0

    return (
        <>
            <Head>
                <title>Rewards | FLIP ROYALE</title>
                <meta name="description" content="Claim your USDC Arena winnings" />
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="rewards" user={user} />

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
                                    ${displayBalance.toFixed(2)} USDC
                                </p>
                                {displayTotalClaimed > 0 && (
                                    <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
                                        Total claimed: ${displayTotalClaimed.toFixed(2)} USDC
                                    </p>
                                )}
                            </div>

                            {/* Claim Section */}
                            <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                                    🏧 Withdraw USDC
                                </h2>

                                {!isContractConfigured && (
                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: 8,
                                        padding: 12,
                                        marginBottom: 16,
                                        fontSize: 13
                                    }}>
                                        ⚠️ Claim contract not deployed yet. Coming soon!
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <input
                                        type="number"
                                        value={claimAmount}
                                        onChange={e => setClaimAmount(e.target.value)}
                                        placeholder="Amount (USDC)"
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
                                        onClick={() => setClaimAmount(pendingBalance.toString())}
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
                                    {[10_000_000, 25_000_000, 50_000_000, 100_000_000]
                                        .filter(v => v <= pendingBalance)
                                        .map(amount => (
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
                                                ${(amount / 1_000_000).toFixed(0)}
                                            </button>
                                        ))}
                                </div>

                                <button
                                    onClick={handleClaim}
                                    disabled={claiming || pendingBalance === 0 || !isContractConfigured}
                                    style={{
                                        width: '100%',
                                        padding: '14px 24px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: pendingBalance > 0 && isContractConfigured
                                            ? 'linear-gradient(135deg, #10b981, #059669)'
                                            : 'rgba(255,255,255,0.1)',
                                        color: pendingBalance > 0 ? '#fff' : '#666',
                                        fontSize: 16,
                                        fontWeight: 800,
                                        cursor: claiming || pendingBalance === 0 ? 'not-allowed' : 'pointer',
                                        opacity: claiming ? 0.6 : 1
                                    }}
                                >
                                    {claiming ? '⏳ Processing...' :
                                        pendingBalance === 0 ? 'No Balance to Withdraw' :
                                            !isContractConfigured ? '🔒 Coming Soon' :
                                                '💸 Withdraw USDC'}
                                </button>

                                <p style={{ fontSize: 12, opacity: 0.5, marginTop: 12, textAlign: 'center' }}>
                                    USDC is sent directly to your wallet via smart contract
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
                                                        ${(claim.amount / 1_000_000).toFixed(2)} USDC
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
