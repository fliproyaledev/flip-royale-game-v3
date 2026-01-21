// lib/useMiniAppWallet.ts
// Custom hook for handling wallet connection in Base Mini App context

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { isInMiniApp, getMiniAppContext } from './miniapp';

interface MiniAppWalletState {
    isInMiniApp: boolean;
    miniAppWallet: string | null;
    isConnecting: boolean;
    autoConnectAttempted: boolean;
}

/**
 * Hook to handle wallet connection in Base Mini App
 * Auto-connects to Coinbase Wallet when running inside Base App
 */
export function useMiniAppWallet() {
    const { isConnected, address } = useAccount();
    const { connect, connectors } = useConnect();
    const [state, setState] = useState<MiniAppWalletState>({
        isInMiniApp: false,
        miniAppWallet: null,
        isConnecting: false,
        autoConnectAttempted: false,
    });

    // Detect Mini App context and get wallet from SDK
    useEffect(() => {
        async function detectMiniApp() {
            const inMiniApp = isInMiniApp();
            if (inMiniApp) {
                try {
                    const context = await getMiniAppContext();
                    const wallet = (context?.user as any)?.wallet?.address || null;
                    setState(prev => ({
                        ...prev,
                        isInMiniApp: true,
                        miniAppWallet: wallet,
                    }));
                } catch (error) {
                    console.error('Failed to get Mini App context:', error);
                    setState(prev => ({ ...prev, isInMiniApp: true }));
                }
            }
        }
        detectMiniApp();
    }, []);

    // Auto-connect to Coinbase Wallet when in Mini App
    useEffect(() => {
        if (
            state.isInMiniApp &&
            !isConnected &&
            !state.isConnecting &&
            !state.autoConnectAttempted
        ) {
            // Find Coinbase Wallet connector
            const coinbaseConnector = connectors.find(
                (c) => c.id === 'coinbaseWallet' || c.name === 'Coinbase Wallet'
            );

            if (coinbaseConnector) {
                setState(prev => ({ ...prev, isConnecting: true, autoConnectAttempted: true }));

                // Use wagmi 1.x connect API (single argument, no callback)
                connect({ connector: coinbaseConnector });
                console.log('🔄 Attempting auto-connect to Coinbase Wallet in Mini App');

                // Set connecting to false after a delay (wagmi handles state)
                setTimeout(() => {
                    setState(prev => ({ ...prev, isConnecting: false }));
                }, 2000);
            } else {
                setState(prev => ({ ...prev, autoConnectAttempted: true }));
            }
        }
    }, [state.isInMiniApp, isConnected, state.isConnecting, state.autoConnectAttempted, connectors, connect]);

    return {
        isInMiniApp: state.isInMiniApp,
        miniAppWallet: state.miniAppWallet,
        isAutoConnecting: state.isConnecting,
        // Use wagmi address if connected, otherwise use Mini App SDK wallet
        effectiveAddress: address || state.miniAppWallet,
        isConnected,
    };
}
