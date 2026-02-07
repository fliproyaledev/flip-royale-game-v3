const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

const ABI = [
    "function virtualToken() external view returns (address)",
    "function owner() external view returns (address)"
];

const CONTRACT_ADDRESS = "0xe2DB819F068d8e3040C66154dC10A057206f5120"; // User provided address
const EXPECTED_VIRTUAL = "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";

async function main() {
    console.log(`Checking Contract: ${CONTRACT_ADDRESS}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        const token = await contract.virtualToken();
        const owner = await contract.owner();

        console.log(`Token in Contract: ${token}`);
        console.log(`Expected VIRTUAL:  ${EXPECTED_VIRTUAL}`);
        console.log(`Contract Owner:    ${owner}`);

        if (token.toLowerCase() === EXPECTED_VIRTUAL.toLowerCase()) {
            console.log("✅ MATCH! This contract uses VIRTUAL token.");
        } else {
            console.log("❌ MISMATCH! This contract uses a different token.");
        }

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

main();
