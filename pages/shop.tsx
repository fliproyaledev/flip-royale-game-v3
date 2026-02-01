import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseUnits } from 'viem'
import ThemeToggle from '../components/ThemeToggle'
import Topbar from '../components/Topbar'
import { useTheme } from '../lib/theme'
import { useToast } from '../lib/toast'
import {
    PACK_SHOP_V2_ADDRESS,
    VIRTUAL_TOKEN_ADDRESS,
    PACK_SHOP_V2_ABI,
    ERC20_ABI,
    PACK_INFO,
    PACK_PRICES_V2,
    PackTypeV2,
    formatFlipAmount,
    flipToWei
} from '../lib/contracts/packShopV2'

const PACK_ORDER: PackTypeV2[] = ['common', 'rare', 'unicorn', 'genesis', 'sentient']

export default function ShopPage() {
    const { theme } = useTheme()
    const { toast } = useToast()
    const { address, isConnected } = useAccount()

    // Quantity state for each pack
    const [quantities, setQuantities] = useState<Record<PackTypeV2, number>>({
        common: 1, rare: 1, unicorn: 1, genesis: 1, sentient: 1
    })

    // Purchase state
    const [buyingPack, setBuyingPack] = useState<PackTypeV2 | null>(null)
    const [status, setStatus] = useState<'idle' | 'approving' | 'buying' | 'verifying'>('idle')

    // User data
    const [user, setUser] = useState<any>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('flipflop-user')
                return saved ? JSON.parse(saved) : null
            } catch { return null }
        }
        return null
    })

    // Fetch user data
    useEffect(() => {
        if (!address) return
        fetch(`/api/users/get-or-create?userId=${address.toLowerCase()}`)
            .then(r => r.json())
            .then(d => d.ok && setUser(d.user))
            .catch(() => { })
    }, [address])

    // Transaction hash states for wagmi 2.x
    const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>()
    const [buyHash, setBuyHash] = useState<`0x${string}` | undefined>()

    // Check FLIP allowance - wagmi 2.x API
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, PACK_SHOP_V2_ADDRESS as `0x${string}`],
        query: { enabled: Boolean(address) },
    })

    // Check FLIP balance - wagmi 2.x API
    const { data: balance } = useReadContract({
        address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
        query: { enabled: Boolean(address) },
    })

    // Write contract hook - wagmi 2.x API
    const { writeContractAsync } = useWriteContract()

    // Wait for approve transaction
    const { isLoading: approveLoading, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash,
    })

    // Refetch allowance when approve succeeds
    useEffect(() => {
        if (approveSuccess) {
            refetchAllowance()
        }
    }, [approveSuccess, refetchAllowance])

    // Wait for buy transaction
    const { isLoading: buyLoading, isSuccess: buySuccess } = useWaitForTransactionReceipt({
        hash: buyHash,
    })

    // Handle buy success
    useEffect(() => {
        const verifyPurchase = async () => {
            if (buySuccess && buyingPack && address && buyHash) {
                setStatus('verifying')
                try {
                    await fetch('/api/shop/verify-purchase', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: address.toLowerCase(),
                            txHash: buyHash,
                            packType: buyingPack,
                            count: quantities[buyingPack]
                        })
                    })
                    toast(`🎉 Purchased ${quantities[buyingPack]}x ${PACK_INFO[buyingPack].name}!`, 'success')
                } catch (e) {
                    console.error('Verify error:', e)
                }
                setStatus('idle')
                setBuyingPack(null)
                setBuyHash(undefined)
            }
        }
        verifyPurchase()
    }, [buySuccess, buyingPack, address, buyHash])

    // Handle buy
    const handleBuy = async (packType: PackTypeV2) => {
        if (!address || !isConnected) {
            toast('Please connect your wallet first', 'error')
            return
        }

        // Check if user is loaded, if not, try to use localStorage fallback for check
        let hasX = user?.xUserId;
        if (!hasX) {
            const stored = localStorage.getItem('flipflop-user')
            if (stored) {
                try {
                    const u = JSON.parse(stored)
                    if (u.xUserId) hasX = true
                } catch { }
            }
        }

        if (!hasX) {
            toast('Please connect your X account first', 'error')
            return
        }

        const qty = quantities[packType]
        const price = PACK_PRICES_V2[packType] * qty
        const priceWei = flipToWei(price)

        // Check balance
        if (balance && balance < priceWei) {
            toast(`Insufficient FLIP balance. Need ${formatFlipAmount(price)} FLIP`, 'error')
            return
        }

        setBuyingPack(packType)

        try {
            // Check allowance
            if (!allowance || allowance < priceWei) {
                setStatus('approving')
                toast('Approving FLIP...', 'info')
                const hash = await writeContractAsync({
                    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [PACK_SHOP_V2_ADDRESS as `0x${string}`, priceWei * BigInt(2)]
                })
                setApproveHash(hash)
                await new Promise(r => setTimeout(r, 3000))
                await refetchAllowance()
            }

            // Buy pack
            setStatus('buying')
            toast('Confirming purchase...', 'info')

            // Check if user has a referrer
            const referrer = user?.referredBy
            let txHash: `0x${string}`
            if (referrer && referrer !== '0x0000000000000000000000000000000000000000') {
                // Use buyPackWithReferrer
                console.log('🔗 Buying with referrer:', referrer)
                txHash = await writeContractAsync({
                    address: PACK_SHOP_V2_ADDRESS as `0x${string}`,
                    abi: PACK_SHOP_V2_ABI,
                    functionName: 'buyPackWithReferrer',
                    args: [PACK_INFO[packType].id, BigInt(qty), referrer as `0x${string}`]
                })
            } else {
                // Use regular buyPack
                console.log('📦 Buying without referrer')
                txHash = await writeContractAsync({
                    address: PACK_SHOP_V2_ADDRESS as `0x${string}`,
                    abi: PACK_SHOP_V2_ABI,
                    functionName: 'buyPack',
                    args: [PACK_INFO[packType].id, BigInt(qty)]
                })
            }
            setBuyHash(txHash)

        } catch (e: any) {
            console.error('Buy error:', e)
            toast(e.message?.slice(0, 100) || 'Purchase failed', 'error')
            setStatus('idle')
            setBuyingPack(null)
        }
    }

    const updateQty = (pack: PackTypeV2, delta: number) => {
        setQuantities(prev => ({
            ...prev,
            [pack]: Math.max(1, Math.min(10, prev[pack] + delta))
        }))
    }

    const flipBalance = balance ? Number(balance) / 1e18 : 0

    return (
        <>
            <Head>
                <title>Pack Shop | FLIP ROYALE</title>
                <meta name="description" content="Buy card packs with VIRTUAL tokens" />
            </Head>

            <div className="app" data-theme={theme}>
                <Topbar activeTab="shop" user={user} />

                {/* Main Content */}
                <main style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 16px' }}>
                    <h1 style={{
                        fontSize: 32,
                        fontWeight: 900,
                        textAlign: 'center',
                        marginBottom: 8,
                        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        🎴 PACK SHOP
                    </h1>
                    <p style={{
                        textAlign: 'center',
                        opacity: 0.7,
                        marginBottom: 32,
                        fontSize: 16
                    }}>
                        Buy card packs with VIRTUAL tokens. Each pack contains 5 cards!
                    </p>

                    {/* Pack Grid - Responsive: Desktop grid / Mobile horizontal scroll */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        gap: 16,
                        padding: '0 4px 12px 4px',
                        WebkitOverflowScrolling: 'touch',
                        scrollSnapType: 'x mandatory'
                    }}>
                        {PACK_ORDER.map(packType => {
                            const info = PACK_INFO[packType]
                            const price = PACK_PRICES_V2[packType]
                            const qty = quantities[packType]
                            const totalPrice = price * qty
                            const isBuying = buyingPack === packType

                            return (
                                <div
                                    key={packType}
                                    className="panel"
                                    style={{
                                        minWidth: '160px',
                                        maxWidth: '200px',
                                        flexShrink: 0,
                                        scrollSnapAlign: 'start',
                                        background: info.bgGradient,
                                        border: `2px solid ${info.color}40`,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-4px)'
                                        e.currentTarget.style.boxShadow = `0 12px 40px ${info.color}30`
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.boxShadow = 'none'
                                    }}
                                >
                                    {/* Pack Image */}
                                    <div style={{
                                        height: 120,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 12,
                                        background: `radial-gradient(circle at center, ${info.color}20, transparent)`
                                    }}>
                                        <img
                                            src={info.image}
                                            alt={info.name}
                                            style={{
                                                maxHeight: '100%',
                                                maxWidth: '100%',
                                                objectFit: 'contain',
                                                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))'
                                            }}
                                        />
                                    </div>

                                    {/* Pack Info */}
                                    <div style={{ padding: '12px 14px' }}>
                                        {/* Pack Name with Icon */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: 8
                                        }}>
                                            <h3 className="pack-card-text" style={{
                                                fontSize: 13,
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                letterSpacing: 0.8,
                                                margin: 0
                                            }}>
                                                {info.name}
                                            </h3>
                                            <span style={{
                                                fontSize: 10,
                                                background: 'rgba(255,255,255,0.15)',
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                fontWeight: 700
                                            }}>
                                                5 Cards
                                            </span>
                                        </div>

                                        {/* Description - Compact */}
                                        <p className="pack-card-text" style={{
                                            fontSize: 10,
                                            marginBottom: 8,
                                            lineHeight: 1.3,
                                            opacity: 0.85,
                                            height: 26,
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}>
                                            {info.description}
                                        </p>

                                        {/* Price */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: 10,
                                            padding: '6px 10px',
                                            background: 'rgba(0,0,0,0.25)',
                                            borderRadius: 8,
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <span className="pack-card-text" style={{ fontSize: 11 }}>Price:</span>
                                            <span className="pack-card-text" style={{
                                                fontSize: 14,
                                                fontWeight: 900
                                            }}>
                                                {formatFlipAmount(price)} VIRTUAL
                                            </span>
                                        </div>

                                        {/* Quantity Selector - Compact */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 10,
                                            background: 'rgba(0,0,0,0.2)',
                                            borderRadius: 8,
                                            padding: '6px 8px',
                                            border: '1px solid rgba(255,255,255,0.08)'
                                        }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateQty(packType, -1) }}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    background: info.color,
                                                    color: '#000',
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                -
                                            </button>
                                            <span className="pack-card-text" style={{
                                                fontSize: 16,
                                                fontWeight: 800,
                                                minWidth: 30,
                                                textAlign: 'center'
                                            }}>
                                                {qty}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); updateQty(packType, 1) }}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    background: info.color,
                                                    color: '#000',
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Total */}
                                        <div style={{
                                            textAlign: 'center',
                                            marginBottom: 10,
                                            padding: '6px',
                                            background: 'rgba(0,0,0,0.4)',
                                            borderRadius: 6
                                        }}>
                                            <span className="pack-card-text" style={{ fontSize: 10 }}>Total: </span>
                                            <span className="pack-card-text" style={{ fontSize: 13, fontWeight: 800 }}>
                                                {formatFlipAmount(totalPrice)} VIRTUAL
                                            </span>
                                        </div>

                                        {/* Buy Button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleBuy(packType) }}
                                            disabled={isBuying || !isConnected}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: 'none',
                                                background: isBuying
                                                    ? 'rgba(255,255,255,0.2)'
                                                    : `linear-gradient(135deg, ${info.color}, ${info.color}cc)`,
                                                color: isBuying ? '#fff' : '#000',
                                                fontSize: 12,
                                                fontWeight: 800,
                                                cursor: isBuying ? 'wait' : 'pointer',
                                                textTransform: 'uppercase',
                                                letterSpacing: 0.5,
                                                boxShadow: `0 4px 20px ${info.color}40`,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {!isConnected ? 'Connect Wallet' :
                                                isBuying ? (
                                                    status === 'approving' ? '⏳ Approving...' :
                                                        status === 'buying' ? '⏳ Buying...' :
                                                            status === 'verifying' ? '✅ Verifying...' :
                                                                '⏳ Processing...'
                                                ) : `Buy ${qty}x`}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Info Section */}
                    <div className="panel" style={{ marginTop: 32, padding: 24, textAlign: 'center' }}>
                        <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 700 }}>💡 How It Works</h3>
                        <p style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.6 }}>
                            1. Connect your wallet and X account<br />
                            2. Choose a pack type and quantity<br />
                            3. Approve VIRTUAL tokens (first time only)<br />
                            4. Confirm the purchase transaction<br />
                            5. New cards are added to your inventory!
                        </p>
                    </div>
                </main>
            </div>
        </>
    )
}
