require('dotenv').config({ path: '.env.local' });
const API_KEY = process.env.REPLYCORP_API_KEY;
const CAMPAIGN_ID = process.env.REPLYCORP_CAMPAIGN_ID;

async function test(totalVolume, netProfit, commission, label) {
    const payload = {
        twitterId: '2022716304252170240',
        eventType: 'test',
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
    console.log("Testing with 15");
    await test(15, 15, 3, 'Float 3');
    console.log("Testing with 15000000000000 (15 * 10^12)");
    await test(15000000000000, 15000000000000, 3000000000000, '3e12');
}
run();
