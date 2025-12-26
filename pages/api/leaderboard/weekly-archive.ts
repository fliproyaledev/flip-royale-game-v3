// pages/api/leaderboard/weekly-archive.ts
// Arşivlenmiş haftalık leaderboard verilerini getirir

import type { NextApiRequest, NextApiResponse } from 'next'
import { kv } from '@vercel/kv'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    }

    try {
        const { week } = req.query

        // Belirli bir hafta istendi
        if (week && typeof week === 'string') {
            const data = await kv.get(`leaderboard:weekly:${week}`)

            if (!data) {
                return res.status(404).json({ ok: false, error: `Week ${week} not found in archive` })
            }

            const parsed = typeof data === 'string' ? JSON.parse(data) : data
            return res.status(200).json({ ok: true, ...parsed })
        }

        // Tüm arşivlenmiş haftaları listele
        const archiveList = await kv.lrange('leaderboard:weekly:archive-list', 0, 51)

        if (!archiveList || archiveList.length === 0) {
            return res.status(200).json({
                ok: true,
                weeks: [],
                message: 'No archived weeks yet. Weekly archiving happens every Monday at 00:00 UTC.'
            })
        }

        // Her hafta için özet bilgi getir
        const summaries = []
        for (const weekKey of archiveList) {
            const data = await kv.get(`leaderboard:weekly:${weekKey}`)
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data
                summaries.push({
                    week: parsed.week,
                    startDate: parsed.startDate,
                    endDate: parsed.endDate,
                    totalParticipants: parsed.totalParticipants,
                    topThree: parsed.users?.slice(0, 3) || []
                })
            }
        }

        return res.status(200).json({
            ok: true,
            weeks: summaries
        })

    } catch (error: any) {
        console.error('Weekly Archive API Error:', error)
        return res.status(500).json({ ok: false, error: 'Internal Server Error' })
    }
}
