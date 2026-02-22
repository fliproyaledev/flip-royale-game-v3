const API_KEY = "rweb_standard_i39zdeoq9RDvtbwOslIIw2E2TatsbCW3";
const CAMPAIGN_ID = "7152e1b8-39f5-4d46-8c3b-3a2177f0db0a";

async function testTokenAmount() {
    const amount = 15; // 15 VIRTUAL

    const payload = {
        twitterId: "2022716304252170240", // User who has referrers
        eventType: "purchase",
        totalVolume: amount,
        netProfit: amount,
        commission: amount * 0.2, // 3 VIRTUAL
        walletAddress: "0xbe94fBD02dbfe3695fACEa5101e3B83991dD7911", // Admin wallet
        metadata: { test: "fee_distribution_check" }
    };

    console.log("Sending Payload:", JSON.stringify(payload));

    const res = await fetch(`https://prod.api.replycorp.io/api/v1/campaigns/${CAMPAIGN_ID}/conversions`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const status = res.status;
    const data = await res.json();

    console.log(`Status: ${status}`);
    console.log("Response:", JSON.stringify(data, null, 2));
}

testTokenAmount();
