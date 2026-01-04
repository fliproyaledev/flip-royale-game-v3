/**
 * Reset Rounds & Leaderboard Script
 * 
 * Bu script tüm kullanıcıların round ve puan bilgilerini sıfırlar.
 * KARTLAR (inventory) KORUNUR!
 * 
 * Kullanım:
 *   npx ts-node scripts/reset-rounds.ts
 * 
 * Veya:
 *   node -r ts-node/register scripts/reset-rounds.ts
 */

import 'dotenv/config'

const ORACLE_URL = process.env.ORACLE_URL
const ORACLE_SECRET = process.env.ORACLE_SECRET

if (!ORACLE_URL || !ORACLE_SECRET) {
    console.error('❌ ORACLE_URL ve ORACLE_SECRET .env.local dosyasında tanımlı olmalı!')
    process.exit(1)
}

interface UserRecord {
    id: string
    name?: string
    avatar?: string
    totalPoints: number
    bankPoints: number
    giftPoints: number
    currentRound?: number
    activeRound?: any[]
    nextRound?: any[]
    roundHistory?: any[]
    logs?: any[]
    inventory?: Record<string, number>
    // Diğer alanlar korunacak
    [key: string]: any
}

async function getAllUsers(): Promise<UserRecord[]> {
    console.log('📥 Tüm kullanıcılar çekiliyor...')

    const res = await fetch(`${ORACLE_URL}/api/users/all`, {
        headers: {
            'Authorization': `Bearer ${ORACLE_SECRET}`,
            'Content-Type': 'application/json'
        }
    })

    if (!res.ok) {
        throw new Error(`Oracle bağlantı hatası: ${res.status}`)
    }

    const data = await res.json()
    return data.users || []
}

async function updateUser(address: string, updates: Partial<UserRecord>): Promise<void> {
    const res = await fetch(`${ORACLE_URL}/api/users/update`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ORACLE_SECRET}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            address: address.toLowerCase(),
            userData: updates
        })
    })

    if (!res.ok) {
        throw new Error(`Kullanıcı güncellenemedi: ${address}`)
    }
}

async function resetAllRoundsAndLeaderboard() {
    console.log('🚀 Round ve Leaderboard Sıfırlama Başlıyor...\n')

    const users = await getAllUsers()
    console.log(`📊 Toplam ${users.length} kullanıcı bulundu.\n`)

    let successCount = 0
    let errorCount = 0

    for (const user of users) {
        try {
            // Sıfırlanacak alanlar (SADECE puanlar ve geçmiş)
            const resetData: Partial<UserRecord> = {
                // Puanlar sıfırlanıyor
                totalPoints: 0,
                bankPoints: 0,
                giftPoints: 0,

                // Round SAYISI sıfırlanıyor
                currentRound: 1,

                // Geçmiş (history) temizleniyor
                roundHistory: [],
                lastSettledDay: undefined,

                // Güncelleme zamanı
                updatedAt: new Date().toISOString()
            }

            // KORUNAN ALANLAR (değiştirilmiyor):
            // - activeRound (mevcut round seçimleri) ✅
            // - nextRound (sonraki round seçimleri) ✅
            // - inventory (kartlar) ✅
            // - id, name, avatar ✅
            // - packsPurchased ✅
            // - referralCode, referredBy ✅
            // - pendingCommission, totalCommissionEarned ✅     // vs.

            await updateUser(user.id, resetData)
            successCount++

            // İlerleme göster
            if (successCount % 10 === 0) {
                console.log(`⏳ ${successCount}/${users.length} kullanıcı güncellendi...`)
            }

        } catch (err) {
            console.error(`❌ Hata (${user.id}):`, err)
            errorCount++
        }
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ SIFIRLAMA TAMAMLANDI!')
    console.log('='.repeat(50))
    console.log(`   Başarılı: ${successCount}`)
    console.log(`   Hatalı: ${errorCount}`)
    console.log(`   Toplam: ${users.length}`)
    console.log('='.repeat(50))
    console.log('\n📝 Not: Kullanıcıların kartları (inventory) KORUNDU.')
    console.log('📝 Not: Referral ve komisyon bilgileri KORUNDU.')
}

// Script'i çalıştır
resetAllRoundsAndLeaderboard()
    .then(() => {
        console.log('\n🎉 Script başarıyla tamamlandı!')
        process.exit(0)
    })
    .catch((err) => {
        console.error('\n💥 Script hatası:', err)
        process.exit(1)
    })
