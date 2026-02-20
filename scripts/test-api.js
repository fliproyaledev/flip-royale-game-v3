require('dotenv').config({ path: '.env.local' });
const API_KEY = "rweb_standard_i39zdeoq9RDvtbwOslIIw2E2TatsbCW3";
const CAMPAIGN_ID = "7152e1b8-39f5-4d46-8c3b-3a2177f0db0a";

async function test(totalVolume, netProfit, commission, label) {
    const payload = {
        twitterId: '2022716304252170240',
        eventType: 'purchase',
        totalVolume,
        netProfit,
        commission,
        walletAddress: '0x6b8008563d8b0f68824209768d1e44bb0d052418',
        metadata: { test: label }
    };

    const res = await fetch(`https://prod.api.replycorp.io/api/v1/campaigns/${CAMPAIGN_ID}/conversions`, {
        method: 'POST',
        headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`\n=== Test: ${label} ===`);
    if (data.feeDistribution) {
        console.log(`totalToSendToContract: ${data.feeDistribution.totalToSendToContract}`);
    } else {
        console.log('No feeDistribution returned', data);
    }
}

async function run() {
    // We need totalVolume = 15. The multiplier is 10^14. 
    // 15 * 10^14 = 1500000000000000 (1.5e15)
    await test(1500000000000000, 1500000000000000, 300000000000000, 'Multiplier 10^14');
}
run();
