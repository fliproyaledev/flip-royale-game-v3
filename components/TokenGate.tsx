// components/TokenGate.tsx
// Wrapper component that gates access based on $FLIP holdings

import { useState, useEffect, ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { TokenGateResult } from '../lib/tokenGate'

type TokenGateProps = {
    children: ReactNode
}

const FLIP_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_FLIP_TOKEN_ADDRESS || ''

export default function TokenGate({ children }: TokenGateProps) {
    const { address, isConnected } = useAccount()
    const [gateResult, setGateResult] = useState<TokenGateResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)

    // Quick client-side check if gate is enabled
    const isGateEnabledClient = FLIP_TOKEN_ADDRESS &&
        FLIP_TOKEN_ADDRESS.length === 42 &&
        !FLIP_TOKEN_ADDRESS.includes('placeholder')

    useEffect(() => {
        async function checkGate() {
            // If gate not enabled on client, skip API call
            if (!isGateEnabledClient) {
                setGateResult({
                    enabled: false,
                    allowed: true,
                    balance: 0,
                    usdValue: 0,
                    minRequired: 100,
                    tokenPrice: 0,
                    tokenAddress: ''
                })
                setLoading(false)
                return
            }

            // If wallet not connected, show gate
            if (!isConnected || !address) {
                setLoading(false)
                return
            }

            setChecking(true)
            try {
                const res = await fetch(`/api/token-gate/check?address=${address}`)
                const data = await res.json()
                setGateResult(data)
            } catch (error) {
                console.error('[TokenGate] Failed to check:', error)
                // Fail-open: allow access on error
                setGateResult({
                    enabled: true,
                    allowed: true,
                    balance: 0,
                    usdValue: 0,
                    minRequired: 100,
                    tokenPrice: 0,
                    tokenAddress: FLIP_TOKEN_ADDRESS
                })
            } finally {
                setLoading(false)
                setChecking(false)
            }
        }

        checkGate()
    }, [address, isConnected, isGateEnabledClient])

    // Re-check every 60 seconds
    useEffect(() => {
        if (!isGateEnabledClient || !isConnected || !address) return

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/token-gate/check?address=${address}`)
                const data = await res.json()
                setGateResult(data)
            } catch (error) {
                console.error('[TokenGate] Refresh failed:', error)
            }
        }, 60000)

        return () => clearInterval(interval)
    }, [address, isConnected, isGateEnabledClient])

    // Loading state
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        width: 48,
                        height: 48,
                        border: '4px solid rgba(255,255,255,0.1)',
                        borderTopColor: '#10b981',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }} />
                    <div style={{ color: 'rgba(255,255,255,0.7)' }}>Loading...</div>
                    <style jsx>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        )
    }

    // Gate not enabled or user allowed
    if (!gateResult?.enabled || gateResult?.allowed) {
        return <>{children}</>
    }

    // Gate Screen - User doesn't meet requirement
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: 24
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.8)',
                borderRadius: 24,
                padding: 48,
                maxWidth: 500,
                width: '100%',
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
            }}>
                {/* Lock Icon */}
                <div style={{
                    fontSize: 64,
                    marginBottom: 24
                }}>
                    🔒
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: '#fbbf24',
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1
                }}>
                    Token Gate
                </h1>

                {/* Subtitle */}
                <p style={{
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: 32
                }}>
                    Hold <strong style={{ color: '#10b981' }}>${gateResult.minRequired}</strong> worth of{' '}
                    <strong style={{ color: '#fbbf24' }}>$FLIP</strong> to access Flip Royale
                </p>

                {/* Stats */}
                <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 16,
                    padding: 24,
                    marginBottom: 24
                }}>
                    <div style={{
                        display: 'grid',
                        gap: 16
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Your Balance</span>
                            <span style={{ fontWeight: 700, color: 'white' }}>
                                {gateResult.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $FLIP
                            </span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Current Value</span>
                            <span style={{
                                fontWeight: 700,
                                color: gateResult.usdValue >= gateResult.minRequired ? '#10b981' : '#ef4444'
                            }}>
                                ${gateResult.usdValue.toFixed(2)}
                            </span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Required</span>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>
                                ${gateResult.minRequired.toFixed(2)}
                            </span>
                        </div>
                        {gateResult.tokenPrice > 0 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                paddingTop: 12,
                                marginTop: 4
                            }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)' }}>$FLIP Price</span>
                                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                                    ${gateResult.tokenPrice.toFixed(6)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 8,
                    height: 8,
                    overflow: 'hidden',
                    marginBottom: 24
                }}>
                    <div style={{
                        width: `${Math.min((gateResult.usdValue / gateResult.minRequired) * 100, 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ef4444, #f59e0b, #10b981)',
                        borderRadius: 8,
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                {/* Buy Button */}
                <a
                    href="https://app.uniswap.org/swap"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        padding: '16px 32px',
                        borderRadius: 12,
                        fontWeight: 700,
                        fontSize: 16,
                        textDecoration: 'none',
                        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                        transition: 'transform 0.2s ease'
                    }}
                >
                    <span>💰</span>
                    <span>Buy $FLIP on Uniswap</span>
                </a>

                {/* Refresh note */}
                <p style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 24
                }}>
                    {checking ? 'Checking...' : 'Balance updates automatically every 60 seconds'}
                </p>
            </div>
        </div>
    )
}
