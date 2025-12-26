// pages/api/leaderboard/settle-weekly.ts
// Her Pazartesi 00:00 UTC'de çalışır, haftalık leaderboard'u arşivler ve sıfırlar

import type { NextApiRequest, NextApiResponse } from 'next'
import { getAllUsers } from '../../../lib/users'
import { kv } from '@vercel/kv'

// Hafta numarasını hesapla (ISO week number)
function getWeekNumber(d: Date): string {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${date.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Cron secret kontrolü (opsiyonel güvenlik)
    const cronSecret = req.headers['authorization']?.replace('Bearer ', '')
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
        // Allow manual trigger without secret in development
        if (process.env.NODE_ENV === 'production' && req.query.manual !== 'true') {
            return res.status(401).json({ ok: false, error: 'Unauthorized' })
        }
    }

    try {
        // 1. Şu anki hafta numarasını hesapla (geçen haftayı arşivliyoruz)
        const now = new Date()
        // Pazartesi çalıştığında, önceki haftayı arşivlememiz lazım
        const lastWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const weekKey = getWeekNumber(lastWeekDate)

        // 2. Hafta başlangıç ve bitiş tarihlerini hesapla
        const startOfWeek = new Date(lastWeekDate)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        startOfWeek.setHours(0, 0, 0, 0)

        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(endOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)

        // 3. Tüm kullanıcıları çek ve haftalık skorları hesapla
        const usersMap = await getAllUsers()
        const usersArray = Object.values(usersMap)

        const weeklyScores: Array<{
            rank: number
            userId: string
            username: string
            avatar: string
            totalPoints: number
        }> = []

        for (const u of usersArray) {
            if (!Array.isArray(u.roundHistory) || u.roundHistory.length === 0) continue

            let weekSum = 0
            for (const entry of u.roundHistory) {
                // RoundHistoryEntry has 'date' property (string)
                const entryDateStr = entry.date
                if (!entryDateStr) continue

                const entryDate = new Date(entryDateStr)
                if (isNaN(entryDate.getTime())) continue

                // Bu entry geçen hafta içinde mi?
                if (entryDate >= startOfWeek && entryDate <= endOfWeek) {
                    weekSum += entry.totalPoints || 0
                }
            }

            if (weekSum !== 0) {
                weeklyScores.push({
                    rank: 0, // Sıralama sonra atanacak
                    userId: u.id,
                    username: u.name || u.id.substring(0, 8),
                    avatar: u.avatar || '',
                    totalPoints: weekSum
                })
            }
        }

        // 4. Skorlara göre sırala
        weeklyScores.sort((a, b) => b.totalPoints - a.totalPoints)

        // 5. Rank ata
        weeklyScores.forEach((entry, i) => {
            entry.rank = i + 1
        })

        // 6. Redis'e arşivle
        const archiveData = {
            week: weekKey,
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: endOfWeek.toISOString().split('T')[0],
            archivedAt: now.toISOString(),
            totalParticipants: weeklyScores.length,
            users: weeklyScores.slice(0, 100) // Top 100
        }

        await kv.set(`leaderboard:weekly:${weekKey}`, JSON.stringify(archiveData))

        // 7. Arşiv listesine ekle (son 52 haftayı tut)
        await kv.lpush('leaderboard:weekly:archive-list', weekKey)
        await kv.ltrim('leaderboard:weekly:archive-list', 0, 51)

        console.log(`[Weekly Leaderboard] Archived ${weekKey} with ${weeklyScores.length} participants`)

        return res.status(200).json({
            ok: true,
            week: weekKey,
            startDate: archiveData.startDate,
            endDate: archiveData.endDate,
            participantCount: weeklyScores.length,
            topThree: weeklyScores.slice(0, 3)
        })

    } catch (error: any) {
        console.error('[Weekly Leaderboard] Settlement error:', error)
        return res.status(500).json({ ok: false, error: error.message || 'Internal Server Error' })
    }
}
