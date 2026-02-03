// scripts/resolve-room.js
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
if (fs.existsSync(envLocalPath)) require('dotenv').config({ path: envLocalPath, override: true });

// Config
const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const ORACLE_PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base.drpc.org';
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!ORACLE_PRIVATE_KEY) {
    console.error("❌ Mising ARENA_ORACLE_PRIVATE_KEY in .env");
    process.exit(1);
}

const ROOM_ID = process.argv[2];
const FORCE_DRAW = process.argv.includes('--draw');

if (!ROOM_ID) {
    console.error("Usage: node scripts/resolve-room.js <ROOM_ID> [--draw]");
    process.exit(1);
}

const ARENA_ABI = [
    "function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external",
    "function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external",
    "function rooms(bytes32 roomId) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner)"
];

async function main() {
    console.log(`🔌 Connecting to RPC...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, wallet);

    console.log(`🔍 Checking Room: ${ROOM_ID}`);
    const room = await contract.rooms(ROOM_ID);
    console.log(`   Players: ${room.player1} vs ${room.player2}`);
    console.log(`   Status: ${room.status}`);

    if (Number(room.status) !== 1 && Number(room.status) !== 2) {
        console.error("❌ Room is not active (Status must be 1 or 2)");
        return;
    }

    let isDraw = FORCE_DRAW;
    let winner = ethers.ZeroAddress;

    if (!isDraw) {
        // Try fetch choices
        const getKV = async (key) => {
            try {
                const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
                const data = await res.json();
                return data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : null;
            } catch (e) { return null; }
        };

        const p1Choice = await getKV(`arena:choice:${ROOM_ID}:${room.player1.toLowerCase()}`);
        const p2Choice = await getKV(`arena:choice:${ROOM_ID}:${room.player2.toLowerCase()}`);

        console.log(`   P1 Choice: ${p1Choice?.choice || 'MISSING'}`);
        console.log(`   P2 Choice: ${p2Choice?.choice || 'MISSING'}`);

        if (!p1Choice || !p2Choice) {
            console.warn("⚠️  Choices missing! Cannot determine winner.");
            console.log("👉 Use --draw to force a refund.");
            return;
        }

        // Simulate Flip
        const flip = Math.random() < 0.5 ? 'front' : 'back';
        console.log(`🎲 Simulated Flip Result: ${flip.toUpperCase()}`);

        const p1Win = p1Choice.choice === flip;
        const p2Win = p2Choice.choice === flip;

        if (p1Win && !p2Win) {
            winner = room.player1;
            console.log(`🏆 Winner: Player 1 (${winner})`);
        } else if (p2Win && !p1Win) {
            winner = room.player2;
            console.log(`🏆 Winner: Player 2 (${winner})`);
        } else {
            isDraw = true;
            console.log(`🤝 Draw! (Both ${p1Win ? 'won' : 'lost'})`);
        }
    } else {
        console.log("⚠️  Forcing Draw (Refund)...");
    }

    // Prepare TX
    const nonce = ethers.keccak256(ethers.toUtf8Bytes(`${ROOM_ID}-${Date.now()}`));

    // Sign
    console.log("✍️  Signing message...");
    const messageHash = ethers.solidityPackedKeccak256(
        ['bytes32', 'address', 'bytes32'],
        [ROOM_ID, isDraw ? ethers.ZeroAddress : winner, nonce]
    );
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    // Submit
    console.log("🚀 Sending transaction...");
    let tx;
    if (isDraw) {
        tx = await contract.resolveRoomDraw(ROOM_ID, nonce, signature);
    } else {
        tx = await contract.resolveRoom(ROOM_ID, winner, nonce, signature);
    }

    console.log(`✅ TX Sent: ${tx.hash}`);
    await tx.wait();
    console.log("🎉 Room Resolved!");
}

main();
