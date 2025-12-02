import type { NextApiRequest, NextApiResponse } from "next";
// Arena duel settlement disabled: this endpoint is retained but becomes a safe no-op.

// Vercel Environment Variables'dan gizli anahtarı alıyoruz
const CRON_SECRET = process.env.CRON_SECRET;

function utcDayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Sadece GET isteklerine izin ver
  if (req.method !== "GET")
    return res.status(405).json({ ok: false, error: "GET only" });

  // ---------------------------------------------------------
  // GÜVENLİK KONTROLÜ (Harici Cron Servisi İçin)
  // URL'den gelen 'key' parametresini kontrol eder.
  // Örnek kullanım: https://site.com/api/cron/settle-arenas?key=GIZLI_SIFRE
  // ---------------------------------------------------------
  const { key } = req.query;

  if (!CRON_SECRET) {
    return res.status(500).json({ ok: false, error: "Server Error: CRON_SECRET not set in env" });
  }

  if (key !== CRON_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid Secret Key" });
  }
  // ---------------------------------------------------------
  // Arena mode removed/disabled. Return success but perform no operations.
  return res.status(200).json({ ok: true, message: 'Arena mode is disabled; no settlement performed.' })
}
