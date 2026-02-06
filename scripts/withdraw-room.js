const ethers = require('ethers');
require('dotenv').config({ path: '.env' });

const PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

// Room ID found
const ROOM_ID = "0x9a5086d6cb24b274ea87313f191069495d868d477b7c0bc48aa34eca121ec2e4";

const ABI = [
    "function emergencyWithdrawRoom(bytes32 roomId) external"
];

async function main() {
    console.log(`Withdrawing Room (Emergency): ${ROOM_ID}`);
    console.log(`Contract: ${CONTRACT_ADDRESS}`);

    if (!PRIVATE_KEY) {
        console.error("Missing ARENA_ORACLE_PRIVATE_KEY");
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    try {
        console.log('Sending Emergency Withdraw Transaction...');
        const tx = await contract.emergencyWithdrawRoom(ROOM_ID);
        console.log(`Tx Sent: ${tx.hash}`);
        console.log('Waiting for confirmation...');
        await tx.wait();
        console.log('✅ Room Withdrawn/Cancelled Successfully!');
    } catch (err) {
        console.error('Withdraw Failed:', err.shortMessage || err.message);
    }
}

main();
