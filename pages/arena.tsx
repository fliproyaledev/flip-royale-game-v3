/**
 * Arena Hub - Game Mode Selection
 */

import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Topbar from '../components/Topbar'
import { useTheme } from '../lib/theme'

export default function ArenaPage() {
  const { theme } = useTheme()
  const { address, isConnected } = useAccount()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('flipflop-user')
        if (saved) setUser(JSON.parse(saved))
      } catch { }
    }
  }, [])

  const gameModes = [
    {
      id: 'duel',
      name: 'Flip Duel',
      emoji: '⚔️',
      description: 'FDV-based 1v1 PvP battle',
      subtitle: 'Highest FDV total wins',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      href: '/arena/duel',
      features: ['3 vs 3 cards', 'FDV-based winner', '10% house fee']
    },
    {
      id: 'taso',
      name: 'Flip Flop',
      emoji: '🃏',
      description: 'Card flip showdown',
      subtitle: 'Front or Back - Test your luck!',
      color: '#ec4899',
      gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
      href: '/arena/taso',
      features: ['1v1 card flip', 'Loser card wrecked', 'High risk, high reward']
    },
    {
      id: 'rewards',
      name: 'Rewards',
      emoji: '💰',
      description: 'Claim your winnings',
      subtitle: 'Withdraw USDC to your wallet',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      href: '/rewards',
      features: ['View balance', 'Withdraw USDC', 'Claim history']
    },
  ]

  return (
    <>
      <Head>
        <title>Arena | FLIP ROYALE</title>
        <meta name="description" content="PvP game modes - Flip Duel & Flip Flop" />
      </Head>

      <div className="app" data-theme={theme}>
        <Topbar activeTab="arena" user={user} />

        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{
              fontSize: 36,
              fontWeight: 900,
              marginBottom: 8,
              background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              🏟️ ARENA
            </h1>
            <p style={{ opacity: 0.7, fontSize: 16 }}>
              PvP game modes - Stake USDC and win!
            </p>
          </div>

          {/* Connect Wallet */}
          {!isConnected && (
            <div className="panel" style={{
              textAlign: 'center',
              padding: 32,
              marginBottom: 32
            }}>
              <p style={{ marginBottom: 16, opacity: 0.8 }}>
                Connect your wallet to enter the Arena
              </p>
              <ConnectButton />
            </div>
          )}

          {/* Game Modes Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24
          }}>
            {gameModes.map(mode => (
              <Link
                key={mode.id}
                href={isConnected ? mode.href : '#'}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  pointerEvents: isConnected ? 'auto' : 'none',
                  opacity: isConnected ? 1 : 0.5,
                }}
              >
                <div
                  className="panel"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    background: `${mode.gradient}15`,
                    border: `2px solid ${mode.color}40`,
                    cursor: isConnected ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    if (isConnected) {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = `0 12px 40px ${mode.color}30`
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Mode Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 48 }}>{mode.emoji}</span>
                    <div>
                      <h2 style={{
                        fontSize: 24,
                        fontWeight: 800,
                        margin: 0,
                        color: mode.color
                      }}>
                        {mode.name}
                      </h2>
                      <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
                        {mode.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ marginBottom: 16, opacity: 0.8, fontSize: 15 }}>
                    {mode.description}
                  </p>

                  {/* Features */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {mode.features.map((feature, i) => (
                      <span
                        key={i}
                        style={{
                          background: `${mode.color}20`,
                          color: mode.color,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Enter Button */}
                  <button
                    style={{
                      width: '100%',
                      marginTop: 20,
                      padding: '12px 24px',
                      borderRadius: 10,
                      border: 'none',
                      background: mode.gradient,
                      color: '#000',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      textTransform: 'uppercase',
                      letterSpacing: 1
                    }}
                  >
                    {isConnected ? 'Enter →' : 'Connect Wallet'}
                  </button>
                </div>
              </Link>
            ))}
          </div>

          {/* Coming Soon */}
          <div className="panel" style={{
            marginTop: 32,
            padding: 24,
            textAlign: 'center',
            opacity: 0.6
          }}>
            <p style={{ fontSize: 14 }}>
              🚧 More game modes coming soon...
            </p>
          </div>
        </main>
      </div>
    </>
  )
}