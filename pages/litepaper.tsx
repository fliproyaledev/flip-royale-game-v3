import { useEffect, useState } from 'react'
import Head from 'next/head'
import Topbar from '../components/Topbar'

export default function LitepaperPage() {
    const [user, setUser] = useState<any>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)

        async function loadUser() {
            try {
                const saved = localStorage.getItem('flipflop-user')
                if (saved) {
                    const parsed = JSON.parse(saved)
                    // Fetch current data from API
                    const res = await fetch(`/api/users/me?userId=${encodeURIComponent(parsed.id)}`)
                    const data = await res.json()
                    if (data.ok && data.user) {
                        setUser({
                            ...parsed,
                            ...data.user,
                            totalPoints: data.user.totalPoints || 0
                        })
                    } else {
                        setUser(parsed)
                    }
                }
            } catch (e) {
                // Fallback to localStorage
                try {
                    const saved = localStorage.getItem('flipflop-user')
                    if (saved) setUser(JSON.parse(saved))
                } catch { }
            }
        }
        loadUser()
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
                        <div className="litepaper-content">

                            {/* INTRODUCTION */}
                            <section className="lp-section">
                                <h2 className="lp-title">Introduction</h2>

                                <h3 className="lp-subtitle">What is Flip Royale?</h3>
                                <p>
                                    Flip Royale is a <strong>skill-based prediction game</strong> built on Virtuals Protocol and Base Network.
                                </p>
                                <p>
                                    Each card in Flip Royale represents a real token from the Virtuals ecosystem.
                                    Players compete by predicting whether token prices will move up or down, earning points based on real market data.
                                </p>
                                <p>
                                    Unlike traditional prediction games, Flip Royale rewards players in both bullish and bearish markets,
                                    emphasizing <strong>strategy, timing, and risk management</strong> over luck.
                                </p>
                                <p className="lp-highlight">
                                    Flip Royale is designed as a long-term GameFi product, not a short-term speculative game.
                                </p>

                                <h3 className="lp-subtitle">Vision & Philosophy</h3>
                                <p>Flip Royale is built on a simple principle:</p>
                                <blockquote className="lp-quote">
                                    Markets move in both directions — skillful players should win in any condition.
                                </blockquote>
                                <p>The game rewards:</p>
                                <ul>
                                    <li><strong>Analysis</strong> over hype</li>
                                    <li><strong>Risk management</strong> over blind conviction</li>
                                    <li><strong>Timing</strong> over passive participation</li>
                                </ul>
                                <p className="lp-note">
                                    Flip Royale is not a gambling game. It is a <strong>decision-driven prediction engine</strong>.
                                </p>
                            </section>

                            {/* GAMEPLAY */}
                            <section className="lp-section">
                                <h2 className="lp-title">Gameplay</h2>

                                <h3 className="lp-subtitle">Cards & Tokens</h3>
                                <ul>
                                    <li>Each card represents a Virtuals ecosystem token</li>
                                    <li>Card values are tied directly to real token price data</li>
                                    <li>New token launches will be added as new cards over time</li>
                                </ul>
                                <p>Cards are the core instruments through which players express market conviction.</p>

                                <h3 className="lp-subtitle">Round Structure</h3>
                                <p>Flip Royale operates on a <strong>daily two-phase round system</strong>.</p>

                                <h4 className="lp-h4">Next Round</h4>
                                <p>The Next Round is the <strong>planning phase</strong>.</p>
                                <ul>
                                    <li>Players select 5 cards</li>
                                    <li>For each card, players choose:
                                        <ul>
                                            <li><span className="up">UP</span> → if they expect the price to rise</li>
                                            <li><span className="down">DOWN</span> → if they expect the price to fall</li>
                                        </ul>
                                    </li>
                                    <li>Selections can be changed freely until UTC 00:00</li>
                                    <li>No scoring occurs during this phase</li>
                                </ul>
                                <p className="lp-note">At UTC 00:00, all selections are locked and moved to the Active Round.</p>

                                <h4 className="lp-h4">Active Round & LOCK Mechanism 🔥</h4>
                                <p>The Active Round is where <strong>skill truly matters</strong>.</p>
                                <ul>
                                    <li>Active Round lasts 24 hours</li>
                                    <li>Card scores update dynamically based on real-time price movements</li>
                                    <li>Each card's score reflects the token's percentage price change</li>
                                </ul>

                                <div className="lp-box">
                                    <h5>The LOCK Mechanism</h5>
                                    <p>At any moment during the Active Round, players may <strong>LOCK</strong> individual cards.</p>
                                    <ul>
                                        <li>Locking a card immediately freezes its score</li>
                                        <li>Locked cards are protected from future price movements</li>
                                        <li>Once locked, a card cannot be unlocked</li>
                                    </ul>
                                    <p>If a card is not locked, its final score is calculated using the 24-hour closing price at UTC 00:00.</p>
                                </div>

                                <h4 className="lp-h4">Why LOCK is Critical</h4>
                                <p>The LOCK mechanism introduces:</p>
                                <ul>
                                    <li>Timing-based skill</li>
                                    <li>Risk vs reward decisions</li>
                                    <li>Active gameplay instead of passive waiting</li>
                                </ul>
                                <p className="lp-highlight">
                                    Correct locking often separates top-tier players from average players, especially during volatile market conditions.
                                </p>
                            </section>

                            {/* SCORING SYSTEM */}
                            <section className="lp-section">
                                <h2 className="lp-title">Scoring System</h2>
                                <ul>
                                    <li>Each <strong>+1%</strong> price movement = <span className="up">+100 points</span></li>
                                    <li>Each <strong>-1%</strong> price movement = <span className="down">-100 points</span></li>
                                </ul>
                                <p>If <strong>DOWN</strong> is selected, scoring is inverted:</p>
                                <ul>
                                    <li>Price decrease → points gained</li>
                                    <li>Price increase → points lost</li>
                                </ul>

                                <h4 className="lp-h4">Maximum Score Cap</h4>
                                <ul>
                                    <li>Maximum score per round: <strong>2,500 points</strong></li>
                                    <li>Prevents volatility abuse</li>
                                    <li>Maintains fair competition</li>
                                </ul>

                                <h4 className="lp-h4">Duplicate Cards Risk</h4>
                                <p>Players may select the same card multiple times, but doing so increases downside risk.</p>
                                <table className="lp-table">
                                    <thead>
                                        <tr>
                                            <th>Card Copy</th>
                                            <th>Positive Outcome</th>
                                            <th>Negative Outcome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>1st</td><td className="up">100% points</td><td className="down">100% loss</td></tr>
                                        <tr><td>2nd</td><td className="up">75% points</td><td className="down">125% loss</td></tr>
                                        <tr><td>3rd</td><td className="up">50% points</td><td className="down">150% loss</td></tr>
                                        <tr><td>4th</td><td className="up">25% points</td><td className="down">175% loss</td></tr>
                                        <tr><td>5th</td><td className="up">0% points</td><td className="down">200% loss</td></tr>
                                    </tbody>
                                </table>
                                <p className="lp-note">This system encourages diversification and mirrors real portfolio risk management.</p>
                            </section>

                            {/* ECONOMY */}
                            <section className="lp-section">
                                <h2 className="lp-title">Economy</h2>

                                <h3 className="lp-subtitle">Card Packs</h3>
                                <p>Each pack contains <strong>5 cards</strong>.</p>

                                <div className="lp-grid">
                                    <div className="lp-card">
                                        <h5>Common Pack</h5>
                                        <ul>
                                            <li>High chance of Sentient & Genesis cards</li>
                                            <li>Very low chance of Unicorn cards</li>
                                        </ul>
                                    </div>
                                    <div className="lp-card">
                                        <h5>Rare Pack</h5>
                                        <ul>
                                            <li>Increased Unicorn probability</li>
                                        </ul>
                                    </div>
                                </div>

                                <h3 className="lp-subtitle">$FLIP Token Economy</h3>
                                <p><strong>$FLIP</strong> is the primary in-game currency.</p>

                                <h4 className="lp-h4">Utility</h4>
                                <ul>
                                    <li>Card pack purchases</li>
                                    <li>FLIPJACK PvP entries</li>
                                    <li>Booster packs</li>
                                    <li>Extra deck slots</li>
                                </ul>

                                <h4 className="lp-h4">Burn & Treasury</h4>
                                <ul>
                                    <li>A portion of $FLIP is burned</li>
                                    <li>A portion is allocated to the treasury</li>
                                </ul>
                                <p>Treasury funds:</p>
                                <ul>
                                    <li>Weekly rewards</li>
                                    <li>PvP prize pools</li>
                                    <li>Long-term development</li>
                                </ul>

                                <h3 className="lp-subtitle">Referral System</h3>
                                <p>Flip Royale includes a built-in referral program.</p>
                                <ul>
                                    <li>Any user who purchases and/or opens a card pack can generate a referral link</li>
                                    <li>Invited users join through this link</li>
                                    <li>Referrers earn <strong>10% commission</strong> from referred users' card pack purchases</li>
                                </ul>
                                <p className="lp-highlight">This system rewards community-driven growth and turns players into long-term ambassadors.</p>
                            </section>

                            {/* GAME MODES */}
                            <section className="lp-section">
                                <h2 className="lp-title">Game Modes</h2>

                                <h3 className="lp-subtitle">Classic Flip Royale</h3>
                                <p>The core daily prediction mode featuring:</p>
                                <ul>
                                    <li>5-card selection</li>
                                    <li>UP / DOWN predictions</li>
                                    <li>Active Round & LOCK mechanics</li>
                                    <li>Weekly leaderboard rewards</li>
                                </ul>

                                <h3 className="lp-subtitle">FLIPJACK (1v1 PvP)</h3>
                                <p><strong>FLIPJACK</strong> is a fast-paced 1v1 mode.</p>
                                <ul>
                                    <li>Two players enter a paid room</li>
                                    <li>Each player receives 2 random cards from previous rounds</li>
                                    <li>Cards carry their previous round scores</li>
                                    <li>Goal: reach closest to <strong>2,500 points</strong></li>
                                    <li>Exceeding 2,500 → instant loss</li>
                                    <li>Lower score than opponent → loss</li>
                                    <li>Players may request additional cards at their own risk</li>
                                </ul>

                                <h4 className="lp-h4">Rewards</h4>
                                <ul>
                                    <li><strong>90%</strong> to the winner</li>
                                    <li><strong>10%</strong> to treasury</li>
                                </ul>
                            </section>

                            {/* ROADMAP */}
                            <section className="lp-section">
                                <h2 className="lp-title">Roadmap</h2>

                                <h3 className="lp-subtitle">Current Features</h3>
                                <ul className="lp-checklist">
                                    <li>✅ Daily prediction rounds</li>
                                    <li>✅ Active Round & LOCK mechanism</li>
                                    <li>✅ Duplicate card risk system</li>
                                    <li>✅ Card packs</li>
                                    <li>✅ Referral program</li>
                                </ul>

                                <h3 className="lp-subtitle">Upcoming Features</h3>
                                <ul className="lp-checklist upcoming">
                                    <li>🔜 FLIPJACK PvP mode</li>
                                    <li>🔜 Score booster packs</li>
                                    <li>🔜 Multiple deck slots</li>
                                    <li>🔜 Seasonal leaderboards</li>
                                    <li>🔜 Advanced progression systems</li>
                                </ul>
                            </section>

                            {/* HELP */}
                            <section className="lp-section">
                                <h2 className="lp-title">Help</h2>

                                <h3 className="lp-subtitle">How to Play</h3>
                                <ol>
                                    <li>Select 5 cards daily</li>
                                    <li>Choose UP or DOWN for each card</li>
                                    <li>Monitor scores during Active Round</li>
                                    <li>Lock cards strategically</li>
                                    <li>Climb the leaderboard and earn rewards</li>
                                </ol>

                                <h3 className="lp-subtitle">In-Game Tooltips</h3>
                                <p>Flip Royale uses contextual tooltips to educate players without interrupting gameplay.</p>
                                <p>Tooltips explain:</p>
                                <ul>
                                    <li>Scoring logic</li>
                                    <li>LOCK mechanics</li>
                                    <li>Duplicate card risk</li>
                                    <li>Maximum score caps</li>
                                    <li>Referral rewards</li>
                                </ul>

                                <h3 className="lp-subtitle">FAQ</h3>
                                <div className="lp-faq">
                                    <div className="faq-item">
                                        <h5>Is Flip Royale pay-to-win?</h5>
                                        <p>No. Skill, timing, and risk management determine success.</p>
                                    </div>
                                    <div className="faq-item">
                                        <h5>Can I win in bearish markets?</h5>
                                        <p>Yes. DOWN predictions allow profits when prices fall.</p>
                                    </div>
                                    <div className="faq-item">
                                        <h5>Is locking mandatory?</h5>
                                        <p>No. Locking is optional but strategically powerful.</p>
                                    </div>
                                </div>
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
                .litepaper-content {
                    color: rgba(255,255,255,0.9);
                    font-size: 16px;
                    line-height: 1.8;
                }
                .lp-section {
                    margin-bottom: 48px;
                    padding-bottom: 48px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .lp-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                .lp-title {
                    font-size: 32px;
                    font-weight: 800;
                    color: #fbbf24;
                    margin-bottom: 24px;
                    padding-bottom: 12px;
                    border-bottom: 3px solid rgba(251, 191, 36, 0.3);
                }
                .lp-subtitle {
                    font-size: 24px;
                    font-weight: 700;
                    color: #fff;
                    margin-top: 32px;
                    margin-bottom: 16px;
                }
                .lp-h4 {
                    font-size: 18px;
                    font-weight: 600;
                    color: #94a3b8;
                    margin-top: 24px;
                    margin-bottom: 12px;
                }
                p {
                    margin-bottom: 16px;
                }
                ul, ol {
                    margin-left: 24px;
                    margin-bottom: 16px;
                }
                li {
                    margin-bottom: 8px;
                }
                li ul {
                    margin-top: 8px;
                }
                .up {
                    color: #10b981;
                    font-weight: 600;
                }
                .down {
                    color: #ef4444;
                    font-weight: 600;
                }
                .lp-highlight {
                    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);
                    border-left: 4px solid #fbbf24;
                    padding: 16px 20px;
                    border-radius: 0 12px 12px 0;
                    margin: 20px 0;
                    font-weight: 500;
                }
                .lp-note {
                    background: rgba(148, 163, 184, 0.1);
                    border-left: 4px solid #64748b;
                    padding: 12px 16px;
                    border-radius: 0 8px 8px 0;
                    margin: 16px 0;
                    font-size: 15px;
                }
                .lp-quote {
                    background: rgba(99, 102, 241, 0.1);
                    border-left: 4px solid #6366f1;
                    padding: 20px 24px;
                    border-radius: 0 12px 12px 0;
                    margin: 24px 0;
                    font-size: 18px;
                    font-style: italic;
                    font-weight: 500;
                }
                .lp-box {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 16px;
                    padding: 24px;
                    margin: 24px 0;
                }
                .lp-box h5 {
                    font-size: 18px;
                    font-weight: 700;
                    color: #10b981;
                    margin-bottom: 12px;
                }
                .lp-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    background: rgba(0,0,0,0.2);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .lp-table th, .lp-table td {
                    padding: 12px 16px;
                    text-align: center;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .lp-table th {
                    background: rgba(255,255,255,0.05);
                    font-weight: 700;
                    color: #fbbf24;
                }
                .lp-table tr:last-child td {
                    border-bottom: none;
                }
                .lp-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    margin: 20px 0;
                }
                .lp-card {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 20px;
                }
                .lp-card h5 {
                    font-size: 16px;
                    font-weight: 700;
                    color: #fbbf24;
                    margin-bottom: 12px;
                }
                .lp-checklist {
                    list-style: none;
                    margin-left: 0;
                }
                .lp-checklist li {
                    padding: 8px 0;
                }
                .lp-faq {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .faq-item {
                    background: rgba(0,0,0,0.2);
                    border-radius: 12px;
                    padding: 20px;
                }
                .faq-item h5 {
                    font-size: 16px;
                    font-weight: 700;
                    color: #fff;
                    margin-bottom: 8px;
                }
                .faq-item p {
                    margin-bottom: 0;
                    color: rgba(255,255,255,0.7);
                }
                @media (max-width: 640px) {
                    .lp-grid {
                        grid-template-columns: 1fr;
                    }
                    .lp-title {
                        font-size: 24px;
                    }
                    .lp-subtitle {
                        font-size: 20px;
                    }
                }
            `}</style>
        </>
    )
}
