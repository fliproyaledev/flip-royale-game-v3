const { ethers } = require("ethers");
require('dotenv').config({ path: '.env.local' });

const ARENA_ABI = [
    "function getUserRooms(address user) external view returns (bytes32[])",
    "function rooms(bytes32 id) external view returns (uint8 tier, uint8 gameMode, address player1, uint256 stake, address winner, uint8 status)"
];

const ARENA_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT_ADDRESS || "0x25239a5B2F7C203dEceEe4F5a79E0C177F876939"; // Default from known context if env missing
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
            const latestInfo = roomIds[roomIds.length - 1];
            console.log(`Checking latest room: ${latestInfo}`);
            const room = await contract.rooms(latestInfo);
            console.log("Room Data:", room);
            console.log("Status:", Number(room.status));
            // 0=Open, 1=Filled, 2=Resolved, 3=Draw, 4=Cancelled
        }

    } catch (error) {
        console.error("Error fetching arena data:", error);
    }
}

main();
