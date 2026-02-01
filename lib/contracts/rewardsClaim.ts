// lib/contracts/rewardsClaim.ts
// FlipRoyaleRewardsClaim contract integration

// Contract will be deployed - placeholder for now
export const REWARDS_CLAIM_ADDRESS = process.env.NEXT_PUBLIC_REWARDS_CLAIM_CONTRACT || "0x773e5a48D29F87238688Acd34dC1522416908CF0";
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ABI for rewards claim contract
export const REWARDS_CLAIM_ABI = [
    {
        "inputs": [
            { "type": "uint256", "name": "amount" },
            { "type": "uint256", "name": "nonce" },
            { "type": "bytes", "name": "signature" }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "user" }],
        "name": "getNonce",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "user" }],
        "name": "totalClaimed",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getContractBalance",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    // Events
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "type": "address", "name": "user" },
            { "indexed": false, "type": "uint256", "name": "amount" },
            { "indexed": false, "type": "uint256", "name": "nonce" }
        ],
        "name": "Claimed",
        "type": "event"
    }
] as const;

// Helper functions
export function formatUSDC(amount: number): string {
    return `$${(amount / 1_000_000).toFixed(2)}`;
}

export function usdcToWei(amount: number): bigint {
    return BigInt(Math.floor(amount * 1_000_000));
}
