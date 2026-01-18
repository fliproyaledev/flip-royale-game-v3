// lib/contracts/packShopV2.ts
// FlipRoyalePackShopV2 kontrat entegrasyonu - $FLIP token ile 5 paket tipi

export const PACK_SHOP_V2_ADDRESS = process.env.NEXT_PUBLIC_PACK_SHOP_V2_CONTRACT || "0x1BA19f1A9DDcAFA1e0fCd4A4A919364cEE8Aa22e";
export const FLIP_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_FLIP_TOKEN_ADDRESS || "0xB8E4a7b56BDc2a2598C2011e61eF7669Ee3F589e";

// Pack Types
export const PACK_TYPES_V2 = {
    COMMON: 0,
    RARE: 1,
    UNICORN: 2,
    GENESIS: 3,
    SENTIENT: 4
} as const;

export type PackTypeV2 = 'common' | 'rare' | 'unicorn' | 'genesis' | 'sentient';

// Pack Prices (FLIP tokens)
export const PACK_PRICES_V2: Record<PackTypeV2, number> = {
    common: 50000,
    rare: 100000,
    unicorn: 50000,
    genesis: 50000,
    sentient: 50000
};

// Pack Info
export const PACK_INFO: Record<PackTypeV2, {
    id: number;
    name: string;
    description: string;
    image: string;
    cards: number;
    color: string;
    bgGradient: string;
}> = {
    common: {
        id: 0,
        name: 'Common Pack',
        description: '5 random cards from all types. A great way to start your collection!',
        image: '/common-pack.jpg',
        cards: 5,
        color: '#3b82f6',
        bgGradient: 'linear-gradient(180deg, #1e3a5f, #0f172a)'
    },
    rare: {
        id: 1,
        name: 'Rare Pack',
        description: '5 random cards with higher chance of rare types!',
        image: '/rare-pack.jpg',
        cards: 5,
        color: '#8b5cf6',
        bgGradient: 'linear-gradient(180deg, #4c1d95, #1e1b4b)'
    },
    unicorn: {
        id: 2,
        name: 'Unicorn Pack',
        description: '5 random Unicorn cards. The most valuable card type!',
        image: '/unicorn-pack.png',
        cards: 5,
        color: '#fbbf24',
        bgGradient: 'linear-gradient(180deg, #78350f, #451a03)'
    },
    genesis: {
        id: 3,
        name: 'Genesis Pack',
        description: '5 random Genesis cards. Original collection cards!',
        image: '/genesis-pack.png',
        cards: 5,
        color: '#a855f7',
        bgGradient: 'linear-gradient(180deg, #581c87, #3b0764)'
    },
    sentient: {
        id: 4,
        name: 'Sentient Pack',
        description: '5 random Sentient cards. AI-powered collection!',
        image: '/sentient-pack.png',
        cards: 5,
        color: '#06b6d4',
        bgGradient: 'linear-gradient(180deg, #164e63, #0c4a6e)'
    }
};

// Kontrat ABI
export const PACK_SHOP_V2_ABI = [
    // Read functions
    {
        "inputs": [{ "type": "uint8", "name": "packType" }],
        "name": "getPackPrice",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllPackPrices",
        "outputs": [
            { "type": "uint256", "name": "common" },
            { "type": "uint256", "name": "rare" },
            { "type": "uint256", "name": "unicorn" },
            { "type": "uint256", "name": "genesis" },
            { "type": "uint256", "name": "sentient" }
        ],
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
        "name": "getReferralInfo",
        "outputs": [
            { "type": "address", "name": "referrer" },
            { "type": "uint256", "name": "packsPurchased" },
            { "type": "uint256", "name": "totalEarned" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalSales",
        "outputs": [
            { "type": "uint256", "name": "common" },
            { "type": "uint256", "name": "rare" },
            { "type": "uint256", "name": "unicorn" },
            { "type": "uint256", "name": "genesis" },
            { "type": "uint256", "name": "sentient" }
        ],
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

// ERC20 ABI (FLIP token için)
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
export function formatFlipAmount(amount: number): string {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toString();
}

export function flipToWei(amount: number): bigint {
    return BigInt(amount) * BigInt(10 ** 18);
}

export function weiToFlip(wei: bigint): number {
    return Number(wei) / 1e18;
}
