import { useState, useEffect } from 'react'
import { useTheme } from '../lib/theme'
import ThemeToggle from './ThemeToggle'
import RedeemCodeModal from './RedeemCodeModal'
import { useToast } from '../lib/toast'
import { signIn } from 'next-auth/react'

const DEFAULT_AVATAR = '/avatars/default-avatar.png'

type TopbarProps = {
<<<<<<< HEAD
    activeTab?: 'play' | 'prices' | 'guide' | 'inventory' | 'my-packs' | 'leaderboard' | 'referrals' | 'history' | 'profile'
=======
    activeTab?: 'play' | 'prices' | 'guide' | 'inventory' | 'my-packs' | 'leaderboard' | 'referrals' | 'history' | 'litepaper' | 'profile'
>>>>>>> master
    user?: {
        id?: string
        name?: string
        avatar?: string
        totalPoints?: number
        username?: string
        xHandle?: string
        xUserId?: string
    } | null
}

export default function Topbar({ activeTab, user }: TopbarProps) {
    const { theme } = useTheme()
    const { toast } = useToast()
    const [showRedeemModal, setShowRedeemModal] = useState(false)
    const [xHandle, setXHandle] = useState<string | undefined>(user?.xHandle)

    // Check localStorage for xHandle if not in user prop (for pages that don't fetch fresh user data)
    useEffect(() => {
        if (user && !user.xHandle) {
            try {
                const stored = localStorage.getItem('flipflop-user')
                if (stored) {
                    const userData = JSON.parse(stored)
                    if (userData.xHandle) {
                        setXHandle(userData.xHandle)
                    }
                }
            } catch { }
        } else if (user?.xHandle) {
            setXHandle(user.xHandle)
        }
    }, [user])

    const handleLogout = () => {
        try { localStorage.removeItem('flipflop-user') } catch { }
        window.location.href = '/'
    }

    const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.currentTarget
        target.src = '/logo.svg'
        target.onerror = () => {
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) parent.innerHTML = '<span class="dot"></span> FLIP ROYALE'
        }
    }

    return (
        <header className="topbar">
            <div className="brand">
                <a href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                    <img
                        src="/logo.png"
                        alt="FLIP ROYALE"
                        className="logo"
                        onError={handleLogoError}
                    />
                </a>
            </div>
            <nav className="tabs">
                <a className={`tab ${activeTab === 'play' ? 'active' : ''}`} href="/">PLAY</a>
                <a className={`tab ${activeTab === 'prices' ? 'active' : ''}`} href="/prices">PRICES</a>
                <a className={`tab ${activeTab === 'guide' ? 'active' : ''}`} href="/guide">GUIDE</a>
                <a className={`tab ${activeTab === 'inventory' ? 'active' : ''}`} href="/inventory">INVENTORY</a>
                <a className={`tab ${activeTab === 'my-packs' ? 'active' : ''}`} href="/my-packs">MY PACKS</a>
                <a className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} href="/leaderboard">LEADERBOARD</a>
                <a className={`tab ${activeTab === 'referrals' ? 'active' : ''}`} href="/referrals">REFERRALS</a>
                <a className={`tab ${activeTab === 'history' ? 'active' : ''}`} href="/history">HISTORY</a>
                <a className={`tab ${activeTab === 'litepaper' ? 'active' : ''}`} href="/litepaper">LITEPAPER</a>
                <a className={`tab ${activeTab === 'profile' ? 'active' : ''}`} href="/profile">PROFILE</a>
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'nowrap' }}>
                {/* Redeem Code Button - Only visible when logged in */}
                {user && (
                    <button
                        onClick={() => setShowRedeemModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            background: theme === 'light' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.2)',
                            border: `1px solid ${theme === 'light' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.3)'}`,
                            borderRadius: 10,
                            color: theme === 'light' ? '#b45309' : '#fbbf24',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = theme === 'light' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(251, 191, 36, 0.3)'
                            e.currentTarget.style.transform = 'scale(1.02)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = theme === 'light' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.2)'
                            e.currentTarget.style.transform = 'scale(1)'
                        }}
                    >
                        <span style={{ fontSize: 16 }}>🎁</span>
                        <span>Redeem</span>
                    </button>
                )}

                {/* Connect X Button - Only visible when logged in */}
                {user && (
                    xHandle ? (
                        // X hesabı bağlı - yeşil badge göster
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                background: 'rgba(34, 197, 94, 0.2)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: 10,
                                color: '#86efac',
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                            }}
                            title={`Connected as @${xHandle}`}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span>@{xHandle}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                        </div>
                    ) : (
                        // X hesabı bağlı değil - connect butonu göster
                        <button
                            onClick={() => {
                                // NextAuth ile X OAuth başlat
                                signIn('twitter', { callbackUrl: '/auth/callback' })
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                background: theme === 'light' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.2)',
                                border: `1px solid ${theme === 'light' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
                                borderRadius: 10,
                                color: theme === 'light' ? '#1d4ed8' : '#93c5fd',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = theme === 'light' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.3)'
                                e.currentTarget.style.transform = 'scale(1.02)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = theme === 'light' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.2)'
                                e.currentTarget.style.transform = 'scale(1)'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span>Connect X</span>
                        </button>
                    )
                )}
                <ThemeToggle />
                <a
                    href="https://x.com/fliproyale"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white',
                        textDecoration: 'none'
                    }}
                    title="Follow us on X"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                </a>

                {user ? (
                    <>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '2px solid rgba(255,255,255,0.25)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            background: 'rgba(255,255,255,0.1)'
                        }}>
                            <img
                                src={user.avatar || DEFAULT_AVATAR}
                                alt={user.name || user.username || 'User'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{
                                background: 'rgba(0,207,163,0.15)',
                                border: '1px solid rgba(0,207,163,0.25)',
                                borderRadius: 10,
                                padding: '8px 14px',
                                fontSize: 15,
                                fontWeight: 700,
                                color: '#86efac'
                            }}>
                                {(user.totalPoints || 0).toLocaleString()} pts
                            </div>

                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'rgba(239,68,68,0.2)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#fca5a5',
                                    padding: '4px 12px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    </>
                ) : (
                    <a href="/" style={{
                        background: 'linear-gradient(135deg, var(--accent-green), var(--accent-2))',
                        color: '#03120d',
                        padding: '10px 20px',
                        borderRadius: 12,
                        fontWeight: 700,
                        fontSize: 14,
                        textDecoration: 'none'
                    }}>
                        Connect Wallet
                    </a>
                )}
            </div>

            {/* Redeem Code Modal - Globally accessible when logged in */}
            {user && (
                <RedeemCodeModal
                    isOpen={showRedeemModal}
                    onClose={() => setShowRedeemModal(false)}
                    userId={user.id || ''}
                    onSuccess={() => {
                        // Reload the page to update inventory
                        toast('🎁 Code Redeemed! Check My Packs for your free pack!')
                        setTimeout(() => window.location.reload(), 1500)
                    }}
                />
            )}
        </header>
    )
}
