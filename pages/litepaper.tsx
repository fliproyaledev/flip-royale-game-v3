import { useEffect, useState } from 'react'
import Head from 'next/head'
import Topbar from '../components/Topbar'

export default function LitepaperPage() {
    const [user, setUser] = useState<any>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        try {
            const saved = localStorage.getItem('flipflop-user')
            if (saved) {
                setUser(JSON.parse(saved))
            }
        } catch (e) { }
    }, [])

    if (!mounted) return null

    return (
        <>
            <Head>
                <title>Litepaper - Flip Royale</title>
                <meta name="description" content="Flip Royale Litepaper - Learn about our crypto prediction game" />
            </Head>

            <div className="app">
                <Topbar activeTab="litepaper" user={user} />

                <div style={{
                    maxWidth: 900,
                    margin: '0 auto',
                    padding: '40px 24px'
                }}>
                    {/* Hero Section */}
                    <div style={{
                        textAlign: 'center',
                        marginBottom: 48
                    }}>
                        <h1 style={{
                            fontSize: 48,
                            fontWeight: 900,
                            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: 16,
                            textTransform: 'uppercase',
                            letterSpacing: 2
                        }}>
                            LITEPAPER
                        </h1>
                        <p style={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: 18,
                            maxWidth: 600,
                            margin: '0 auto'
                        }}>
                            Flip Royale - The Ultimate Crypto Prediction Game
                        </p>
                    </div>

                    {/* Content Section */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        borderRadius: 24,
                        padding: 48,
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: 16,
                            lineHeight: 1.8
                        }} className="litepaper-content">
                            {/* LITEPAPER CONTENT - USER WILL PROVIDE */}
                            <section style={{ marginBottom: 40 }}>
                                <h2 style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: '#fbbf24',
                                    marginBottom: 20,
                                    paddingBottom: 12,
                                    borderBottom: '2px solid rgba(251, 191, 36, 0.3)'
                                }}>
                                    Introduction
                                </h2>
                                <p>
                                    [Litepaper content will be added here. Please provide the text you want to include.]
                                </p>
                            </section>

                            <section style={{ marginBottom: 40 }}>
                                <h2 style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: '#fbbf24',
                                    marginBottom: 20,
                                    paddingBottom: 12,
                                    borderBottom: '2px solid rgba(251, 191, 36, 0.3)'
                                }}>
                                    How It Works
                                </h2>
                                <p>
                                    [Explain game mechanics, daily rounds, card system etc.]
                                </p>
                            </section>

                            <section style={{ marginBottom: 40 }}>
                                <h2 style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: '#fbbf24',
                                    marginBottom: 20,
                                    paddingBottom: 12,
                                    borderBottom: '2px solid rgba(251, 191, 36, 0.3)'
                                }}>
                                    Tokenomics
                                </h2>
                                <p>
                                    [Token distribution, utility, rewards etc.]
                                </p>
                            </section>

                            <section style={{ marginBottom: 40 }}>
                                <h2 style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: '#fbbf24',
                                    marginBottom: 20,
                                    paddingBottom: 12,
                                    borderBottom: '2px solid rgba(251, 191, 36, 0.3)'
                                }}>
                                    Roadmap
                                </h2>
                                <p>
                                    [Future plans and development roadmap]
                                </p>
                            </section>

                            <section>
                                <h2 style={{
                                    fontSize: 28,
                                    fontWeight: 700,
                                    color: '#fbbf24',
                                    marginBottom: 20,
                                    paddingBottom: 12,
                                    borderBottom: '2px solid rgba(251, 191, 36, 0.3)'
                                }}>
                                    Team & Community
                                </h2>
                                <p>
                                    [Team information and community links]
                                </p>
                            </section>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        textAlign: 'center',
                        marginTop: 48,
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 14
                    }}>
                        <p>© 2025 Flip Royale. All rights reserved.</p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .litepaper-content p {
                    margin-bottom: 16px;
                }
                .litepaper-content ul, .litepaper-content ol {
                    margin-left: 24px;
                    margin-bottom: 16px;
                }
                .litepaper-content li {
                    margin-bottom: 8px;
                }
            `}</style>
        </>
    )
}
