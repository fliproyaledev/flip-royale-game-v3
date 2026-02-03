// scripts/debug-arena.js
// Deep debug script to check all arena contract state

const hre = require("hardhat");

const V1_CONTRACT = "0x83E316B9aa8F675b028279f089179bA26792242B";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USER_WALLET = "0x59749215DA9aedc456B173146c0890Af87F6E6f4"; // Treasury (user's wallet)

const V1_ABI = [
    "function allRoomIds(uint256 index) view returns (bytes32)",
    "function rooms(bytes32) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)",
    "function owner() view returns (address)",
    "function getTierStake(uint8 tier) view returns (uint256)",
    "function paused() view returns (bool)",
    "function oracle() view returns (address)",
    "function treasury() view returns (address)"
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function main() {
    const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
    const contract = new hre.ethers.Contract(V1_CONTRACT, V1_ABI, provider);
    const usdc = new hre.ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

    console.log("═══════════════════════════════════════════════════════");
    console.log("FlipRoyaleArena V1 - Deep Debug");
    console.log("═══════════════════════════════════════════════════════");
    console.log("Contract:", V1_CONTRACT);

    try {
        const owner = await contract.owner();
        console.log("Owner:", owner);

        const oracle = await contract.oracle();
        console.log("Oracle:", oracle);

        const treasury = await contract.treasury();
        console.log("Treasury:", treasury);

        const paused = await contract.paused();
        console.log("Paused:", paused);
    } catch (e) {
        console.log("Error fetching basic info:", e.message);
    }

    console.log("\n📊 Tier Stakes (Contract vs Frontend):");
    const frontendStakes = [10_000_000, 25_000_000, 50_000_000, 100_000_000];
    for (let tier = 0; tier <= 3; tier++) {
        try {
            const stake = await contract.getTierStake(tier);
            const match = stake.toString() === frontendStakes[tier].toString();
            console.log(`  Tier ${tier}: Contract=${stake} Frontend=${frontendStakes[tier]} ${match ? '✅' : '❌ MISMATCH!'}`);
        } catch (e) {
            console.log(`  Tier ${tier}: Error - ${e.message}`);
        }
    }

    console.log("\n💰 USDC Status for User:");
    try {
        const balance = await usdc.balanceOf(USER_WALLET);
        console.log(`  Balance: $${Number(balance) / 1_000_000} USDC`);

        const allowance = await usdc.allowance(USER_WALLET, V1_CONTRACT);
        console.log(`  Allowance to Arena: $${Number(allowance) / 1_000_000} USDC`);
    } catch (e) {
        console.log("  Error fetching USDC info:", e.message);
    }

    console.log("\n💰 Contract USDC Balance:");
    try {
        const contractBalance = await usdc.balanceOf(V1_CONTRACT);
        console.log(`  Contract holds: $${Number(contractBalance) / 1_000_000} USDC`);
    } catch (e) {
        console.log("  Error:", e.message);
    }

    console.log("\n📋 All Rooms:");
    const statusNames = ['Open', 'Filled', 'Resolved', 'Draw', 'Cancelled'];
    const gameNames = ['Duel', 'Taso'];

    let roomCount = 0;
    for (let i = 0; i < 50; i++) {
        try {
            const roomId = await contract.allRoomIds(i);
            const room = await contract.rooms(roomId);
            roomCount++;

            console.log(`\nRoom #${i}:`);
            console.log(`  ID: ${roomId}`);
            console.log(`  Player1: ${room.player1}`);
            console.log(`  Player2: ${room.player2 === "0x0000000000000000000000000000000000000000" ? "None" : room.player2}`);
            console.log(`  Stake: $${Number(room.stake) / 1_000_000} USDC`);
            console.log(`  Status: ${statusNames[room.status]} (${room.status})`);
            console.log(`  GameMode: ${gameNames[room.gameMode]}`);

        } catch (e) {
            break;
        }
    }

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`Total rooms found: ${roomCount}`);
    console.log("═══════════════════════════════════════════════════════");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
