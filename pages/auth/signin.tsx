// pages/auth/signin.tsx
// NextAuth custom signin page

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function SignInPage() {
    const router = useRouter()
    const { callbackUrl, error } = router.query

    useEffect(() => {
        // Auto-redirect to Twitter OAuth
        signIn('twitter', {
            callbackUrl: typeof callbackUrl === 'string' ? callbackUrl : '/auth/callback'
        })
    }, [callbackUrl])

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
                {error ? (
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
                        <h2 style={{ fontSize: 20, marginBottom: 10, color: '#fca5a5' }}>Sign In Error</h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 20 }}>{error}</p>
                        <button
                            onClick={() => signIn('twitter', { callbackUrl: '/auth/callback' })}
                            style={{
                                padding: '12px 24px',
                                background: '#3b82f6',
                                border: 'none',
                                borderRadius: 10,
                                color: 'white',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                margin: '0 auto'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Try Again
                        </button>
                    </>
                ) : (
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
                        <h2 style={{ fontSize: 20, marginBottom: 10 }}>Connecting to X...</h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Redirecting to authorization</p>
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
