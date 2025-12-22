import type { NextApiRequest, NextApiResponse } from 'next'

// Arena disabled: this admin endpoint is preserved but performs no operations.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  return res.status(200).json({ ok: true, message: 'Arena is disabled; nothing to reset.' })
}

