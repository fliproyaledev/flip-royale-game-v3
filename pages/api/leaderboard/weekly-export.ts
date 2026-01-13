// pages/api/leaderboard/weekly-export.ts
// Haftalık leaderboard sonuçlarını JSON veya CSV olarak export eder

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
        const format = (req.query.format as string) || 'json'
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000)

        // 1. Tüm kullanıcıları çek
        const usersMap = await getAllUsers()
        const usersArray = Object.values(usersMap)

        // 2. Tarih aralığını belirle (custom veya son 7 gün)
        const now = new Date()
        let startDate: Date
        let endDate: Date

        if (req.query.startDate && req.query.endDate) {
            // Custom tarih aralığı: ?startDate=2026-01-05&endDate=2026-01-12
            startDate = new Date(req.query.startDate as string)
            endDate = new Date(req.query.endDate as string)
            // endDate'i günün sonuna ayarla (23:59:59)
            endDate.setHours(23, 59, 59, 999)
        } else {
            // Varsayılan: Mevcut ISO Hafta (Pazartesi başlangıç)
            endDate = now

            // Get current week's Monday 00:00 UTC
            const dayOfWeek = now.getUTCDay() // 0 = Sunday, 1 = Monday, ...
            const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
            startDate = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - daysSinceMonday,
                0, 0, 0, 0
            ))
        }

        const getScoreForRange = (u: any): number => {
            if (!Array.isArray(u.roundHistory) || u.roundHistory.length === 0) return 0

            let sum = 0
            for (const entry of u.roundHistory) {
                const dayKey = entry.dayKey || entry.date || entry.baseDay || null
                if (dayKey) {
                    const d = new Date(dayKey)
                    if (!isNaN(d.getTime()) && d >= startDate && d <= endDate) {
                        sum += (entry.totalPoints ?? entry.total ?? 0)
                    }
                }
            }
            return sum
        }

        // 3. Kullanıcıları puanlarıyla eşleştir ve sırala
        const scored = usersArray
            .map(u => ({
                id: u.id,
                username: u.username || u.name || u.id?.substring(0, 8) || 'Unknown',
                walletAddress: u.walletAddress || u.id || '',
                xHandle: u.xHandle || '',
                weeklyPoints: getScoreForRange(u)
            }))
            .filter(u => u.weeklyPoints > 0)
            .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
            .slice(0, limit)
            .map((u, i) => ({ rank: i + 1, ...u }))

        // 4. Hafta numarasını hesapla (ISO week)
        const getWeekNumber = (date: Date): string => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
            const dayNum = d.getUTCDay() || 7
            d.setUTCDate(d.getUTCDate() + 4 - dayNum)
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
            return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
        }

        const weekString = getWeekNumber(now)

        // 5. Format'a göre döndür
        if (format === 'csv') {
            const csvHeader = 'rank,username,walletAddress,xHandle,weeklyPoints'
            const csvRows = scored.map(u =>
                `${u.rank},"${u.username}","${u.walletAddress}","${u.xHandle}",${u.weeklyPoints}`
            )
            const csv = [csvHeader, ...csvRows].join('\n')

            res.setHeader('Content-Type', 'text/csv')
            res.setHeader('Content-Disposition', `attachment; filename="weekly-leaderboard-${weekString}.csv"`)
            return res.status(200).send(csv)
        }

        // JSON format (default)
        return res.status(200).json({
            ok: true,
            week: weekString,
            exportedAt: now.toISOString(),
            totalUsers: scored.length,
            users: scored
        })

    } catch (error: any) {
        console.error('Weekly Export API Error:', error)
        return res.status(500).json({ ok: false, error: 'Internal Server Error' })
    }
}
