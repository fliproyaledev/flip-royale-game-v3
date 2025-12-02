import { useState } from 'react';
import { usePrepareContractWrite, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseUnits } from 'viem';
import { VIRTUAL_TOKEN_ADDRESS, DEV_WALLET_ADDRESS, ERC20_ABI } from '../lib/constants';

export default function BuyButton({
  userId,
  onSuccess,
  price,
  packType = 'common',
  compact = false,
  isGift = false
}: {
  userId: string,
  onSuccess: () => void,
  price: number,
  packType?: 'common' | 'rare',
  compact?: boolean,
  isGift?: boolean
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Prepare only when this is NOT a gift (gifts don't require on-chain transfer)
  const { config, error: prepareError } = usePrepareContractWrite({
    address: VIRTUAL_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [
      DEV_WALLET_ADDRESS as `0x${string}`,
      parseUnits(price.toString(), 18) // 18 decimal assumption
    ],
    enabled: Boolean(userId) && !isGift,
  });

  const { data: txData, write, isLoading: isWriting } = useContractWrite(config);

  const { isLoading: isConfirming } = useWaitForTransaction({
    hash: txData?.hash,
    onSuccess: (receipt) => {
      console.log('Blockchain confirmed, verifying with backend...', receipt.transactionHash);
      handleBackendVerification(receipt.transactionHash);
    },
    onError: (err) => {
      console.error('Blockchain error:', err);
      alert('Transaction failed on blockchain.');
    }
  });

  async function handleBackendVerification(txHash: string) {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/shop/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, txHash, amount: price, packType, count: 1 })
      });

      let data;
      try { data = await res.json(); } catch { data = null }

      if (res.ok && data?.ok) {
        if (onSuccess) onSuccess();
      } else {
        console.warn('API warning:', data?.error);
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      console.error('Verification error:', e);
      alert('Transaction sent. Please check your inventory in a moment.');
    } finally {
      setIsProcessing(false);
    }
  }

  const isLoading = isWriting || isConfirming || isProcessing;

  const handleBuy = () => {
    if (!userId) return alert('Please login first');

    // If this is a gift flow, bypass on-chain transfer and call onSuccess directly
    if (isGift) {
      if (onSuccess) onSuccess();
      return;
    }

    if (prepareError) {
      console.error('Prepare Error:', prepareError);
      const msg = String(prepareError.message || '').toLowerCase().includes('insufficient')
        ? 'Insufficient VIRTUAL balance + ETH for gas.'
        : 'Transaction preparation failed. Check console.';
      return alert(msg);
    }

    if (write) {
      write();
    } else {
      alert('Wallet not ready. Please refresh and try again.');
    }
  };

  const label = isGift ? `Open Gift` : `Buy for ${price} VIRTUAL`;

  return (
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
        background: packType === 'rare'
          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
      }}
    >
      {isWriting ? 'Check Wallet...' : isConfirming ? 'Confirming...' : isProcessing ? 'Verifying...' : label}
    </button>
  );
}
