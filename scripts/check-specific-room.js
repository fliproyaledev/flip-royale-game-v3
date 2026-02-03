// scripts/check-specific-room.js
// Check a specific room by ID

const hre = require("hardhat");

const V1_CONTRACT = "0x83E316B9aa8F675b028279f089179bA26792242B";
const ROOM_ID = "0xb6383df27edbdad1ec60a345d2e92ffed3ba05728669e13455e8a0cb5cb614d1";

const V1_ABI = [
    "function allRoomIds(uint256 index) view returns (bytes32)",
    "function rooms(bytes32) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)"
];

async function main() {
    const provider = new hre.ethers.JsonRpcProvider("https://mainnet.base.org");
    const contract = new hre.ethers.Contract(V1_CONTRACT, V1_ABI, provider);

    console.log("═══════════════════════════════════════════════════════");
    console.log("Checking Specific Room");
    console.log("═══════════════════════════════════════════════════════");
    console.log("Room ID:", ROOM_ID);

    try {
        const room = await contract.rooms(ROOM_ID);
        console.log("\n📋 Room Details:");
        console.log("  ID:", room.id);
        console.log("  Player1:", room.player1);
        console.log("  Player2:", room.player2);
        console.log("  Stake:", Number(room.stake) / 1_000_000, "USDC");
        console.log("  Tier:", room.tier);
        console.log("  GameMode:", room.gameMode);
        console.log("  Status:", room.status);
        console.log("  Winner:", room.winner);
    } catch (e) {
        console.log("Error fetching room:", e.message);
    }

    console.log("\n📋 All Room IDs in contract:");
    for (let i = 0; i < 10; i++) {
        try {
            const roomId = await contract.allRoomIds(i);
            console.log(`  [${i}]: ${roomId}`);
        } catch (e) {
            console.log("  Total rooms:", i);
            break;
        }
    }

    console.log("═══════════════════════════════════════════════════════");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
