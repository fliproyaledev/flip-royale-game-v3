import type { NextApiRequest, NextApiResponse } from 'next'

// Arena disabled: do not create test rooms.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(501).json({ ok: false, error: 'Arena mode is disabled on this deployment' })
}
