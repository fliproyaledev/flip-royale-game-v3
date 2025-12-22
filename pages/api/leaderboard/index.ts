import type { NextApiRequest, NextApiResponse } from 'next'
import { loadUsers } from '../../../lib/users'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  try {
    // 1. Tüm kullanıcıları veritabanından çek
    const usersMap = await loadUsers()
    const usersArray = Object.values(usersMap)

    // Support optional timeframe query: 'all' | 'daily' | 'weekly'
    const timeframe = String(req.query.timeframe || 'all')

    const getUserScoreForTimeframe = (u: any) => {
      if (timeframe === 'daily') {
        // Most recent round entry (assume roundHistory[0] is newest)
        const latest = Array.isArray(u.roundHistory) && u.roundHistory.length > 0 ? u.roundHistory[0] : null
        return latest ? (latest.totalPoints ?? latest.total ?? 0) : 0
      }
      if (timeframe === 'weekly') {
        // Sum totals for last 7 entries or entries within last 7 days
        if (!Array.isArray(u.roundHistory) || u.roundHistory.length === 0) return 0
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        let sum = 0
        for (const entry of u.roundHistory) {
          const dayKey = entry.dayKey || entry.date || entry.baseDay || null
          // If dayKey exists and is parseable, use date filter; otherwise sum up to first 7 entries
          if (dayKey) {
            const d = new Date(dayKey)
            if (!isNaN(d.getTime())) {
              if (d >= sevenDaysAgo) {
                sum += (entry.totalPoints ?? entry.total ?? 0)
              }
              continue
            }
          }
          // fallback: sum up to first 7 items
          if (sum === 0) {
            const slice = u.roundHistory.slice(0, 7)
            for (const s of slice) sum += (s.totalPoints ?? s.total ?? 0)
            break
          }
        }
        return sum
      }

      // default: all time (use totalPoints)
      return u.totalPoints || 0
    }

    const scored = usersArray.map(u => ({
      user: u,
      score: getUserScoreForTimeframe(u)
    }))

    const sorted = scored.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 100)

    const top = sorted.map((item, i) => ({
      id: item.user.id,
      name: item.user.name || item.user.id.substring(0, 8),
      avatar: item.user.avatar,
      totalPoints: item.score,
      bankPoints: item.user.bankPoints,
      roundsPlayed: item.user.currentRound ? item.user.currentRound - 1 : 0,
      activeCards: item.user.activeRound ? item.user.activeRound.length : 0,
      bestRound: 0,
      rank: i + 1
    }))

    return res.status(200).json({ ok: true, users: top })

  } catch (error: any) {
    console.error('Leaderboard API Error:', error)
    return res.status(500).json({ ok: false, error: 'Internal Server Error' })
  }
}
