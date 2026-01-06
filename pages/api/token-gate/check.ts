// pages/api/token-gate/check.ts
// API endpoint to check if user meets token gate requirement

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPublicClient, http, formatUnits, defineChain } from 'viem'
import {
    isTokenGateEnabled,
    getFlipPrice,
    getFlipTokenAddress,
    getMinUsdRequired,
    getDisabledGateResult,
    ERC20_BALANCE_ABI,
    TokenGateResult
} from '../../../lib/tokenGate'

// Cache for price (60 seconds)
let priceCache: { price: number; timestamp: number } | null = null
const CACHE_DURATION = 60 * 1000 // 60 seconds

async function getCachedPrice(): Promise<number> {
    const now = Date.now()
    if (priceCache && (now - priceCache.timestamp) < CACHE_DURATION) {
        return priceCache.price
    }

    const price = await getFlipPrice()
    priceCache = { price, timestamp: now }
    return price
}

// Define Base chain
const base = defineChain({
    id: 8453,
    name: 'Base',
    network: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://mainnet.base.org'] },
        public: { http: ['https://mainnet.base.org'] },
    },
    blockExplorers: {
        default: { name: 'BaseScan', url: 'https://basescan.org' },
    },
})

// Create viem client for Base
const client = createPublicClient({
    chain: base,
    transport: http()
})

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TokenGateResult | { error: string }>
) {
    // Only GET allowed
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Check if gate is enabled
    if (!isTokenGateEnabled()) {
        return res.status(200).json(getDisabledGateResult())
    }

    const { address } = req.query

    if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: 'Wallet address required' })
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid wallet address format' })
    }

    try {
        const tokenAddress = getFlipTokenAddress()
        const minRequired = getMinUsdRequired()

        // Fetch balance
        const balance = await client.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`]
        })

        // Fetch price (cached)
        const tokenPrice = await getCachedPrice()

        // Calculate USD value (assuming 18 decimals)
        const balanceNumber = parseFloat(formatUnits(balance as bigint, 18))
        const usdValue = balanceNumber * tokenPrice

        // Check if meets requirement
        const allowed = usdValue >= minRequired

        const result: TokenGateResult = {
            enabled: true,
            allowed,
            balance: balanceNumber,
            usdValue,
            minRequired,
            tokenPrice,
            tokenAddress
        }

        return res.status(200).json(result)
    } catch (error) {
        console.error('[TokenGate] Error checking gate:', error)

        // On error, allow access (fail-open for better UX)
        return res.status(200).json({
            enabled: true,
            allowed: true, // Fail-open
            balance: 0,
            usdValue: 0,
            minRequired: getMinUsdRequired(),
            tokenPrice: 0,
            tokenAddress: getFlipTokenAddress()
        })
    }
}
