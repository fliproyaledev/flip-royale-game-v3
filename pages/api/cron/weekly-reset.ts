// pages/api/cron/weekly-reset.ts
// Her Pazartesi UTC 00:00'da (Türkiye 03:00) çalışacak weekly reset job
// Kullanım: cron-job.org veya Vercel Cron ile tetiklenir
// Header'da Authorization: Bearer CRON_SECRET gerekli

import type { NextApiRequest, NextApiResponse } from 'next'
import { kv } from '@vercel/kv'
import { getAllUsers, updateUser } from '../../../lib/users'

const CRON_SECRET = process.env.CRON_SECRET

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // POST veya GET kabul et (cron servisleri farklı kullanabilir)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    }

    // Authorization kontrolü
    const authHeader = req.headers.authorization || req.headers['x-cron-secret']
    const token = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : ''

    if (CRON_SECRET && token !== CRON_SECRET) {
        console.warn('Weekly Reset: Unauthorized attempt')
        return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    try {
        console.log('📊 Weekly Leaderboard Reset starting...')

        // 1. Tüm kullanıcıları çek
        const usersMap = await getAllUsers()
        const usersArray = Object.values(usersMap)

        // 2. Haftalık puanları hesapla
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const getWeeklyScore = (u: any): number => {
            if (!Array.isArray(u.roundHistory) || u.roundHistory.length === 0) return 0

            let sum = 0
            for (const entry of u.roundHistory) {
                const dayKey = entry.dayKey || entry.date || entry.baseDay || null
                if (dayKey) {
                    const d = new Date(dayKey)
                    if (!isNaN(d.getTime()) && d >= sevenDaysAgo) {
                        sum += (entry.totalPoints ?? entry.total ?? 0)
                    }
                }
            }
            return sum
        }

        // 3. Top 100 kullanıcı
        const scored = usersArray
            .map(u => ({
                id: u.id,
                username: u.username || u.name || u.id?.substring(0, 8) || 'Unknown',
                walletAddress: u.walletAddress || u.id || '',
                xHandle: u.xHandle || '',
                weeklyPoints: getWeeklyScore(u)
            }))
            .filter(u => u.weeklyPoints > 0)
            .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
            .slice(0, 100)
            .map((u, i) => ({ rank: i + 1, ...u }))

        // 4. Hafta numarasını hesapla
        const getWeekNumber = (date: Date): string => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
            const dayNum = d.getUTCDay() || 7
            d.setUTCDate(d.getUTCDate() + 4 - dayNum)
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
            return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
        }

        // Geçen haftanın numarası (bugün Pazartesi ise bir önceki hafta)
        const lastWeekDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Bir gün önce
        const weekString = getWeekNumber(lastWeekDate)

        // 5. Hafta başlangıç ve bitiş tarihleri
        const weekStart = new Date(sevenDaysAgo)
        const weekEnd = new Date(now)

        // 6. Arşiv verisini oluştur
        const archiveData = {
            week: weekString,
            startDate: weekStart.toISOString().split('T')[0],
            endDate: weekEnd.toISOString().split('T')[0],
            archivedAt: now.toISOString(),
            totalParticipants: scored.length,
            users: scored
        }

        // 7. KV'ye kaydet
        await kv.set(`leaderboard:weekly:${weekString}`, JSON.stringify(archiveData))

        // 8. Arşiv listesine ekle (en başa)
        await kv.lpush('leaderboard:weekly:archive-list', weekString)

        // 9. Arşiv listesini 52 hafta ile sınırla (1 yıl)
        await kv.ltrim('leaderboard:weekly:archive-list', 0, 51)

        console.log(`✅ Weekly Archive completed: ${weekString} with ${scored.length} participants`)

        // 10. RoundHistory temizleme - arşivlenen haftanın verilerini sil
        // Cutoff tarihi: 7 gün önce (arşivlenen hafta bundan önce)
        const cutoffDate = sevenDaysAgo
        let usersCleared = 0
        let entriesRemoved = 0

        console.log('🧹 Cleaning up roundHistory entries older than', cutoffDate.toISOString().split('T')[0])

        for (const user of usersArray) {
            if (!Array.isArray(user.roundHistory) || user.roundHistory.length === 0) continue

            const originalLength = user.roundHistory.length

            // Sadece cutoff tarihinden SONRAKI (yeni hafta) kayıtları tut
            const newRoundHistory = user.roundHistory.filter((entry: any) => {
                const dayKey = entry.dayKey || entry.date || entry.baseDay || null
                if (!dayKey) return true // Tarih bilgisi yoksa tut
                const entryDate = new Date(dayKey)
                if (isNaN(entryDate.getTime())) return true // Geçersiz tarih ise tut
                return entryDate >= cutoffDate // Cutoff'dan sonraki kayıtları tut
            })

            // Eğer değişiklik varsa güncelle
            if (newRoundHistory.length < originalLength) {
                const removed = originalLength - newRoundHistory.length
                entriesRemoved += removed
                usersCleared++

                try {
                    await updateUser(user.id, { roundHistory: newRoundHistory })
                } catch (err) {
                    console.error(`Failed to update user ${user.id}:`, err)
                }
            }
        }

        console.log(`🧹 Cleanup complete: ${usersCleared} users updated, ${entriesRemoved} entries removed`)

        return res.status(200).json({
            ok: true,
            message: 'Weekly leaderboard archived and history cleared successfully',
            week: weekString,
            totalParticipants: scored.length,
            cleanup: {
                usersCleared,
                entriesRemoved
            },
            top3: scored.slice(0, 3).map(u => ({
                rank: u.rank,
                username: u.username,
                points: u.weeklyPoints
            }))
        })

    } catch (error: any) {
        console.error('Weekly Reset Error:', error)
        return res.status(500).json({ ok: false, error: 'Internal Server Error' })
    }
}

