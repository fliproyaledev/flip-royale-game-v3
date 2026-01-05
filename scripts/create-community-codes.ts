/**
 * Create Community Codes with Usage Limits
 * 
 * Bu script topluluklar için sınırlı kullanımlı kodlar oluşturur.
 * Her kod belirlenen sayıda kişi tarafından kullanılabilir.
 * 
 * Kullanım: npx ts-node scripts/create-community-codes.ts
 */

import 'dotenv/config'

const API_URL = 'https://www.fliproyale.xyz/api/admin/create-invite'
const ADMIN_WALLET = '0xbe94fBD02dbfe3695fACEa5101e3B83991dD7911'

// Topluluk kodları tanımları - FLIP + 3 harf formatı
const COMMUNITY_CODES = [
    // 10 kişilik kodlar (4 tane)
    { code: 'FLIPACE', limit: 10, name: '10 Kişilik - ACE' },
    { code: 'FLIPBET', limit: 10, name: '10 Kişilik - BET' },
    { code: 'FLIPCAP', limit: 10, name: '10 Kişilik - CAP' },
    { code: 'FLIPDEX', limit: 10, name: '10 Kişilik - DEX' },

    // 20 kişilik kod
    { code: 'FLIPEGO', limit: 20, name: '20 Kişilik - EGO' },

    // 25 kişilik kod
    { code: 'FLIPFOX', limit: 25, name: '25 Kişilik - FOX' },

    // 50 kişilik kod
    { code: 'FLIPGEM', limit: 50, name: '50 Kişilik - GEM' },

    // 100 kişilik kod
    { code: 'FLIPHUB', limit: 100, name: '100 Kişilik - HUB' },
]

async function createCommunityCode(code: string, maxUses: number): Promise<boolean> {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-wallet': ADMIN_WALLET
            },
            body: JSON.stringify({
                type: 'waitlist',
                customCode: code,
                givesFreepack: true,
                maxUses: maxUses  // Bu önemli - limiti belirliyor
            })
        })

        const data = await response.json()
        return data.ok === true
    } catch (error) {
        console.error(`❌ Error creating ${code}:`, error)
        return false
    }
}

async function main() {
    console.log('🚀 Topluluk Kodları Oluşturuluyor...\n')
    console.log('='.repeat(50))

    const results: { code: string; limit: number; success: boolean }[] = []

    for (const community of COMMUNITY_CODES) {
        process.stdout.write(`Creating ${community.code} (${community.limit} uses)... `)

        const success = await createCommunityCode(community.code, community.limit)
        results.push({ code: community.code, limit: community.limit, success })

        console.log(success ? '✅' : '❌')
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 SONUÇLAR:')
    console.log('='.repeat(50))

    console.log('\n| Kod | Limit | Durum |')
    console.log('|-----|-------|-------|')

    for (const r of results) {
        console.log(`| ${r.code} | ${r.limit} kişi | ${r.success ? '✅ OK' : '❌ HATA'} |`)
    }

    const successCount = results.filter(r => r.success).length
    console.log(`\n✅ Başarılı: ${successCount}/${results.length}`)

    if (successCount === results.length) {
        console.log('\n🎉 Tüm topluluk kodları başarıyla oluşturuldu!')
        console.log('\n📝 Kodları paylaşabilirsin. Her kod belirtilen sayıda kişi tarafından kullanılabilir.')
    }
}

main().catch(console.error)
