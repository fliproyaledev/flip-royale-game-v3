const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

const SHOP_ABI = [
    "function getAllPackPrices() external view returns (uint256, uint256, uint256, uint256, uint256)",
    "function commonPackPrice() external view returns (uint256)"
];

const SHOP_ADDRESS = process.env.NEXT_PUBLIC_PACK_SHOP_V2_CONTRACT;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";

async function main() {
    console.log(`Checking Shop Contract at: ${SHOP_ADDRESS}`);
    console.log(`RPC: ${RPC_URL}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(SHOP_ADDRESS, SHOP_ABI, provider);

    try {
        console.log("Attempting to call getAllPackPrices()...");
        const prices = await contract.getAllPackPrices();
        console.log("✅ Success! Contract is V3.");
        console.log("Prices:", prices.map(p => ethers.formatEther(p)));
    } catch (error) {
        console.error("❌ getAllPackPrices failed. Trying commonPackPrice (V2/V1 check)...");
        try {
            const common = await contract.commonPackPrice();
            console.log("⚠️ Contract has commonPackPrice but not getAllPackPrices. Might be partial V3 or V2.");
            console.log("Common Price:", ethers.formatEther(common));
        } catch (err2) {
            console.error("❌ All checks failed. Contract might not exist or is invalid.", err2.message);
        }
    }
}

main();
