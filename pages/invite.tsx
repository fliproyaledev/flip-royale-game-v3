// pages/invite.tsx
// Invite kod giriş sayfası - yeni kullanıcıların giriş noktası

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/invite.module.css'

export default function InvitePage() {
    const router = useRouter()
    const [code, setCode] = useState('')
    const [username, setUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [inviteInfo, setInviteInfo] = useState<any>(null)

    // URL'den kod al (opsiyonel)
    useEffect(() => {
        const urlCode = router.query.code as string
        if (urlCode) {
            setCode(urlCode.toUpperCase())
        }
    }, [router.query])

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
        }
        checkWallet()
    }, [])

    const connectWallet = async () => {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            try {
                const accounts = await (window as any).ethereum.request({
                    method: 'eth_requestAccounts'
                })
                if (accounts.length > 0) {
                    setWalletAddress(accounts[0].toLowerCase())
                }
            } catch (e: any) {
                setError('Wallet connection failed')
            }
        } else {
            setError('Please install MetaMask or another wallet')
        }
    }

    const validateCode = async () => {
        if (!code.trim()) {
            setError('Please enter an invite code')
            return
        }

        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/invite/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.toUpperCase() })
            })

            const data = await res.json()

            if (!data.ok) {
                setError(data.error || 'Invalid code')
                setInviteInfo(null)
            } else {
                setInviteInfo(data)
                setError('')
            }
        } catch (e) {
            setError('Connection error')
        } finally {
            setLoading(false)
        }
    }

    const useCode = async () => {
        if (!walletAddress) {
            setError('Please connect your wallet first')
            return
        }

        if (!code.trim()) {
            setError('Please enter an invite code')
            return
        }

        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/invite/use', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code.toUpperCase(),
                    userId: walletAddress,
                    username: username
                })
            })

            const data = await res.json()

            if (!data.ok) {
                setError(data.error || 'Failed to use invite code')
            } else {
                setSuccess(true)
                // 2 saniye sonra oyuna yönlendir
                setTimeout(() => {
                    router.push('/')
                }, 2000)
            }
        } catch (e) {
            setError('Connection error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Head>
                <title>Join Flip Royale</title>
                <meta name="description" content="Enter your invite code to join Flip Royale" />
            </Head>

            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.logo}>
                        <img src="/logo.png" alt="Flip Royale" style={{ width: 120, height: 'auto', marginBottom: 16 }} />
                        {/* <h1 className={styles.title}>FLIP ROYALE</h1> */}
                    </div>

                    {success ? (
                        <div className={styles.successBox}>
                            <div className={styles.successIcon}>✅</div>
                            <h2>Welcome to Flip Royale!</h2>
                            <p>Your account has been created.</p>
                            {inviteInfo?.givesFreepack && (
                                <p className={styles.giftNote}>🎁 You received a free pack!</p>
                            )}
                            <p className={styles.redirect}>Redirecting to the game...</p>
                        </div>
                    ) : (
                        <>
                            <p className={styles.subtitle}>Enter your invite code to join</p>

                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    className={styles.codeInput}
                                    placeholder="ENTER CODE"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    maxLength={8}
                                    disabled={loading}
                                />
                                <button
                                    className={styles.validateBtn}
                                    onClick={validateCode}
                                    disabled={loading || !code.trim()}
                                >
                                    {loading ? '...' : 'Check'}
                                </button>
                            </div>

                            <div className={styles.inputGroup} style={{ marginTop: 12 }}>
                                <input
                                    type="text"
                                    className={styles.codeInput}
                                    placeholder="USERNAME (OPTIONAL)"
                                    value={username}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15)
                                        setUsername(val)
                                    }}
                                    disabled={loading}
                                    style={{ fontSize: 16 }}
                                />
                            </div>

                            {error && <p className={styles.error}>{error}</p>}

                            {inviteInfo && (
                                <div className={styles.inviteInfo}>
                                    <p className={styles.validCode}>✓ Valid invite code</p>
                                    {inviteInfo.givesFreepack && (
                                        <p className={styles.freepackNote}>🎁 Includes 1 free card pack!</p>
                                    )}
                                </div>
                            )}

                            {!walletAddress ? (
                                <button
                                    className={styles.connectBtn}
                                    onClick={connectWallet}
                                    disabled={loading}
                                >
                                    Connect Wallet
                                </button>
                            ) : (
                                <div className={styles.walletInfo}>
                                    <p className={styles.connected}>
                                        🔗 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                    </p>
                                    <button
                                        className={styles.joinBtn}
                                        onClick={useCode}
                                        disabled={loading || !inviteInfo}
                                    >
                                        {loading ? 'Joining...' : 'Join Flip Royale'}
                                    </button>
                                </div>
                            )}

                            <p className={styles.footer}>
                                Don't have an invite code?<br />
                                Ask a friend who's already playing!
                            </p>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
