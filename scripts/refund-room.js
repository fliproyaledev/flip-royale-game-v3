const ethers = require('ethers');
require('dotenv').config({ path: '.env' });

const PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

// Room ID found from scan
const ROOM_ID = "0xb80e861644cb6d9d14bb986fcd8e2e1ffbe6322a61a8599e147b0c05c8763cc8";

const ABI = [
    "function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external"
];

async function main() {
    console.log(`Refunding Room: ${ROOM_ID}`);
    console.log(`Contract: ${CONTRACT_ADDRESS}`);

    if (!PRIVATE_KEY) {
        console.error("Missing ARENA_ORACLE_PRIVATE_KEY");
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    // Generate Nonce
    const nonce = ethers.keccak256(ethers.toUtf8Bytes(`${ROOM_ID}-${Date.now()}-${Math.random()}`));

    // Sign Message for Draw (Winner = address(0))
    const winnerAddress = ethers.ZeroAddress;

    // Keccak256(roomId, winner, nonce)
    // Note: Solidity uses abi.encodePacked, so we use solidityPackedKeccak256
    const messageHash = ethers.solidityPackedKeccak256(
        ['bytes32', 'address', 'bytes32'],
        [ROOM_ID, winnerAddress, nonce]
    );

    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    console.log('Sending Refund Transaction...');
    // console.log('Nonce:', nonce);
    // console.log('Signature:', signature);

    try {
        const tx = await contract.resolveRoomDraw(ROOM_ID, nonce, signature);
        console.log(`Tx Sent: ${tx.hash}`);
        console.log('Waiting for confirmation...');
        await tx.wait();
        console.log('✅ Room Refunded Successfully!');
    } catch (err) {
        console.error('Refund Failed:', err.shortMessage || err.message);
    }
}

main();
