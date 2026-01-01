import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '../lib/theme';
import { ToastProvider } from '../lib/toast';

// Web3 v1 Imports
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiConfig } from 'wagmi';
import { chains, wagmiConfig } from '../lib/wagmi';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider
        chains={chains}
        theme={darkTheme({
          accentColor: '#10b981',
          borderRadius: 'medium',
        })}
        modalSize="compact"
        locale="en"
      >
        <ThemeProvider>
          <ToastProvider>
            <Head>
              <title>FLIP ROYALE</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="virtual-protocol-site-verification" content="32a70cf4dfb561e7918405e64f72e9eb" />
            </Head>
            <Component {...pageProps} />
          </ToastProvider>
        </ThemeProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}