// lib/miniapp.ts
// Mini App detection and utility functions

import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Detect if app is running inside Base App / Farcaster client
 */
export function isInMiniApp(): boolean {
    if (typeof window === 'undefined') return false;

    // Check if loaded in iframe (mini apps run in iframe)
    try {
        return window.self !== window.top;
    } catch {
        // If we can't access window.top due to cross-origin, we're likely in iframe
        return true;
    }
}

/**
 * Get mini app context (user info, wallet, etc.)
 */
export async function getMiniAppContext() {
    if (!isInMiniApp()) return null;

    try {
        const context = await sdk.context;
        return context;
    } catch (error) {
        console.error('Failed to get mini app context:', error);
        return null;
    }
}

/**
 * Get user's wallet address from mini app context
 */
export async function getMiniAppWallet(): Promise<string | null> {
    try {
        const context = await getMiniAppContext();
        // Type cast to any for wallet access (SDK types may vary)
        const wallet = (context?.user as any)?.wallet;
        return wallet?.address || null;
    } catch {
        return null;
    }
}

/**
 * Get user's Farcaster ID (FID)
 */
export async function getMiniAppFID(): Promise<number | null> {
    try {
        const context = await getMiniAppContext();
        return context?.user?.fid || null;
    } catch {
        return null;
    }
}

/**
 * Notify Base App that mini app is ready to be displayed
 * Call this once your UI has loaded
 */
export async function notifyMiniAppReady() {
    if (!isInMiniApp()) return;

    try {
        await sdk.actions.ready();
        console.log('✅ Mini app ready signal sent');
    } catch (error) {
        console.error('Failed to send ready signal:', error);
    }
}

/**
 * Open external URL (will show confirmation in Base App)
 */
export async function openExternalUrl(url: string) {
    if (!isInMiniApp()) {
        window.open(url, '_blank');
        return;
    }

    try {
        await sdk.actions.openUrl({ url });
    } catch (error) {
        console.error('Failed to open URL:', error);
        window.open(url, '_blank'); // Fallback
    }
}

/**
 * Track event in mini app analytics
 */
export function trackMiniAppEvent(eventName: string, properties?: Record<string, any>) {
    // You can extend this to integrate with your existing analytics
    if (isInMiniApp()) {
        console.log(`[MiniApp Event] ${eventName}`, properties);
    }
}
