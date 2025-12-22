// pages/referrals.tsx
// Referral dashboard sayfası - kullanıcının referral kodunu ve istatistiklerini gösterir

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/referrals.module.css'

export default function ReferralsPage() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [referralData, setReferralData] = useState<any>(null)
    const [stats, setStats] = useState<any>(null)
    const [copied, setCopied] = useState(false)

    // Cüzdan bağlantısını kontrol et
    useEffect(() => {
        const checkWallet = async () => {
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                try {
                    const accounts = await (window as any).ethereum.request({
                        method: 'eth_accounts'
                    })
                    if (accounts.length > 0) {
                        setWalletAddress(accounts[0].toLowerCase())
                    }
                } catch (e) {
                    console.error('Wallet check error:', e)
                }
            }
            setLoading(false)
        }
        checkWallet()
    }, [])

    // Referral verisini yükle
    useEffect(() => {
        if (!walletAddress) return

        const fetchData = async () => {
            try {
                // Referral kodunu al
                const codeRes = await fetch(`/api/referral/my-code?userId=${walletAddress}`)
                const codeData = await codeRes.json()
                setReferralData(codeData)

                // İstatistikleri al
                const statsRes = await fetch(`/api/referral/stats?userId=${walletAddress}`)
                const statsData = await statsRes.json()
                setStats(statsData.stats)
            } catch (e) {
                setError('Failed to load referral data')
            }
        }
        fetchData()
    }, [walletAddress])

    const generateCode = async () => {
        if (!walletAddress) return

        try {
            const res = await fetch('/api/referral/my-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': walletAddress
                }
            })
            const data = await res.json()
            setReferralData(data)
        } catch (e) {
            setError('Failed to generate code')
        }
    }

    const copyCode = () => {
        if (referralData?.code) {
            navigator.clipboard.writeText(referralData.shareUrl || referralData.code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading...</div>
            </div>
        )
    }

    if (!walletAddress) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <h1 className={styles.title}>🔗 Referral Program</h1>
                    <p className={styles.message}>Please connect your wallet to view your referral dashboard</p>
                    <Link href="/" className={styles.backBtn}>← Back to Game</Link>
                </div>
            </div>
        )
    }

    return (
        <>
            <Head>
                <title>Referral Program - Flip Royale</title>
                <meta name="description" content="Earn rewards by referring friends to Flip Royale" />
            </Head>

            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.header}>
                        <h1 className={styles.title}>🔗 Referral Program</h1>
                        <Link href="/" className={styles.backLink}>← Back</Link>
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    {/* Referral Kodu Bölümü */}
                    <div className={styles.codeSection}>
                        {referralData?.hasReferralCode ? (
                            <>
                                <p className={styles.label}>Your Referral Code</p>
                                <div className={styles.codeBox}>
                                    <span className={styles.code}>{referralData.code}</span>
                                    <button className={styles.copyBtn} onClick={copyCode}>
                                        {copied ? '✓ Copied!' : '📋 Copy Link'}
                                    </button>
                                </div>
                                <p className={styles.shareUrl}>{referralData.shareUrl}</p>
                            </>
                        ) : referralData?.canGenerate ? (
                            <div className={styles.generateSection}>
                                <p className={styles.message}>You can now generate your referral code!</p>
                                <button className={styles.generateBtn} onClick={generateCode}>
                                    Generate Referral Code
                                </button>
                            </div>
                        ) : (
                            <div className={styles.lockedSection}>
                                <p className={styles.lockedIcon}>🔒</p>
                                <p className={styles.lockedMessage}>
                                    Purchase at least 1 pack to unlock your referral code
                                </p>
                                <p className={styles.packCount}>
                                    Packs purchased: {referralData?.packsPurchased || 0} / 1
                                </p>
                                <Link href="/" className={styles.shopBtn}>
                                    Go to Shop →
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* İstatistikler */}
                    {stats && (
                        <div className={styles.statsSection}>
                            <h2 className={styles.statsTitle}>Your Stats</h2>
                            <div className={styles.statsGrid}>
                                <div className={styles.statCard}>
                                    <span className={styles.statValue}>{stats.totalReferrals || 0}</span>
                                    <span className={styles.statLabel}>Total Referrals</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statValue}>${(stats.totalCommissionEarned || 0).toFixed(2)}</span>
                                    <span className={styles.statLabel}>Total Earned</span>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statValue}>${(stats.pendingCommission || 0).toFixed(2)}</span>
                                    <span className={styles.statLabel}>Pending</span>
                                </div>
                            </div>

                            {/* Claim Button */}
                            {(stats.pendingCommission || 0) >= 1 && (
                                <button
                                    className={styles.claimBtn}
                                    onClick={async () => {
                                        try {
                                            const res = await fetch('/api/referral/claim', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId: walletAddress })
                                            })
                                            const data = await res.json()
                                            if (data.ok) {
                                                alert(`Claim request submitted for $${data.claimed.toFixed(2)}. Will be processed within 24-48 hours.`)
                                                // Refresh stats
                                                const statsRes = await fetch(`/api/referral/stats?userId=${walletAddress}`)
                                                const statsData = await statsRes.json()
                                                setStats(statsData.stats)
                                            } else {
                                                alert(data.error || 'Claim failed')
                                            }
                                        } catch (e) {
                                            alert('Claim failed. Please try again.')
                                        }
                                    }}
                                >
                                    💰 Claim ${(stats.pendingCommission || 0).toFixed(2)}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Bilgi */}
                    <div className={styles.infoSection}>
                        <h3>How it works</h3>
                        <ul>
                            <li>Share your referral code with friends</li>
                            <li>When they join and buy packs, you earn <strong>10%</strong> commission</li>
                            <li>Commissions are added to your pending balance</li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    )
}
