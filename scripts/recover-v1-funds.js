// scripts/recover-v1-funds.js
// Script to help recover stuck USDC from V1 Arena contract
// 
// V1 Contract: 0x83E316B9aa8F675b028279f089179bA26792242B
// Problem: No cancelRoom function for Open rooms
//
// Solution: Since you're the owner, you have 2 options:
//
// OPTION 1: If room is "Filled" (has 2 players)
//   - Use resolveRoomDraw with oracle signature
//
// OPTION 2: If room is "Open" (only 1 player)
//   - V1 has no way to cancel open rooms!
//   - You need to send USDC manually from treasury OR
//   - Deploy upgrade proxy with cancel function
//
// This script will:
// 1. Check the stuck room status
// 2. If Filled, create draw signature for refund
// 3. If Open, show how to manually refund

const hre = require("hardhat");
const { ethers } = hre;

const V1_CONTRACT = "0x83E316B9aa8F675b028279f089179bA26792242B";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY; // Add to .env!

const V1_ABI = [
    "function rooms(bytes32) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)",
    "function allRoomIds(uint256) view returns (bytes32)",
    "function allRoomIds() view returns (bytes32[])",
    "function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes signature) external"
];

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("═══════════════════════════════════════════════════════");
    console.log("V1 Arena - Stuck Funds Recovery");
    console.log("═══════════════════════════════════════════════════════");

    const contract = new ethers.Contract(V1_CONTRACT, V1_ABI, signer);

    // Get all room IDs
    console.log("\nFetching all rooms...");

    let roomIds;
    try {
        roomIds = await contract.allRoomIds();
        console.log(`Found ${roomIds.length} total rooms`);
    } catch (e) {
        // Try fetching one by one if array method fails
        console.log("Fetching rooms individually...");
        roomIds = [];
        for (let i = 0; i < 100; i++) {
            try {
                const id = await contract.allRoomIds(i);
                roomIds.push(id);
            } catch {
                break;
            }
        }
        console.log(`Found ${roomIds.length} rooms`);
    }

    // Check each room
    const stuckRooms = [];
    for (const roomId of roomIds) {
        const room = await contract.rooms(roomId);
        // Status: 0=Open, 1=Filled, 2=Resolved, 3=Draw, 4=Cancelled
        if (room.status < 2) {
            stuckRooms.push({
                id: roomId,
                player1: room.player1,
                player2: room.player2,
                stake: ethers.formatUnits(room.stake, 6),
                status: room.status,
                statusName: room.status === 0 ? "Open" : "Filled"
            });
        }
    }

    console.log(`\n🚨 Found ${stuckRooms.length} stuck rooms:\n`);

    for (const room of stuckRooms) {
        console.log(`Room: ${room.id.slice(0, 16)}...`);
        console.log(`  Status: ${room.statusName} (${room.status})`);
        console.log(`  Player1: ${room.player1}`);
        console.log(`  Player2: ${room.player2 || 'None'}`);
        console.log(`  Stake: $${room.stake} USDC`);

        if (room.status === 1) {
            console.log(`  ✅ Can refund via resolveRoomDraw`);
        } else {
            console.log(`  ❌ CANNOT refund - room is Open, no cancel function!`);
            console.log(`  💡 Manual refund: Send $${room.stake} USDC to ${room.player1}`);
        }
        console.log("");
    }

    // If there are Filled rooms and we have oracle key, create signatures
    if (ORACLE_PRIVATE_KEY) {
        const filledRooms = stuckRooms.filter(r => r.status === 1);
        if (filledRooms.length > 0) {
            console.log("═══════════════════════════════════════════════════════");
            console.log("Creating draw signatures for Filled rooms...");
            console.log("═══════════════════════════════════════════════════════");

            const oracleWallet = new ethers.Wallet(ORACLE_PRIVATE_KEY);

            for (const room of filledRooms) {
                const nonce = ethers.keccak256(ethers.toUtf8Bytes(`draw-${room.id}-${Date.now()}`));
                const messageHash = ethers.keccak256(
                    ethers.solidityPacked(
                        ["bytes32", "address", "bytes32"],
                        [room.id, ethers.ZeroAddress, nonce]
                    )
                );
                const signature = await oracleWallet.signMessage(ethers.getBytes(messageHash));

                console.log(`\nRoom: ${room.id}`);
                console.log(`Nonce: ${nonce}`);
                console.log(`Signature: ${signature}`);
                console.log(`\nCall: resolveRoomDraw("${room.id}", "${nonce}", "${signature}")`);
            }
        }
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("Summary:");
    console.log("═══════════════════════════════════════════════════════");
    const openRooms = stuckRooms.filter(r => r.status === 0);
    const filledRooms = stuckRooms.filter(r => r.status === 1);
    console.log(`Open rooms (needs manual refund): ${openRooms.length}`);
    console.log(`Filled rooms (can use resolveRoomDraw): ${filledRooms.length}`);

    if (openRooms.length > 0) {
        const totalStuck = openRooms.reduce((sum, r) => sum + parseFloat(r.stake), 0);
        console.log(`\n💰 Total USDC stuck in Open rooms: $${totalStuck}`);
        console.log("To refund: Send USDC manually from treasury to each player1");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
