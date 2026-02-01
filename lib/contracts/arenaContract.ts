// lib/contracts/arenaContract.ts
// FlipRoyaleArena USDC contract integration

// Contract addresses (Base Mainnet)
export const ARENA_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARENA_CONTRACT || "0x83E316B9aa8F675b028279f089179bA26792242B";
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Tier definitions - USDC (6 decimals)
export type ArenaTier = 0 | 1 | 2 | 3;

export const TIER_INFO: Record<ArenaTier, { name: string; stake: number; stakeFormatted: string; color: string }> = {
    0: { name: 'Bronze', stake: 10_000_000, stakeFormatted: '$10', color: '#cd7f32' },
    1: { name: 'Silver', stake: 25_000_000, stakeFormatted: '$25', color: '#c0c0c0' },
    2: { name: 'Gold', stake: 50_000_000, stakeFormatted: '$50', color: '#ffd700' },
    3: { name: 'Diamond', stake: 100_000_000, stakeFormatted: '$100', color: '#b9f2ff' },
};

// Game modes
export enum GameMode {
    Duel = 0,
    Taso = 1
}

// Room status
export enum RoomStatus {
    Open = 0,
    Filled = 1,
    Resolved = 2,
    Draw = 3,
    Cancelled = 4
}

// Arena Contract ABI (minimal for frontend)
export const ARENA_ABI = [
    // Read functions
    {
        "inputs": [{ "type": "bytes32", "name": "roomId" }],
        "name": "rooms",
        "outputs": [
            { "type": "bytes32", "name": "id" },
            { "type": "address", "name": "player1" },
            { "type": "address", "name": "player2" },
            { "type": "uint256", "name": "stake" },
            { "type": "uint8", "name": "tier" },
            { "type": "uint8", "name": "gameMode" },
            { "type": "uint8", "name": "status" },
            { "type": "address", "name": "winner" },
            { "type": "uint256", "name": "createdAt" },
            { "type": "uint256", "name": "resolvedAt" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "allRoomIds",
        "outputs": [{ "type": "bytes32[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "uint256", "name": "index" }],
        "name": "allRoomIds",
        "outputs": [{ "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "user" }],
        "name": "userRooms",
        "outputs": [{ "type": "bytes32[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "uint8", "name": "tier" }],
        "name": "getTierStake",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "uint8", "name": "gameMode" }],
        "name": "getOpenRooms",
        "outputs": [{ "type": "bytes32[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    // Write functions
    {
        "inputs": [
            { "type": "uint8", "name": "tier" },
            { "type": "uint8", "name": "gameMode" }
        ],
        "name": "createRoom",
        "outputs": [{ "type": "bytes32" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "type": "bytes32", "name": "roomId" }],
        "name": "joinRoom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "type": "bytes32", "name": "roomId" }],
        "name": "cancelRoom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // Events
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "type": "bytes32", "name": "roomId" },
            { "indexed": true, "type": "address", "name": "player1" },
            { "indexed": false, "type": "uint8", "name": "tier" },
            { "indexed": false, "type": "uint8", "name": "gameMode" },
            { "indexed": false, "type": "uint256", "name": "stake" }
        ],
        "name": "RoomCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "type": "bytes32", "name": "roomId" },
            { "indexed": true, "type": "address", "name": "player2" }
        ],
        "name": "RoomJoined",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "type": "bytes32", "name": "roomId" },
            { "indexed": true, "type": "address", "name": "winner" },
            { "indexed": false, "type": "uint256", "name": "payout" },
            { "indexed": false, "type": "uint256", "name": "teamFee" },
            { "indexed": false, "type": "uint256", "name": "replyCorpFee" }
        ],
        "name": "RoomResolved",
        "type": "event"
    }
] as const;

// ERC20 ABI for USDC approval
export const ERC20_ABI = [
    {
        "inputs": [
            { "type": "address", "name": "spender" },
            { "type": "uint256", "name": "amount" }
        ],
        "name": "approve",
        "outputs": [{ "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "type": "address", "name": "owner" },
            { "type": "address", "name": "spender" }
        ],
        "name": "allowance",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "account" }],
        "name": "balanceOf",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

// Helpers
export function formatUSDC(amount: number): string {
    return `$${(amount / 1_000_000).toFixed(0)}`;
}

export function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Room interface for frontend
export interface ArenaRoom {
    id: string; // bytes32 as hex
    player1: string;
    player2: string;
    stake: bigint;
    tier: ArenaTier;
    gameMode: GameMode;
    status: RoomStatus;
    winner: string;
    createdAt: bigint;
    resolvedAt: bigint;
}
