// components/RedeemCodeModal.tsx
// Waitlist kod girme ve redeem modal

import { useState } from 'react'
import { useTheme } from '../lib/theme'

type RedeemCodeModalProps = {
    isOpen: boolean
    onClose: () => void
    userId: string
    onSuccess: () => void
}

export default function RedeemCodeModal({ isOpen, onClose, userId, onSuccess }: RedeemCodeModalProps) {
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    if (!isOpen) return null

    const handleRedeem = async () => {
        if (!code.trim()) {
            setError('Please enter a code')
            return
        }

        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/redeem/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim(), userId })
            })

            const data = await res.json()

            if (data.success) {
                setSuccess(true)
                setTimeout(() => {
                    onSuccess()
                    onClose()
                    setSuccess(false)
                    setCode('')
                }, 2000)
            } else {
                setError(data.error || 'Failed to redeem code')
            }
        } catch (e) {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
        }} onClick={onClose}>
            <div style={{
                background: isLight ? '#fff' : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: 24,
                padding: 32,
                maxWidth: 400,
                width: '100%',
                border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
            }} onClick={e => e.stopPropagation()}>

                {success ? (
                    // Success State
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 80, marginBottom: 16 }}>🎁</div>
                        <h2 style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: '#10b981',
                            marginBottom: 8
                        }}>Code Redeemed!</h2>
                        <p style={{
                            color: isLight ? '#475569' : 'rgba(255,255,255,0.7)',
                            fontSize: 16
                        }}>You received 1 Common Pack!</p>
                        <div style={{
                            marginTop: 20,
                            padding: 16,
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 12,
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                            <p style={{ color: '#10b981', fontWeight: 600 }}>
                                Check your My Packs to open it!
                            </p>
                        </div>
                    </div>
                ) : (
                    // Input State
                    <>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>
                            <h2 style={{
                                fontSize: 24,
                                fontWeight: 800,
                                color: isLight ? '#1e293b' : '#fbbf24',
                                marginBottom: 8
                            }}>Redeem Code</h2>
                            <p style={{
                                color: isLight ? '#64748b' : 'rgba(255,255,255,0.6)',
                                fontSize: 14
                            }}>Enter your waitlist code to receive a free pack!</p>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <input
                                type="text"
                                value={code}
                                onChange={e => {
                                    setCode(e.target.value.toUpperCase())
                                    setError('')
                                }}
                                placeholder="Enter code..."
                                style={{
                                    width: '100%',
                                    padding: '16px 20px',
                                    fontSize: 18,
                                    fontWeight: 700,
                                    letterSpacing: 2,
                                    textAlign: 'center',
                                    background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                                    border: error
                                        ? '2px solid #ef4444'
                                        : isLight ? '2px solid #e2e8f0' : '2px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                    color: isLight ? '#1e293b' : 'white',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                                maxLength={12}
                                autoFocus
                            />
                            {error && (
                                <p style={{
                                    color: '#ef4444',
                                    fontSize: 13,
                                    marginTop: 8,
                                    textAlign: 'center'
                                }}>{error}</p>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: '14px 20px',
                                    fontSize: 15,
                                    fontWeight: 600,
                                    background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 12,
                                    color: isLight ? '#475569' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRedeem}
                                disabled={loading || !code.trim()}
                                style={{
                                    flex: 2,
                                    padding: '14px 20px',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    background: loading || !code.trim()
                                        ? '#475569'
                                        : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                    border: 'none',
                                    borderRadius: 12,
                                    color: loading || !code.trim() ? '#94a3b8' : '#000',
                                    cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
                                    boxShadow: loading || !code.trim() ? 'none' : '0 4px 20px rgba(251, 191, 36, 0.4)'
                                }}
                            >
                                {loading ? 'Redeeming...' : 'Redeem Code'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
