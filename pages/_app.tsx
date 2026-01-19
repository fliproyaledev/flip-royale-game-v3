import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '../lib/theme';
import { ToastProvider } from '../lib/toast';
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';

// Web3 v1 Imports
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiConfig } from 'wagmi';
import { chains, wagmiConfig } from '../lib/wagmi';

// Mini App SDK
import { isInMiniApp, notifyMiniAppReady } from '../lib/miniapp';

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  // Initialize mini app SDK if running inside Base App
  useEffect(() => {
    if (isInMiniApp()) {
      // Notify Base App that our UI is ready to be displayed
      notifyMiniAppReady();
    }
  }, []);

  return (
    <SessionProvider session={session}>
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
                <meta name="base:app_id" content="696ea714f22fe462e74c15d5" />
                <meta name="virtual-protocol-site-verification" content="32a70cf4dfb561e7918405e64f72e9eb" />
              </Head>
              <Component {...pageProps} />
            </ToastProvider>
          </ThemeProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </SessionProvider>
  );
}