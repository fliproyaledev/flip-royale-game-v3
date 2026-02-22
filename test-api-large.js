const API_KEY = "rweb_standard_i39zdeoq9RDvtbwOslIIw2E2TatsbCW3";
const CAMPAIGN_ID = "7152e1b8-39f5-4d46-8c3b-3a2177f0db0a";

async function testLargeNumber() {
    const numAmount = 1500000; // 1.5 million, well within a 32-bit integer

    const payload = {
        twitterId: "1456218166",
        eventType: "purchase",
        totalVolume: numAmount,
        netProfit: numAmount,
        commission: numAmount * 0.2, // 300000
        walletAddress: "0xbe94fBD02dbfe3695fACEa5101e3B83991dD7911",
        metadata: { test: "under_int4_limit" }
    };

    console.log("Sending Payload:", JSON.stringify(payload));

    const res = await fetch(`https://prod.api.replycorp.io/api/v1/campaigns/${CAMPAIGN_ID}/conversions`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    console.log(res.status, await res.text());
}
testLargeNumber();
