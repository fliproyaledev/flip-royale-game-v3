const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

const ARENA_ABI = [
    "function getUserRooms(address user) external view returns (bytes32[])",
    "function rooms(bytes32 id) external view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)"
];

const ARENA_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";
const USER_ADDRESS = "0xbe94fBD02dbfe3695fACEa5101e3B83991dD7911"; // Admin wallet from env as test user

async function main() {
    console.log(`Checking Arena Contract at: ${ARENA_ADDRESS}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ARENA_ADDRESS, ARENA_ABI, provider);

    try {
        console.log(`Fetching rooms for user: ${USER_ADDRESS}`);
        const roomIds = await contract.getUserRooms(USER_ADDRESS);
        console.log(`Found ${roomIds.length} rooms.`);

        if (roomIds.length > 0) {
            // Check last 3 rooms
            const lastFew = roomIds.slice(-3);
            for (let id of lastFew) {
                console.log(`Checking room: ${id}`);
                const room = await contract.rooms(id);
                console.log(`ID: ${id}, Status: ${Number(room.status)} (${getStatusName(Number(room.status))}), Winner: ${room.winner}`);
            }
        }

    } catch (error) {
        console.error("Error fetching arena data:", error);
    }
}

function getStatusName(s) {
    return ['Open', 'Filled', 'Resolved', 'Draw', 'Cancelled'][s] || 'Unknown';
}

main();
