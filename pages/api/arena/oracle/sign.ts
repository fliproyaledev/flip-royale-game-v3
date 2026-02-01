import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';

/**
 * POST /api/arena/oracle/sign
 * 
 * Oracle endpoint that signs winner results for FlipRoyaleArena contract.
 * Only callable internally (with secret) after game resolution.
 * 
 * Body: { roomId: string, winner: string | null, secret: string }
 * - winner = null means DRAW
 * 
 * Returns: { signature: string, nonce: string, winner: string }
 */

const ORACLE_PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY;
const ORACLE_SECRET = process.env.ORACLE_SECRET;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { roomId, winner, secret } = req.body;

        // Validate secret
        if (!secret || secret !== ORACLE_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate oracle key
        if (!ORACLE_PRIVATE_KEY) {
            console.error('ARENA_ORACLE_PRIVATE_KEY not configured');
            return res.status(500).json({ error: 'Oracle not configured' });
        }

        // Validate roomId
        if (!roomId || typeof roomId !== 'string') {
            return res.status(400).json({ error: 'roomId required' });
        }

        // Create wallet from private key
        const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY);

        // Generate unique nonce
        const nonce = ethers.keccak256(
            ethers.toUtf8Bytes(`${roomId}-${Date.now()}-${Math.random()}`)
        );

        // Determine winner address (address(0) for draw)
        const winnerAddress = winner || ethers.ZeroAddress;

        // Create message hash: keccak256(roomId, winner, nonce)
        const messageHash = ethers.solidityPackedKeccak256(
            ['bytes32', 'address', 'bytes32'],
            [roomId, winnerAddress, nonce]
        );

        // Sign the message (ethers v6 automatically adds prefix)
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));

        console.log('Oracle signed:', {
            roomId,
            winner: winnerAddress,
            nonce,
            signer: wallet.address
        });

        return res.status(200).json({
            success: true,
            roomId,
            winner: winnerAddress,
            nonce,
            signature,
            isDraw: winner === null
        });

    } catch (error) {
        console.error('Oracle sign error:', error);
        return res.status(500).json({ error: 'Failed to sign' });
    }
}
