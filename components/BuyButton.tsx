import { useState } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  PACK_SHOP_ADDRESS,
  PACK_SHOP_ABI,
  VIRTUAL_TOKEN_ADDRESS,
  PACK_TYPES
} from '../lib/contracts/packShop';
import { useNotify } from './Notification';

// ERC20 ABI
const ERC20_ABI = [
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

export default function BuyButton({
  userId,
  onSuccess,
  price,
  packType = 'common',
  compact = false,
  isGift = false,
  referrerAddress
}: {
  userId: string,
  onSuccess: () => void,
  price: number,
  packType?: 'common' | 'rare',
  compact?: boolean,
  isGift?: boolean,
  referrerAddress?: string
}) {
  const [status, setStatus] = useState<'idle' | 'approving' | 'buying' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();

  const { address } = useAccount();
  const priceWei = parseUnits(price.toString(), 18);
  const packTypeNum = packType === 'rare' ? PACK_TYPES.RARE : PACK_TYPES.COMMON;

  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useContractRead({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, PACK_SHOP_ADDRESS as `0x${string}`],
    enabled: Boolean(address),
  });

  // Check balance
  const { data: balance } = useContractRead({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    enabled: Boolean(address),
  });

  // Approve - sadece gerekli miktar için
  const {
    writeAsync: approveAsync,
    data: approveData,
  } = useContractWrite({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
  });

  // Wait for approve
  const { isLoading: isApproveWaiting } = useWaitForTransaction({
    hash: approveData?.hash,
    onSuccess: async () => {
      console.log('✅ Approve confirmed! Now buying...');
      await refetchAllowance();
      executeBuy();
    },
    onError: (err) => {
      console.error('Approve error:', err);
      setError('Approval failed');
      setStatus('idle');
    }
  });

  // Buy pack
  const {
    writeAsync: buyAsync,
    data: buyData,
  } = useContractWrite({
    address: PACK_SHOP_ADDRESS as `0x${string}`,
    abi: PACK_SHOP_ABI,
    functionName: referrerAddress ? 'buyPackWithReferrer' : 'buyPack',
  });

  // Wait for buy
  const { isLoading: isBuyWaiting } = useWaitForTransaction({
    hash: buyData?.hash,
    onSuccess: (receipt) => {
      console.log('✅ Pack purchased!', receipt.transactionHash);
      setStatus('done');
      handleBackendVerification(receipt.transactionHash);
    },
    onError: (err) => {
      console.error('Buy error:', err);
      setError('Purchase failed');
      setStatus('idle');
    }
  });

  async function executeBuy() {
    try {
      setStatus('buying');
      console.log('Sending buyPack transaction...');

      const args = referrerAddress
        ? [packTypeNum, BigInt(1), referrerAddress as `0x${string}`]
        : [packTypeNum, BigInt(1)];

      await buyAsync({ args: args as any });
    } catch (err: any) {
      console.error('Buy error:', err);
      setError(err.shortMessage || 'Purchase failed');
      setStatus('idle');
    }
  }

  async function handleBackendVerification(txHash: string) {
    try {
      await fetch('/api/shop/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, txHash, amount: price, packType, count: 1 })
      });
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error('Backend error:', e);
      if (onSuccess) onSuccess();
    } finally {
      setTimeout(() => setStatus('idle'), 2000);
    }
  }

  const handleBuy = async () => {
    if (!address) return notify('Please connect wallet', { tone: 'warning' });
    if (isGift) { onSuccess?.(); return; }

    setError(null);

    // Check balance
    if (balance && balance < priceWei) {
      return notify(`Insufficient VIRTUAL. Have: ${formatUnits(balance, 18)}, Need: ${price}`, { tone: 'warning' });
    }

    const currentAllowance = allowance || BigInt(0);
    console.log('Allowance:', formatUnits(currentAllowance, 18), 'Need:', price);

    // Check if approval needed
    if (currentAllowance < priceWei) {
      try {
        setStatus('approving');
        console.log('Sending approve for', price, 'VIRTUAL...');

        // Sadece gerekli miktar için izin iste
        await approveAsync({
          args: [PACK_SHOP_ADDRESS as `0x${string}`, priceWei]
        });
        // Wait for approve confirmation (handled by useWaitForTransaction)
      } catch (err: any) {
        console.error('Approve error:', err);
        setError(err.shortMessage || 'Approval failed');
        setStatus('idle');
      }
    } else {
      // Already approved, buy directly
      executeBuy();
    }
  };

  const isLoading = status !== 'idle' && status !== 'done' || isApproveWaiting || isBuyWaiting;

  const getLabel = () => {
    if (isGift) return 'Open Gift';
    if (status === 'approving' || isApproveWaiting) return `Approve ${price} VIRTUAL...`;
    if (status === 'buying' || isBuyWaiting) return 'Buying...';
    if (status === 'done') return '✓ Success!';
    return `Buy for ${price} VIRTUAL`;
  };

  return (
    <div style={{ width: '100%' }}>
      <button
        onClick={handleBuy}
        disabled={isLoading}
        className="btn primary"
        style={{
          width: '100%',
          marginTop: compact ? 0 : 8,
          opacity: isLoading ? 0.6 : 1,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: compact ? 10 : 12,
          padding: compact ? '8px 2px' : '8px 0',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          background: status === 'done'
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : packType === 'rare'
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        }}
      >
        {getLabel()}
      </button>
      {error && <p style={{ color: '#ff4444', fontSize: 10, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
