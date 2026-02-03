import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector';
import { coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';

// Project ID for WalletConnect
const projectId = process.env.NEXT_PUBLIC_WALLET_PROJECT_ID || '64eacce4072beecbb82a5c6f1c612552';

// RainbowKit v2 configuration with Farcaster connector for Base Mini App
export const config = getDefaultConfig({
  appName: 'Flip Royale',
  projectId,
  chains: [base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  },
  // Coinbase Wallet prioritized for Base Mini App
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [coinbaseWallet],
    },
  ],
});

// Export for backward compatibility
export const wagmiConfig = config;
export const chains = [base];
