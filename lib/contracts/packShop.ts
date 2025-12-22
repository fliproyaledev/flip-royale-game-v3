// lib/contracts/packShop.ts
// FlipRoyalePackShop kontrat entegrasyonu

export const PACK_SHOP_ADDRESS = "0x3C9937De4673c1Df48C1c4f9f1927b4b8cf40710";
export const VIRTUAL_TOKEN_ADDRESS = "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";

// Kontrat ABI (sadece kullanacağımız fonksiyonlar)
export const PACK_SHOP_ABI = [
    // Read functions
    {
        "inputs": [{ "type": "uint8", "name": "packType" }],
        "name": "getPackPrice",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "user" }],
        "name": "referrerOf",
        "outputs": [{ "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "user" }],
        "name": "packsPurchasedBy",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "address", "name": "user" }],
        "name": "totalEarnedByReferrer",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    // Write functions
    {
        "inputs": [{ "type": "address", "name": "referrer" }],
        "name": "setReferrer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "type": "uint8", "name": "packType" },
            { "type": "uint256", "name": "quantity" }
        ],
        "name": "buyPack",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "type": "uint8", "name": "packType" },
            { "type": "uint256", "name": "quantity" },
            { "type": "address", "name": "referrer" }
        ],
        "name": "buyPackWithReferrer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// ERC20 Token ABI (approve için)
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

// Pack types
export const PACK_TYPES = {
    COMMON: 0,
    RARE: 1
} as const;

// Helper: Wei to VIRTUAL
export function weiToVirtual(wei: bigint): number {
    return Number(wei) / 1e18;
}

// Helper: VIRTUAL to Wei
export function virtualToWei(amount: number): bigint {
    return BigInt(Math.floor(amount * 1e18));
}
