import type { NextApiRequest, NextApiResponse } from 'next'
import { getAllUsers } from '../../../lib/users'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  try {
    // 1. Tüm kullanıcıları veritabanından çek
    const usersMap = await getAllUsers()
    const usersArray = Object.values(usersMap)

    // Support optional timeframe query: 'all' | 'daily' | 'weekly'
    const timeframe = String(req.query.timeframe || 'all')

    const getUserScoreForTimeframe = (u: any) => {
      if (timeframe === 'daily') {
        // Get today's date in UTC (YYYY-MM-DD format)
        const now = new Date()
        const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

        // Find today's entry in roundHistory
        if (!Array.isArray(u.roundHistory) || u.roundHistory.length === 0) return 0

        const todayEntry = u.roundHistory.find((entry: any) => {
          const entryDate = entry.date || entry.dayKey || entry.baseDay || null
          return entryDate === todayKey
        })

        return todayEntry ? (todayEntry.totalPoints ?? todayEntry.total ?? 0) : 0
      }
      if (timeframe === 'weekly') {
        // ISO Week Based: Monday 00:00 UTC to Sunday 23:59 UTC
        if (!Array.isArray(u.roundHistory) || u.roundHistory.length === 0) return 0

        const now = new Date()

        // Get current week's Monday 00:00 UTC
        const dayOfWeek = now.getUTCDay() // 0 = Sunday, 1 = Monday, ...
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Sunday = 6 days since Monday
        const weekStart = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - daysSinceMonday,
          0, 0, 0, 0
        ))

        let sum = 0
        for (const entry of u.roundHistory) {
          const dayKey = entry.dayKey || entry.date || entry.baseDay || null
          if (dayKey) {
            const d = new Date(dayKey)
            if (!isNaN(d.getTime()) && d >= weekStart) {
              sum += (entry.totalPoints ?? entry.total ?? 0)
            }
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

    // Filter out users with zero or negative points (leaderboard should only show positive)
    const filtered = scored.filter(item => item.score > 0)

    const sorted = filtered.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 100)

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
