const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env' });

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT;
const RPC_URL = 'https://base.drpc.org';

const ARENA_ABI = [
    "function rooms(bytes32 roomId) view returns (bytes32 id, address player1, address player2, uint256 stake, uint8 tier, uint8 gameMode, uint8 status, address winner, uint256 createdAt, uint256 resolvedAt)"
];

async function main() {
    const roomId = process.argv[2];
    if (!roomId) {
        console.error("Please provide room ID");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, provider);

    console.log(`Checking Room: ${roomId}`);
    const room = await contract.rooms(roomId);

    console.log(`Status: ${room.status}`);
    console.log(`Player1: ${room.player1}`);
    console.log(`Player2: ${room.player2}`);
    console.log(`Stake: ${ethers.formatUnits(room.stake, 6)} USDC`);
    console.log(`Winner: ${room.winner}`);
}

main();
