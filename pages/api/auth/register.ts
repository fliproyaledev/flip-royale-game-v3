import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Sadece POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { address, username } = req.body

  if (!address || !username) {
    return res.status(400).json({ ok: false, error: 'Missing address or username' })
  }

  try {
    const normalizedAddress = address.toLowerCase();
    const now = new Date().toISOString();

    console.log(`📝 [Register] Yeni kullanıcı oluşturuluyor: ${normalizedAddress} (${username})`);

    // 1. Yeni Kullanıcı Profili
    const newUserProfile = {
      id: normalizedAddress,
      name: username,
      totalPoints: 0,
      bankPoints: 0,
      giftPoints: 0,
      createdAt: now,
      updatedAt: now,
      
      // HEDİYE PAKETİ: Envantore 1 adet common pack ekle
      inventory: { common_pack: 1 }, 
      
      logs: [{
        type: 'system',
        date: now.slice(0, 10),
        note: 'user-registered-oracle'
      }]
    };

    // 2. Oracle'a Kaydet
    const ORACLE_URL = process.env.ORACLE_URL;
    const ORACLE_SECRET = process.env.ORACLE_SECRET;

    if (!ORACLE_URL || !ORACLE_SECRET) {
      return res.status(500).json({ ok: false, error: 'Oracle configuration missing' });
    }

    const oracleRes = await fetch(`${ORACLE_URL}/api/users/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORACLE_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: normalizedAddress,
        userData: newUserProfile
      })
    });

    if (!oracleRes.ok) {
      const error = await oracleRes.text();
      console.error('❌ [Register] Oracle Error:', error);
      return res.status(oracleRes.status).json({ ok: false, error: 'Failed to register on Oracle' });
    }

    const oracleData = await oracleRes.json();

    console.log(`✅ [Register] Kullanıcı Oracle'a başarıyla kaydedildi: ${normalizedAddress}`);

    return res.status(200).json({ ok: true, user: oracleData.user || newUserProfile, isNewUser: true });

  } catch (error: any) {
    console.error('❌ [Register] Hata:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Registration failed' });
  }
}
