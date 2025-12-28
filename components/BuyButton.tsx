import { useState } from 'react';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useToast } from '../lib/toast';
import {
  PACK_SHOP_ADDRESS,
  PACK_SHOP_ABI,
  VIRTUAL_TOKEN_ADDRESS,
  PACK_TYPES
} from '../lib/contracts/packShop';

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
  const [status, setStatus] = useState<'idle' | 'approving' | 'settingReferrer' | 'buying' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
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

  // Check if referrer is already set on-chain
  const { data: onChainReferrer, refetch: refetchReferrer } = useContractRead({
    address: PACK_SHOP_ADDRESS as `0x${string}`,
    abi: PACK_SHOP_ABI,
    functionName: 'referrerOf',
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
      console.log('✅ Approve confirmed!');
      await refetchAllowance();
      // After approval, check if we need to set referrer first
      await executeSetReferrerOrBuy();
    },
    onError: (err) => {
      console.error('Approve error:', err);
      setError('Approval failed');
      setStatus('idle');
    }
  });

  // SetReferrer contract call
  const {
    writeAsync: setReferrerAsync,
    data: setReferrerData,
  } = useContractWrite({
    address: PACK_SHOP_ADDRESS as `0x${string}`,
    abi: PACK_SHOP_ABI,
    functionName: 'setReferrer',
  });

  // Wait for setReferrer
  const { isLoading: isSetReferrerWaiting } = useWaitForTransaction({
    hash: setReferrerData?.hash,
    onSuccess: async () => {
      console.log('✅ Referrer set! Now buying...');
      await refetchReferrer();
      executeBuy();
    },
    onError: (err) => {
      console.error('SetReferrer error:', err);
      // Even if setReferrer fails, try to buy anyway
      console.log('SetReferrer failed, proceeding with buyPack...');
      executeBuy();
    }
  });

  // Buy pack - ALWAYS use buyPack (not buyPackWithReferrer)
  const {
    writeAsync: buyAsync,
    data: buyData,
  } = useContractWrite({
    address: PACK_SHOP_ADDRESS as `0x${string}`,
    abi: PACK_SHOP_ABI,
    functionName: 'buyPack',
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

  // Check if referrer needs to be set on-chain
  function needsReferrerSet(): boolean {
    // DEBUG LOGS
    console.log('🔍 needsReferrerSet check:');
    console.log('  - referrerAddress (from DB):', referrerAddress);
    console.log('  - onChainReferrer:', onChainReferrer);

    // If we have a referrer address from database but not set on-chain
    if (!referrerAddress) {
      console.log('  ❌ No referrerAddress from DB, skipping setReferrer');
      return false;
    }
    if (!onChainReferrer) {
      console.log('  ✓ onChainReferrer not loaded yet, will try to set');
      return true;
    }
    // Check if on-chain referrer is zero address
    const isZeroAddress = onChainReferrer === '0x0000000000000000000000000000000000000000';
    console.log('  - isZeroAddress:', isZeroAddress);
    return isZeroAddress;
  }

  // Step 2: Set referrer if needed, then buy
  async function executeSetReferrerOrBuy() {
    console.log('🚀 executeSetReferrerOrBuy called');
    const needsSet = needsReferrerSet();
    console.log('  - needsReferrerSet():', needsSet);
    console.log('  - referrerAddress:', referrerAddress);

    try {
      if (needsSet && referrerAddress) {
        setStatus('settingReferrer');
        console.log('📝 Calling setReferrer with:', referrerAddress);
        await setReferrerAsync({
          args: [referrerAddress as `0x${string}`]
        });
        console.log('  setReferrerAsync called, waiting for confirmation...');
        // Wait for transaction will call executeBuy
      } else {
        console.log('⏭️ Skipping setReferrer, going directly to buyPack');
        // No referrer needed, buy directly
        executeBuy();
      }
    } catch (err: any) {
      console.error('❌ SetReferrer error:', err);
      // If setReferrer fails, still try to buy
      executeBuy();
    }
  }

  // Step 3: Execute the buy
  async function executeBuy() {
    try {
      setStatus('buying');
      console.log('Sending buyPack transaction...');

      await buyAsync({
        args: [packTypeNum, BigInt(1)]
      });
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
    if (!address) {
      toast('Please connect wallet', 'error')
      return
    }
    if (isGift) { onSuccess?.(); return; }

    setError(null);

    // Check balance
    if (balance && balance < priceWei) {
      toast(`Insufficient VIRTUAL. Have: ${formatUnits(balance, 18)}, Need: ${price}`, 'error');
      return;
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
      // Already approved, check referrer then buy
      await executeSetReferrerOrBuy();
    }
  };

  const isLoading = status !== 'idle' && status !== 'done' || isApproveWaiting || isSetReferrerWaiting || isBuyWaiting;

  const getLabel = () => {
    if (isGift) return 'Open Gift';
    if (status === 'approving' || isApproveWaiting) return `Approve ${price} VIRTUAL...`;
    if (status === 'settingReferrer' || isSetReferrerWaiting) return 'Setting referrer...';
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
