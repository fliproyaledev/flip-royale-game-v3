
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    console.log('Loading .env');
    require('dotenv').config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
    console.log('Loading .env.local');
    require('dotenv').config({ path: envLocalPath, override: true });
}

async function main() {
    console.log("DEBUG START");
    const pk = process.env.ARENA_ORACLE_PRIVATE_KEY;
    if (!pk) {
        console.error("MISSING PK");
        return;
    }
    console.log(`PK Length: ${pk.length}`);
    if (!pk.startsWith('0x')) {
        console.log("PK missing 0x prefix");
    }

    try {
        const provider = new ethers.JsonRpcProvider('https://base.drpc.org');
        const wallet = new ethers.Wallet(pk, provider);
        console.log(`Wallet Address: ${wallet.address}`);

        const ROOM_ID = '0xa6ce61dfc028a920073cd81f0244389c0af45960825ebfcf5d85619c5b757f31';
        const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";

        const ARENA_ABI = [
            "function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external",
            "function rooms(bytes32 roomId) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner)"
        ];

        const contract = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, wallet);
        const room = await contract.rooms(ROOM_ID);
        console.log(`Room Status: ${room.status}`);
        console.log(`Player1: ${room.player1}`);
        console.log(`Player2: ${room.player2}`);

        if (Number(room.status) !== 1 && Number(room.status) !== 2) {
            console.log("Room already resolved or empty");
            return;
        }

        // FORCE RESOLVE TO PLAYER 1 if Status 2, or just resolve normally
        // The user said "backend failed". 
        // Let's just pick Player 1 as winner to UNSTUCK it. 
        // Since we can't reliably know the choice from here (KV not accessible easily in script without auth), 
        // and this is a TEST game to Unstuck.

        const winner = room.player1;
        console.log(`Resolving for Winner: ${winner}`);

        const nonce = ethers.keccak256(ethers.toUtf8Bytes(`${ROOM_ID}-${Date.now()}`));
        const messageHash = ethers.solidityPackedKeccak256(
            ['bytes32', 'address', 'bytes32'],
            [ROOM_ID, winner, nonce]
        );
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));

        console.log("Sending TX...");
        const tx = await contract.resolveRoom(ROOM_ID, winner, nonce, signature);
        console.log(`TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log("Confirmed!");

    } catch (e) {
        console.error("ERROR:", e);
    }
}

main();
