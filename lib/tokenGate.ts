// lib/tokenGate.ts
// Token Gate system for $FLIP holding requirement

const FLIP_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_FLIP_TOKEN_ADDRESS || ''
const FLIP_PAIR_ADDRESS = process.env.NEXT_PUBLIC_FLIP_PAIR_ADDRESS || ''
const MIN_USD_VALUE = parseFloat(process.env.NEXT_PUBLIC_TOKEN_GATE_MIN_USD || '100')
const MIN_TOKEN_COUNT = parseFloat(process.env.NEXT_PUBLIC_TOKEN_GATE_MIN_TOKENS || '250000')

// ERC20 ABI for balanceOf
export const ERC20_BALANCE_ABI = [
    {
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function',
    },
] as const

/**
 * Check if token gate is enabled
 * Gate is DISABLED when token address is empty or placeholder
 */
export function isTokenGateEnabled(): boolean {
    if (!FLIP_TOKEN_ADDRESS) return false
    if (FLIP_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000') return false
    if (FLIP_TOKEN_ADDRESS.toLowerCase().includes('placeholder')) return false
    if (FLIP_TOKEN_ADDRESS.length !== 42) return false
    return true
}

/**
 * Get $FLIP token address
 */
export function getFlipTokenAddress(): string {
    return FLIP_TOKEN_ADDRESS
}

/**
 * Get minimum USD value required
 */
export function getMinUsdRequired(): number {
    return MIN_USD_VALUE
}

/**
 * Get minimum token count required
 */
export function getMinTokenRequired(): number {
    return MIN_TOKEN_COUNT
}

/**
 * Fetch $FLIP price from DexScreener
 * Returns price in USD
 */
export async function getFlipPrice(): Promise<number> {
    if (!FLIP_PAIR_ADDRESS) return 0

    try {
        // DexScreener API for pair data
        const response = await fetch(
            `https://api.dexscreener.com/latest/dex/pairs/base/${FLIP_PAIR_ADDRESS}`,
            { next: { revalidate: 60 } } // Cache for 60 seconds
        )

        if (!response.ok) {
            console.error('[TokenGate] DexScreener API error:', response.status)
            return 0
        }

        const data = await response.json()

        if (data.pair && data.pair.priceUsd) {
            return parseFloat(data.pair.priceUsd)
        }

        // Alternative: try pairs array
        if (data.pairs && data.pairs.length > 0 && data.pairs[0].priceUsd) {
            return parseFloat(data.pairs[0].priceUsd)
        }

        return 0
    } catch (error) {
        console.error('[TokenGate] Failed to fetch FLIP price:', error)
        return 0
    }
}

/**
 * Calculate USD value of token balance
 */
export function calculateUsdValue(balance: bigint, decimals: number, price: number): number {
    const balanceNumber = Number(balance) / Math.pow(10, decimals)
    return balanceNumber * price
}

/**
 * Token gate check result type
 */
export type TokenGateResult = {
    enabled: boolean       // Is token gate active?
    allowed: boolean       // Does user meet requirement?
    balance: number        // User's $FLIP balance
    usdValue: number       // USD value of balance
    minRequired: number    // Minimum USD required (legacy)
    minTokenRequired: number // Minimum token count required
    tokenPrice: number     // Current $FLIP price
    tokenAddress: string   // $FLIP token address
}

/**
 * Default result when gate is disabled
 */
export function getDisabledGateResult(): TokenGateResult {
    return {
        enabled: false,
        allowed: true,
        balance: 0,
        usdValue: 0,
        minRequired: MIN_USD_VALUE,
        minTokenRequired: MIN_TOKEN_COUNT,
        tokenPrice: 0,
        tokenAddress: ''
    }
}
