// pages/api/.well-known/farcaster.ts
// Manifest endpoint for Base Mini App discovery

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // CORS headers for Base App access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fliproyale.xyz';

    const manifest = {
        accountAssociation: {
            // These will be filled in Phase 3 (Account Association)
            header: process.env.MINIAPP_ACCOUNT_HEADER || "",
            payload: process.env.MINIAPP_ACCOUNT_PAYLOAD || "",
            signature: process.env.MINIAPP_ACCOUNT_SIGNATURE || ""
        },
        miniapp: {
            version: "1",
            name: "FLIP ROYALE",
            homeUrl: baseUrl,
            iconUrl: `${baseUrl}/icon.png`,
            splashImageUrl: `${baseUrl}/splash.png`,
            splashBackgroundColor: "#0a0e27",
            webhookUrl: `${baseUrl}/api/miniapp/webhook`,
            subtitle: "Card Trading Game on Base",
            description: "Flip cards daily, compete on leaderboards, and collect points in this fast-paced on-chain card game on Base blockchain.",
            screenshotUrls: [
                `${baseUrl}/screenshots1.png`,
                `${baseUrl}/screenshots2.png`
            ],
            primaryCategory: "games",
            tags: ["trading-card", "nft", "base", "competition", "game"],
            heroImageUrl: `${baseUrl}/heroimage.png`,
            tagline: "Flip, Collect, Compete!",
            ogTitle: "FLIP ROYALE - On-Chain Card Game",
            ogDescription: "Trade cards daily, compete for prizes, and build your collection on Base blockchain.",
            ogImageUrl: `${baseUrl}/heroimage.png`,
            noindex: false
        }
    };

    res.status(200).json(manifest);
}
