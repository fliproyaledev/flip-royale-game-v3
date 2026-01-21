import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useToast } from '../lib/toast';
import { signIn } from 'next-auth/react';
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
  quantity = 1,
  packType = 'common',
  compact = false,
  isGift = false,
  referrerAddress,
  xHandle
}: {
  userId: string,
  onSuccess: () => void,
  price: number,
  quantity?: number,
  packType?: 'common' | 'rare',
  compact?: boolean,
  isGift?: boolean,
  referrerAddress?: string,
  xHandle?: string | null
}) {
  const [status, setStatus] = useState<'idle' | 'approving' | 'settingReferrer' | 'buying' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Transaction hash states for wagmi 2.x
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [setReferrerHash, setSetReferrerHash] = useState<`0x${string}` | undefined>();
  const [buyHash, setBuyHash] = useState<`0x${string}` | undefined>();

  const { toast } = useToast();
  const { address } = useAccount();
  const priceWei = parseUnits(price.toString(), 18);
  const packTypeNum = packType === 'rare' ? PACK_TYPES.RARE : PACK_TYPES.COMMON;

  // Check allowance - wagmi 2.x API
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, PACK_SHOP_ADDRESS as `0x${string}`],
    query: { enabled: Boolean(address) },
  });

  // Check balance - wagmi 2.x API
  const { data: balance } = useReadContract({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: Boolean(address) },
  });

  // Check if referrer is already set on-chain
  const { data: onChainReferrer, refetch: refetchReferrer } = useReadContract({
    address: PACK_SHOP_ADDRESS as `0x${string}`,
    abi: PACK_SHOP_ABI,
    functionName: 'referrerOf',
    args: [address!],
    query: { enabled: Boolean(address) },
  });

  // Write contract hook - wagmi 2.x API
  const { writeContractAsync } = useWriteContract();

  // Wait for approve transaction
  const { isLoading: isApproveWaiting, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Wait for setReferrer transaction
  const { isLoading: isSetReferrerWaiting, isSuccess: setReferrerSuccess, isError: setReferrerError } = useWaitForTransactionReceipt({
    hash: setReferrerHash,
  });

  // Wait for buy transaction
  const { isLoading: isBuyWaiting, isSuccess: buySuccess, data: buyReceipt } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // Handle approve success
  useEffect(() => {
    if (approveSuccess && status === 'approving') {
      console.log('✅ Approve confirmed!');
      refetchAllowance();
      executeSetReferrerOrBuy();
    }
  }, [approveSuccess]);

  // Handle setReferrer success or error
  useEffect(() => {
    if (setReferrerSuccess && status === 'settingReferrer') {
      console.log('✅ Referrer set! Now buying...');
      refetchReferrer();
      executeBuy();
    }
    if (setReferrerError && status === 'settingReferrer') {
      console.log('SetReferrer failed, proceeding with buyPack...');
      executeBuy();
    }
  }, [setReferrerSuccess, setReferrerError]);

  // Handle buy success
  useEffect(() => {
    if (buySuccess && buyReceipt && buyHash) {
      console.log('✅ Pack purchased!', buyReceipt.transactionHash);
      setStatus('done');
      handleBackendVerification(buyReceipt.transactionHash);
    }
  }, [buySuccess, buyReceipt, buyHash]);

  // Check if referrer needs to be set on-chain
  function needsReferrerSet(): boolean {
    if (!referrerAddress) {
      return false;
    }
    if (!onChainReferrer) {
      return true;
    }
    return onChainReferrer === '0x0000000000000000000000000000000000000000';
  }

  // Step 2: Set referrer if needed, then buy
  async function executeSetReferrerOrBuy() {
    const needsSet = needsReferrerSet();

    try {
      if (needsSet && referrerAddress) {
        setStatus('settingReferrer');
        const hash = await writeContractAsync({
          address: PACK_SHOP_ADDRESS as `0x${string}`,
          abi: PACK_SHOP_ABI,
          functionName: 'setReferrer',
          args: [referrerAddress as `0x${string}`]
        });
        setSetReferrerHash(hash);
      } else {
        executeBuy();
      }
    } catch (err: any) {
      console.error('SetReferrer error:', err);
      executeBuy();
    }
  }

  // Step 3: Execute the buy
  async function executeBuy() {
    try {
      setStatus('buying');
      console.log('Sending buyPack transaction...');

      const hash = await writeContractAsync({
        address: PACK_SHOP_ADDRESS as `0x${string}`,
        abi: PACK_SHOP_ABI,
        functionName: 'buyPack',
        args: [packTypeNum, BigInt(quantity)]
      });
      setBuyHash(hash);
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
        body: JSON.stringify({ userId, txHash, amount: price, packType, count: quantity })
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

    // Check if X account is connected (required for ReplyCorp campaign)
    if (!xHandle) {
      toast('Please connect your X account first to purchase packs', 'error');
      setTimeout(() => {
        signIn('twitter', { callbackUrl: '/auth/callback' });
      }, 1000);
      return;
    }

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

        const hash = await writeContractAsync({
          address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PACK_SHOP_ADDRESS as `0x${string}`, priceWei]
        });
        setApproveHash(hash);
      } catch (err: any) {
        console.error('Approve error:', err);
        setError(err.shortMessage || 'Approval failed');
        setStatus('idle');
      }
    } else {
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
