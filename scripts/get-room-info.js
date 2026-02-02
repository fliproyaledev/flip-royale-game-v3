// scripts/get-room-info.js
// Script to get all room IDs and details from V1 Arena contract

const hre = require("hardhat");

const V1_CONTRACT = "0x83E316B9aa8F675b028279f089179bA26792242B";

const V1_ABI = [
    "function allRoomIds(uint256 index) view returns (bytes32)",
    "function rooms(bytes32) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)",
    "function owner() view returns (address)"
];

async function main() {
    const provider = new hre.ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
    const contract = new hre.ethers.Contract(V1_CONTRACT, V1_ABI, provider);

    console.log("═══════════════════════════════════════════════════════");
    console.log("FlipRoyaleArena V1 - Room Info");
    console.log("═══════════════════════════════════════════════════════");
    console.log("Contract:", V1_CONTRACT);

    try {
        const owner = await contract.owner();
        console.log("Owner:", owner);
    } catch (e) {
        console.log("Owner: Could not fetch");
    }

    console.log("\n📋 All Rooms:\n");

    const statusNames = ['Open', 'Filled', 'Resolved', 'Draw', 'Cancelled'];
    const gameNames = ['Duel', 'Taso'];

    for (let i = 0; i < 20; i++) {
        try {
            const roomId = await contract.allRoomIds(i);
            const room = await contract.rooms(roomId);

            console.log(`Room #${i}:`);
            console.log(`  Full ID: ${roomId}`);
            console.log(`  Player1: ${room.player1}`);
            console.log(`  Player2: ${room.player2 === "0x0000000000000000000000000000000000000000" ? "None" : room.player2}`);
            console.log(`  Stake: $${Number(room.stake) / 1_000_000} USDC`);
            console.log(`  Status: ${statusNames[room.status]} (${room.status})`);
            console.log(`  GameMode: ${gameNames[room.gameMode]}`);
            console.log("");

            if (room.status === 0n || room.status === 1n) {
                console.log("  ⚠️  THIS ROOM HAS STUCK FUNDS!");
                console.log(`  💰 To cancel: cancelRoom("${roomId}")`);
                console.log("");
            }
        } catch (e) {
            // No more rooms
            if (i === 0) {
                console.log("No rooms found or error fetching rooms");
            }
            break;
        }
    }

    console.log("═══════════════════════════════════════════════════════");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
