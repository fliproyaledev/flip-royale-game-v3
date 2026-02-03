// scripts/find-stuck-rooms.js
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Try loading .env.local, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
    // console.log('Loaded .env.local');
} else if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    // console.log('Loaded .env');
} else {
    console.warn('⚠️ No .env file found');
}

// Config
const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const ARENA_ABI = [
    "function allRoomIds(uint256 index) view returns (bytes32)",
    "function rooms(bytes32 roomId) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)"
];

async function main() {
    console.log(`🔌 Connecting to RPC: ${RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const net = await provider.getNetwork();
        console.log(`✅ Connected to network: ${net.name} (Chain ID: ${net.chainId})`);
    } catch (e) {
        console.error("❌ Failed to connect to RPC:", e.message);
        return;
    }

    const contract = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, provider);
    console.log("🔍 Scanning for stuck rooms on contract:", ARENA_CONTRACT);

    // Mock KV fetch request manually if sdk fails in script
    const getKV = async (key) => {
        try {
            const res = await fetch(`${KV_URL}/get/${key}`, {
                headers: { Authorization: `Bearer ${KV_TOKEN}` }
            });
            const data = await res.json();
            if (data.result) {
                return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    let index = 0;
    while (true) {
        try {
            const roomId = await contract.allRoomIds(index);
            console.log(`Checking Room [${index}]: ${roomId}`);

            const room = await contract.rooms(roomId);
            const status = Number(room.status); // 0=Open, 1=Joined, 2=InGame, 3=Resolved, 4=Cancelled
            console.log(`   Status: ${status}`);

            // User said they joined, so status likely 1 or 2
            if (status === 1 || status === 2) {
                console.log(`\n⚠️  FOUND ACTIVE ROOM: ${roomId}`);
                console.log(`   Players: ${room.player1} vs ${room.player2}`);
                console.log(`   Status: ${status} (1=Joined, 2=InGame)`);

                // Check KV for choices
                if (KV_URL) {
                    const p1Key = `arena:choice:${roomId}:${room.player1.toLowerCase()}`;
                    const p2Key = `arena:choice:${roomId}:${room.player2.toLowerCase()}`;

                    const p1Choice = await getKV(p1Key);
                    const p2Choice = await getKV(p2Key);

                    console.log(`   P1 Choice: ${p1Choice ? p1Choice.choice : 'MISSING'}`);
                    console.log(`   P2 Choice: ${p2Choice ? p2Choice.choice : 'MISSING'}`);

                    if (p1Choice && p2Choice) {
                        console.log("   ✅ READY TO RESOLVE! (Both choices present)");

                        // Suggest resolution command
                        const winner = p1Choice.choice === 'front' ? room.player1 : room.player2; // Simple logic placeholder, actual logic is random/oracle
                        console.log(`\n   To resolve, run:`);
                        console.log(`   node scripts/resolve-room.js ${roomId}`);
                    }
                }
            } else if (status === 0) {
                // console.log(`   Room ${roomId} is OPEN (Waiting for P2)`);
            } else if (status === 3) {
                // console.log(`   Room ${roomId} is RESOLVED`);
            }

            index++;
            if (index > 1000) break; // Safety break
        } catch (e) {
            console.error(`❌ Error scanning room at index ${index}:`, e.message);
            // Verify if it's end of array (revert) or network error
            // If revert, we are likely done.
            // If network error, we might want to retry or skip.

            // If it's index 2 error, we want to know details.
            if (index === 2) console.error(e);

            // Assuming loop done if we hit an error usually meant "end of array" in previous logic
            // But if allRoomIds succeeded and rooms failed, that's different.
            if (e.message.includes("allRoomIds")) break; // Stop if we can't get ID
            // Continue if just room fetch failed?
        }
        index++;
        if (index > 1000) break;
    }
    console.log("\nScan complete.");
}

main();
