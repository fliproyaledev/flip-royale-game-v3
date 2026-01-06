import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'

export default function Guide() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    try {
      const s = localStorage.getItem('flipflop-user')
      if (s) setUser(JSON.parse(s))
    } catch { }
  }, [])

  return (
    <div className="app">
      <Topbar activeTab="guide" user={user} />

      <div className="panel" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 32 }}>🎮 How to Play FLIP ROYALE (Full Guide)</h2>
        <div className="sep"></div>

        <section style={{ marginBottom: 40 }}>
          <h3>0)(AFTER LAUNCH) What You Need (Access)</h3>
          <p>To play Flip Royale, you must hold at least <b>$100 worth of $FLIP</b> in your wallet.</p>
          <p>This is an access requirement (not a fee): your $FLIP is <b>not spent and not locked</b> to play.</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>1) The Basics</h3>
          <p>Flip Royale is a skill-based prediction game where each card represents a real token.</p>
          <p>Every day you build a 5-card lineup and predict whether each token will move <b>UP</b> or <b>DOWN</b> over the next 24 hours.</p>
          <p>You can earn points when tokens go up <i>or</i> when they go down—depending on your prediction.</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>2) Daily Round System (Two Phases)</h3>
          <p>Flip Royale runs on a daily cycle with two phases:</p>

          <h4 style={{ marginTop: 24 }}>A) Next Round (Planning Phase)</h4>
          <p>This is where you prepare your lineup.</p>
          <ul>
            <li>Pick 5 cards for the next day</li>
            <li>For each card choose:
              <ul>
                <li><b>UP</b> = you expect the token to rise</li>
                <li><b>DOWN</b> = you expect the token to fall</li>
              </ul>
            </li>
            <li>You can change your picks anytime until <b>UTC 00:00</b></li>
            <li>No points are finalized here—this is strategy time</li>
          </ul>
          <p>✅ At <b>UTC 00:00</b>, your 5 picks automatically move into the Active Round.</p>

          <h4 style={{ marginTop: 24 }}>B) Active Round (Live Phase)</h4>
          <p>This is where scoring happens.</p>
          <ul>
            <li>The Active Round lasts 24 hours</li>
            <li>Your cards earn/lose points based on real token price movement</li>
            <li>You can actively manage risk using <b>LOCK</b></li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>3) Scoring System (Core Rules)</h3>
          <p>Flip Royale converts % price movement into points:</p>
          <ul>
            <li>Each <b>+1%</b> price move = <b>+100 points</b></li>
            <li>Each <b>-1%</b> price move = <b>-100 points</b></li>
          </ul>
          <p><b>If you selected DOWN:</b></p>
          <p>Scoring is flipped:</p>
          <ul>
            <li>Price goes down → you gain points</li>
            <li>Price goes up → you lose points</li>
          </ul>
          //<p><b>Max points per round:</b> You can earn up to 2,500 points in a single round (cap for fairness)</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>4) The LOCK Mechanism (Most Important Skill)</h3>
          <p>During the Active Round, you can press <b>LOCK</b> on any card.</p>

          <h4 style={{ marginTop: 20 }}>What LOCK does:</h4>
          <ul>
            <li><b>LOCK freezes the card's score immediately</b></li>
            <li>The locked score is your final score for that card</li>
            <li>Locked cards are protected from future volatility</li>
            <li><b>LOCK is irreversible</b> (you can't unlock later)</li>
          </ul>

          <h4 style={{ marginTop: 20 }}>What happens if you DON'T lock:</h4>
          <p>If a card stays unlocked, it settles automatically at <b>UTC 00:00</b> using the final 24h % change.</p>

          <h4 style={{ marginTop: 20 }}>Why LOCK matters:</h4>
          <p>LOCK is how you control risk:</p>
          <ul>
            <li>Lock to secure profits during pumps</li>
            <li>Lock to avoid reversals on volatile tokens</li>
            <li>Lock early if the market is choppy</li>
          </ul>
          <p style={{ fontWeight: 700, color: 'var(--accent-green)' }}>Top players win by locking better—not by guessing more.</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>5) Duplicate Cards (Risk Scaling)</h3>
          <p>You can use the same card multiple times in your 5-card lineup, but duplicates increase risk.</p>
          <p>Using the same card repeatedly affects scoring:</p>
          <ul>
            <li>1st copy: 100% points (normal)</li>
            <li>2nd copy: 75% points if positive, 125% loss if negative</li>
            <li>3rd copy: 50% points if positive, 150% loss if negative</li>
            <li>4th copy: 25% points if positive, 175% loss if negative</li>
            <li>5th copy: 0% points if positive, 200% loss if negative</li>
          </ul>
          <p>✅ This encourages diversification and prevents "one-token stacking" strategies.</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>6) Winning: Daily Points → Weekly Rewards</h3>
          <ul>
            <li>Your daily total score is recorded on the <b>Leaderboard</b></li>
            <li>Weekly rankings determine who earns <b>$FLIP rewards</b></li>
            <li>Compete consistently—one strong day helps, but consistency wins weeks</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>7) Packs & Cards (How You Get Cards)</h3>
          <p>Flip Royale has card packs containing 5 cards each.</p>

          <h4 style={{ marginTop: 20 }}>Pack Types:</h4>
          <ul>
            <li><b>Common Pack:</b> mostly Sentient/Genesis, small Unicorn chance</li>
            <li><b>Rare Pack:</b> higher chance for Unicorn cards</li>
          </ul>

          <h4 style={{ marginTop: 20 }}>Card Categories:</h4>
          <ul>
            <li><b>Sentient:</b> more established tokens</li>
            <li><b>Genesis:</b> growth stage tokens</li>
            <li><b>Unicorn:</b> newer / higher volatility tokens (rarer, higher risk/reward)</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>8) FLIPJACK (1v1 PvP – Coming Soon)</h3>
          <p>FLIPJACK is a fast 1v1 mode.</p>
          <ul>
            <li>Two players enter a paid room</li>
            <li>Each receives 2 random cards from previous rounds (with their past scores)</li>
            <li><b>Goal:</b> get as close as possible to 2,500 points</li>
            <li>Exceed 2,500 → lose instantly</li>
            <li>Lower total than opponent → lose</li>
            <li>Players can request extra cards at their own risk</li>
            <li><b>Payout:</b> Winner gets 90%, 10% goes to treasury</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>9) Boosters & Extra Deck Slots (Optional Features)</h3>
          <ul>
            <li><b>Score Boosters:</b> increase the maximum score limit (optional optimization)</li>
            <li><b>Extra Deck Slots:</b> buy additional 5-card slots to run multiple strategies (advanced users)</li>
          </ul>
          <p>These features amplify strategy—but do not replace skill.</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>10) Referral System (Earn From Invites)</h3>
          <p>Players who buy and/or open packs can generate a referral link.</p>
          <ul>
            <li>Invite friends</li>
            <li>Earn <b>10% commission</b> from your referrals' pack purchases</li>
            <li>Rewards growth through the community</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>11) Pro Tips (How to Actually Win)</h3>
          <ul>
            <li><b>Plan before UTC 00:00:</b> build a diversified lineup, not just hype tokens</li>
            <li><b>Use DOWN intelligently:</b> bearish calls are a weapon, not a backup plan</li>
            <li><b>Lock profits fast on volatility:</b> pumps can reverse quickly</li>
            <li><b>Don't over-stack duplicates:</b> the downside scales hard</li>
            <li><b>Track market movers:</b> use gainers/losers lists to decide when to lock</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h3>12) Quick Glossary</h3>
          <ul>
            <li><b>Next Round:</b> your planning phase (before UTC 00:00)</li>
            <li><b>Active Round:</b> live scoring phase (after UTC 00:00)</li>
            <li><b>LOCK:</b> freeze a card's score permanently</li>
            <li><b>Duplicate:</b> using the same card multiple times (higher risk)</li>
            //<li><b>Cap:</b> max 2,500 points per round</li>
          </ul>
        </section>

        <div style={{ textAlign: 'center', marginTop: 60, padding: '20px', background: 'rgba(0,207,163,0.1)', borderRadius: 16, border: '1px solid rgba(0,207,163,0.3)' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8 }}>Ready to Play?</p>
          <p style={{ opacity: 0.8, marginBottom: 16 }}>Head to the PLAY page and start building your lineup!</p>
          <a href="/" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, var(--accent-green), var(--accent-2))',
            color: '#03120d',
            padding: '12px 32px',
            borderRadius: 12,
            fontWeight: 700,
            textDecoration: 'none'
          }}>
            Start Playing →
          </a>
        </div>
      </div>
    </div>
  )
}
