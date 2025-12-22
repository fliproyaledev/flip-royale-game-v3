
// import fetch from 'cross-fetch'; // Native fetch is available in Node 18+
import fs from 'fs';

// CONFIG
// ÖNEMLİ: Canlı sunucuda (Vercel) kod üretmek için buraya canlı site adresinizi yazın.
// Örnek: 'https://flip-royale-v3.vercel.app/api/admin/create-invite'
// Localde test ediyorsanız localhost kalabilir.
const API_URL = 'http://localhost:3000/api/admin/create-invite';
const ADMIN_WALLET = '0xbe94fBD02dbfe3695fACEa5101e3B83991dD7911'; // Replace with a wallet in your env.ADMIN_WALLETS
const COUNT = 50; // How many codes to generate

async function generateCodes() {
    console.log(`Generating ${COUNT} waitlist codes...`);

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
                givesFreepack: true // Do you want to give a free pack?
            })
        });

        const data = await response.json();

        if (data.ok && Array.isArray(data.codes)) {
            console.log(`✅ Successfully generated ${data.codes.length} codes.`);

            // Save to CSV
            const csvContent = "Code,Type,CreatedBy\n" +
                data.codes.map((c: any) => `${c.code},${c.type},${c.createdBy}`).join("\n");

            fs.writeFileSync('waitlist_codes.csv', csvContent);
            console.log(`📄 Codes saved to 'waitlist_codes.csv'`);
        } else {
            console.error('❌ Failed:', data.error);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generateCodes();
