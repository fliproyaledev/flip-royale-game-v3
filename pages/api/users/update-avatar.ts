// pages/api/users/update-avatar.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getUser, updateUser } from '../../../lib/users'

// Payload size limit increased for base64-encoded images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Increased from 512kb to 4mb for avatar images
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  try {
    const { userId, avatarData } = req.body

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing userId' })
    }
    if (!avatarData || typeof avatarData !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing avatarData' })
    }

    const cleanUserId = userId.toLowerCase()

    // 1. Kullanıcıyı getir (Oracle'dan)
    const user = await getUser(cleanUserId)

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' })
    }

    // 2. Avatarı güncelle
    user.avatar = avatarData

    // 3. Oracle'a kaydet (updateUser kullanıyoruz)
    await updateUser(cleanUserId, user)
    console.log(`[API] Avatar updated for user: ${user.name || user.id}`)

    return res.status(200).json({ ok: true, avatar: user.avatar })

  } catch (error: any) {
    console.error('[API] Update Avatar Error:', error)
    return res.status(500).json({ ok: false, error: 'Internal Server Error' })
  }
}
