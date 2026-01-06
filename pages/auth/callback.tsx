// pages/auth/callback.tsx
// X OAuth sonrası wallet user'a X hesabını bağlama sayfası

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

export default function XCallbackPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [linkStatus, setLinkStatus] = useState<'loading' | 'success' | 'error' | 'no-wallet'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        async function linkXAccount() {
            if (status === 'loading') return

            // X session yoksa hata
            if (!session?.user) {
                setLinkStatus('error')
                setMessage('X authentication failed. Please try again.')
                return
            }

            // localStorage'dan wallet address al
            let walletAddress = ''
            try {
                const stored = localStorage.getItem('flipflop-user')
                if (stored) {
                    const userData = JSON.parse(stored)
                    walletAddress = userData.id || userData.walletAddress || ''
                }
            } catch { }

            if (!walletAddress) {
                setLinkStatus('no-wallet')
                setMessage('No wallet connected. Please connect your wallet first.')
                return
            }

            // X hesabını wallet'a bağla
            try {
                const res = await fetch('/api/auth/link-x', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletAddress })
                })

                const data = await res.json()

                if (data.success) {
                    setLinkStatus('success')
                    setMessage(`Successfully linked @${data.xHandle}!`)

                    // localStorage'daki user'ı güncelle
                    try {
                        const stored = localStorage.getItem('flipflop-user')
                        if (stored) {
                            const userData = JSON.parse(stored)
                            userData.xHandle = data.xHandle
                            userData.xUserId = data.xUserId
                            localStorage.setItem('flipflop-user', JSON.stringify(userData))
                        }
                    } catch { }

                    // 2 saniye sonra ana sayfaya yönlendir
                    setTimeout(() => {
                        router.push('/')
                    }, 2000)
                } else {
                    setLinkStatus('error')
                    setMessage(data.error || 'Failed to link X account')
                }
            } catch (err) {
                setLinkStatus('error')
                setMessage('Server error. Please try again.')
            }
        }

        linkXAccount()
    }, [session, status, router])

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '40px 60px',
                textAlign: 'center',
                maxWidth: 400
            }}>
                {linkStatus === 'loading' && (
                    <>
                        <div style={{
                            width: 48,
                            height: 48,
                            border: '3px solid rgba(255,255,255,0.2)',
                            borderTopColor: '#3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 20px'
                        }} />
                        <h2 style={{ fontSize: 20, marginBottom: 10 }}>Linking X Account...</h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Please wait</p>
                    </>
                )}

                {linkStatus === 'success' && (
                    <>
                        <div style={{
                            width: 48,
                            height: 48,
                            background: 'rgba(34, 197, 94, 0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#22c55e">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                        </div>
                        <h2 style={{ fontSize: 20, marginBottom: 10, color: '#86efac' }}>Success!</h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 10 }}>
                            Redirecting...
                        </p>
                    </>
                )}

                {linkStatus === 'error' && (
                    <>
                        <div style={{
                            width: 48,
                            height: 48,
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#ef4444">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                            </svg>
                        </div>
                        <h2 style={{ fontSize: 20, marginBottom: 10, color: '#fca5a5' }}>Error</h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</p>
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                marginTop: 20,
                                padding: '10px 24px',
                                background: '#3b82f6',
                                border: 'none',
                                borderRadius: 10,
                                color: 'white',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Go Back
                        </button>
                    </>
                )}

                {linkStatus === 'no-wallet' && (
                    <>
                        <div style={{
                            width: 48,
                            height: 48,
                            background: 'rgba(251, 191, 36, 0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#fbbf24">
                                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                            </svg>
                        </div>
                        <h2 style={{ fontSize: 20, marginBottom: 10, color: '#fbbf24' }}>Wallet Required</h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)' }}>{message}</p>
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                marginTop: 20,
                                padding: '10px 24px',
                                background: '#10b981',
                                border: 'none',
                                borderRadius: 10,
                                color: 'white',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Connect Wallet
                        </button>
                    </>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
