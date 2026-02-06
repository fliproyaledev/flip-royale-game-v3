const ethers = require('ethers');
require('dotenv').config({ path: '.env.local' });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

const ABI = [
    "function allRoomIds(uint256) view returns (bytes32)",
    "function rooms(bytes32) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt)",
    "function getTotalRoomsCount() view returns (uint256)"
];

const STATUS_MAP = ['Open', 'Filled', 'Resolved', 'Draw', 'Cancelled'];

async function main() {
    console.log("Searching for 0 stake rooms...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        const count = await contract.getTotalRoomsCount();
        console.log(`Total rooms: ${count}`);

        for (let i = Number(count) - 1; i >= 0; i--) {
            try {
                const roomId = await contract.allRoomIds(i);
                const room = await contract.rooms(roomId);

                // Check for 0 stake and Open status
                if (Number(room.stake) === 0 && Number(room.status) === 0) {
                    console.log(`\n--- Found 0 Stake Room ---`);
                    console.log(`ID: ${roomId}`);
                    console.log(`Creator: ${room.player1}`);
                    console.log(`Status: ${STATUS_MAP[Number(room.status)]}`);
                    console.log(`Created: ${new Date(Number(room.createdAt) * 1000).toLocaleString()}`);
                }
            } catch (err) {
                // ignore
            }
        }
    } catch (err) {
        console.error(err);
    }
}

main();
