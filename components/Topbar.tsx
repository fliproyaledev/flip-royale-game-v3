import { useTheme } from '../lib/theme'
import ThemeToggle from './ThemeToggle'

const DEFAULT_AVATAR = '/avatars/default-avatar.png'

type TopbarProps = {
    activeTab?: 'play' | 'prices' | 'guide' | 'inventory' | 'my-packs' | 'leaderboard' | 'referrals' | 'history' | 'litepaper' | 'profile'
    user?: {
        name?: string
        avatar?: string
        totalPoints?: number
        username?: string
    } | null
}

export default function Topbar({ activeTab, user }: TopbarProps) {
    const { theme } = useTheme()

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
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
        </header>
    )
}
