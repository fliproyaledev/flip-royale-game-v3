/**
 * Reset Global Round Counter
 * 
 * Bu script Vercel KV'deki GLOBAL_ROUND_COUNTER değerini sıfırlar.
 * Round sayıları 1'den başlar.
 * 
 * Kullanım: npx ts-node scripts/reset-global-counter.ts
 */

import 'dotenv/config'

// Vercel KV bağlantısı (lib/kv.ts'deki mantığı kullanıyoruz)
const KV_REST_API_URL = process.env.KV_REST_API_URL
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN

if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    console.error('❌ KV_REST_API_URL ve KV_REST_API_TOKEN .env.local dosyasında tanımlı olmalı!')
    console.log('\nVercel Dashboard → Project → Settings → Environment Variables')
    console.log('KV_REST_API_URL ve KV_REST_API_TOKEN değerlerini kopyalayın.')
    process.exit(1)
}

async function resetGlobalCounter() {
    console.log('🔄 Global Round Counter sıfırlanıyor...\n')

    try {
        // GET current value first
        const getResponse = await fetch(`${KV_REST_API_URL}/get/GLOBAL_ROUND_COUNTER`, {
            headers: {
                'Authorization': `Bearer ${KV_REST_API_TOKEN}`
            }
        })

        const getData = await getResponse.json()
        const currentValue = getData.result
        console.log(`📊 Mevcut değer: ${currentValue}`)

        // SET to 0
        const setResponse = await fetch(`${KV_REST_API_URL}/set/GLOBAL_ROUND_COUNTER/0`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KV_REST_API_TOKEN}`
            }
        })

        if (setResponse.ok) {
            console.log('✅ GLOBAL_ROUND_COUNTER = 0 olarak ayarlandı!')
            console.log('\n📝 Sonuç:')
            console.log('   - Mevcut round #1 olarak görünecek')
            console.log('   - Cron job çalışınca #2 olacak')
            console.log('   - Kullanıcı seçimleri korundu')
        } else {
            const errorText = await setResponse.text()
            console.error('❌ Hata:', errorText)
        }

    } catch (error) {
        console.error('❌ Bağlantı hatası:', error)
    }
}

resetGlobalCounter()
