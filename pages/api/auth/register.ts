import type { NextApiRequest, NextApiResponse } from 'next'
import { getKV } from '../../../lib/kv'

const INVITES_KEY = 'fliproyale:invites'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Sadece POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  // Support both old format (address, username) and new format (userId, username, openAccess, referralCode)
  const { address, userId, username, openAccess, referralCode } = req.body
  const walletAddress = address || userId

  if (!walletAddress) {
    return res.status(400).json({ ok: false, error: 'Missing address/userId' })
  }

  // For openAccess mode, username is optional (defaults to 'Player')
  const finalUsername = username || 'Player'

  try {
    const normalizedAddress = String(walletAddress).toLowerCase();
    const now = new Date().toISOString();

    // Process referral code if provided
    let referredBy: string | null = null
    if (referralCode) {
      try {
        const raw = await getKV(INVITES_KEY)
        if (raw) {
          const invites = JSON.parse(raw)
          const invite = invites.codes[referralCode.toUpperCase()]
          // Only referral type codes have a createdBy (referrer wallet)
          if (invite && invite.type === 'referral' && invite.createdBy) {
            referredBy = invite.createdBy.toLowerCase()
            console.log(`🔗 [Register] Referral linked: ${normalizedAddress} referred by ${referredBy}`)
          }
        }
      } catch (e) {
        console.error('[Register] Error processing referral code:', e)
      }
    }

    console.log(`📝 [Register] Yeni kullanıcı oluşturuluyor: ${normalizedAddress} (${finalUsername}) - OpenAccess: ${!!openAccess} - Referrer: ${referredBy || 'none'}`);

    // Yeni Kullanıcı Profili
    // Open access users don't get free pack, invite users do
    const newUserProfile: any = {
      id: normalizedAddress,
      name: finalUsername,
      username: finalUsername,
      hasChangedUsername: false,
      totalPoints: 0,
      bankPoints: 0,
      giftPoints: 0,
      createdAt: now,
      updatedAt: now,

      // Open access: no free pack, Invite flow: 1 common pack
      inventory: openAccess ? {} : { common_pack: 1 },

      activeRound: [],
      nextRound: Array(5).fill(null),
      currentRound: 1,
      roundHistory: [],

      // Track registration type
      openAccessRegistration: !!openAccess,
      inviteCodeUsed: referralCode || null,
      inviteType: referralCode ? 'referral' : null,
      referredBy: referredBy, // Link to referrer wallet
      packsPurchased: 0,
      pendingCommission: 0,
      totalCommissionEarned: 0,

      logs: [{
        type: 'system',
        date: now.slice(0, 10),
        note: openAccess ? 'user-registered-open-access' : 'user-registered-oracle'
      }]
    };

    // Oracle'a Kaydet
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

    console.log(`✅ [Register] Kullanıcı ${openAccess ? 'open access' : 'invite'} ile kaydedildi: ${normalizedAddress}`);

    return res.status(200).json({ ok: true, user: oracleData.user || newUserProfile, isNewUser: true });

  } catch (error: any) {
    console.error('❌ [Register] Hata:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Registration failed' });
  }
}

