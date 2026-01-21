import { getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createConfig } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

// Base chain definition (manually defined for compatibility)
export const base = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://mainnet.base.org'] },
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'Basescan', url: 'https://basescan.org' },
  },
} as const;

// Project ID for WalletConnect
const projectId = process.env.NEXT_PUBLIC_WALLET_PROJECT_ID || '64eacce4072beecbb82a5c6f1c612552';

// 1. Configure chains
const { chains, publicClient } = configureChains(
  [base],
  [publicProvider()]
);

// 2. Get default wallets
const { wallets } = getDefaultWallets({
  appName: 'Flip Royale',
  projectId,
  chains
});

// 3. Create connectors with Coinbase Wallet prioritized for Base Mini App
const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      coinbaseWallet({ appName: 'Flip Royale', chains }),
    ],
  },
  ...wallets,
]);

// 4. Create config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient
});

// Export chains for _app.tsx
export { chains };
