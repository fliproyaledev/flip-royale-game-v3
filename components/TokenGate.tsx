// components/TokenGate.tsx
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { TokenGateResult } from '../lib/tokenGate'

type TokenGateProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const FLIP_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_FLIP_TOKEN_ADDRESS || ''

export default function TokenGate({ isOpen, onClose, onSuccess }: TokenGateProps) {
    const { address, isConnected } = useAccount()
    const [gateResult, setGateResult] = useState<TokenGateResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(false)

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            checkGate()
        }
    }, [isOpen, address])

    async function checkGate() {
        if (!FLIP_TOKEN_ADDRESS) {
            onSuccess();
            return;
        }
        if (!address) {
            // Wait for user to connect
            return;
        }

        setLoading(true)
        setChecking(true)
        try {
            const res = await fetch(`/api/token-gate/check?address=${address}`)
            const data = await res.json()
            setGateResult(data)

            // If allowed (balance high enough or gate disabled)
            if (data.allowed) {
                onSuccess()
            }
        } catch (error) {
            console.error('[TokenGate] Check error:', error)
            // Fail open on error to avoid blocking user due to API issues
            onSuccess()
        } finally {
            setLoading(false)
            setChecking(false)
        }
    }

    if (!isOpen) return null

    // If loading, show spinner overlay
    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="spinner" style={{
                    width: 48,
                    height: 48,
                    border: '4px solid rgba(255,255,255,0.1)',
                    borderTopColor: '#10b981',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    // If allowed, render nothing (onSuccess should have been called)
    if (gateResult?.allowed) return null

    // If NOT connected
    if (!isConnected) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(5px)'
            }}>
                <div style={{
                    background: '#1e293b',
                    padding: 32,
                    borderRadius: 24,
                    textAlign: 'center',
                    maxWidth: 400,
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <h3 style={{ color: 'white', marginTop: 0, fontSize: 24 }}>Connect Wallet</h3>
                    <p style={{ color: '#94a3b8', marginBottom: 24 }}>Please connect your wallet to verify token holdings.</p>
                    <button onClick={onClose} style={{
                        padding: '12px 24px',
                        background: '#334155',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: 600
                    }}>Close</button>
                </div>
            </div>
        )
    }

    // Gate Screen - Not Allowed
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: 24,
                padding: 48,
                maxWidth: 480,
                width: '100%',
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 24,
                        cursor: 'pointer',
                        padding: 8,
                        lineHeight: 1
                    }}
                >
                    ✕
                </button>

                <div style={{ fontSize: 64, marginBottom: 24 }}>🔒</div>

                <p style={{
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.8)',
                    marginBottom: 32,
                    lineHeight: 1.6
                }}>
                    Hold <strong style={{ color: '#10b981' }}>{(gateResult?.minTokenRequired || 250000).toLocaleString()}</strong>{' '}
                    <strong style={{ color: '#fbbf24' }}>$FLIP</strong> tokens to save your picks for the next round.
                </p>

                {/* Stats */}
                <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 24
                }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#94a3b8' }}>Your Balance</span>
                            <span style={{ fontWeight: 700, color: (gateResult?.balance || 0) >= (gateResult?.minTokenRequired || 250000) ? '#10b981' : '#ef4444' }}>
                                {(gateResult?.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} $FLIP
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#94a3b8' }}>Required</span>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>
                                {(gateResult?.minTokenRequired || 250000).toLocaleString()} $FLIP
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    height: 6,
                    overflow: 'hidden',
                    marginBottom: 32
                }}>
                    <div style={{
                        width: `${Math.min(((gateResult?.balance || 0) / (gateResult?.minTokenRequired || 250000)) * 100, 100)}%`,
                        height: '100%',
                        background: (gateResult?.balance || 0) >= (gateResult?.minTokenRequired || 250000) ? '#10b981' : '#ef4444',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                <a
                    href="https://app.virtuals.io/virtuals/41537"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'block',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        padding: '16px',
                        borderRadius: 12,
                        fontWeight: 700,
                        fontSize: 16,
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        transition: 'transform 0.2s ease',
                        marginBottom: 16
                    }}
                >
                    Buy $FLIP on Virtuals
                </a>

                <p style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 12
                }}>
                    Balance updates automatically
                </p>
            </div>
        </div>
    )
}
