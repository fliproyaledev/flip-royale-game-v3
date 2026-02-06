const ethers = require('ethers');
require('dotenv').config({ path: '.env' });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const ABI = [
    "function allRoomIds(uint256) view returns (bytes32)",
    "function rooms(bytes32) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt)",
    "function getTotalRoomsCount() view returns (uint256)"
];

const STATUS_MAP = ['Open', 'Filled', 'Resolved', 'Draw', 'Cancelled'];
const MODE_MAP = ['Duel', 'Taso'];

async function main() {
    console.log("Listing ALL Open/Filled rooms...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        const count = await contract.getTotalRoomsCount();
        console.log(`Total rooms: ${count}`);

        // Scan ALL rooms just in case status decoding is weird
        for (let i = 0; i < count; i++) {
            try {
                const roomId = await contract.allRoomIds(i);
                const room = await contract.rooms(roomId);

                if (Number(room.status) <= 1) { // Open or Filled
                    console.log(`\n--- Active Room ---`);
                    console.log(`ID: ${roomId}`);
                    console.log(`Type: ${MODE_MAP[room.gameMode]}`);
                    console.log(`Status: ${STATUS_MAP[Number(room.status)]}`);
                    console.log(`Stake: ${ethers.formatUnits(room.stake, 6)} USDC`);
                    console.log(`Created: ${new Date(Number(room.createdAt) * 1000).toLocaleString()}`);
                    console.log(`Creator: ${room.player1}`);
                }
            } catch (err) { }
        }
    } catch (err) {
        console.error(err);
    }
}

main();
