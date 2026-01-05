/**
 * Generate Rare Pack Codes (Tek Kullanımlık)
 * 
 * Bu script tek kullanımlık RARE PACK kodları oluşturur.
 * Her kod 1 kişi tarafından kullanılabilir ve 1 Rare Pack verir.
 * 
 * Kullanım: npx ts-node scripts/generate_rare_pack_codes.ts
 */

import 'dotenv/config'
import fs from 'fs'

const API_URL = 'https://www.fliproyale.xyz/api/admin/create-invite'
const ADMIN_WALLET = '0xbe94fBD02dbfe3695fACEa5101e3B83991dD7911'
const COUNT = 100  // Kaç adet rare pack kodu oluşturulacak

async function generateRarePackCodes() {
    console.log(`🎁 ${COUNT} adet RARE PACK kodu oluşturuluyor...\n`)

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-wallet': ADMIN_WALLET
            },
            body: JSON.stringify({
                type: 'waitlist',
                count: COUNT,
                givesFreepack: true,
                packType: 'rare'  // RARE PACK!
            })
        })

        const data = await response.json()

        if (data.ok && Array.isArray(data.codes)) {
            console.log(`✅ ${data.codes.length} adet RARE PACK kodu oluşturuldu!\n`)

            // CSV'ye kaydet
            const csvContent = "Code,Type,PackType,CreatedBy\n" +
                data.codes.map((c: any) => `${c.code},${c.type},rare,${c.createdBy}`).join("\n")

            fs.writeFileSync('rare_pack_codes.csv', csvContent)
            console.log(`📄 Kodlar 'rare_pack_codes.csv' dosyasına kaydedildi\n`)

            // Kodları listele
            console.log('🎴 Oluşturulan Rare Pack Kodları:')
            console.log('─'.repeat(30))
            data.codes.forEach((c: any, i: number) => {
                console.log(`   ${i + 1}. ${c.code}`)
            })
            console.log('─'.repeat(30))
        } else {
            console.error('❌ Hata:', data.error)
        }

    } catch (error) {
        console.error('❌ Bağlantı hatası:', error)
    }
}

generateRarePackCodes()
