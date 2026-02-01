import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';

/**
 * POST /api/arena/oracle/resolve
 * 
 * Resolves an Arena room by calling the smart contract.
 * Gets signature from oracle and submits to contract.
 * 
 * Body: { roomId: string, winner: string | null, secret: string }
 */

const ARENA_CONTRACT = process.env.NEXT_PUBLIC_ARENA_CONTRACT;
const ORACLE_PRIVATE_KEY = process.env.ARENA_ORACLE_PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const ORACLE_SECRET = process.env.ORACLE_SECRET;

// Contract ABI (only resolve functions)
const ARENA_ABI = [
    'function resolveRoom(bytes32 roomId, address winner, bytes32 nonce, bytes calldata signature) external',
    'function resolveRoomDraw(bytes32 roomId, bytes32 nonce, bytes calldata signature) external',
    'function rooms(bytes32) external view returns (bytes32, address, address, uint256, uint8, uint8, uint8, address, uint256, uint256)'
];

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

        // Validate config
        if (!ARENA_CONTRACT || !ORACLE_PRIVATE_KEY) {
            console.error('Arena contract or oracle key not configured');
            return res.status(500).json({ error: 'Not configured' });
        }

        // Validate roomId (should be bytes32)
        if (!roomId || typeof roomId !== 'string') {
            return res.status(400).json({ error: 'roomId required' });
        }

        // Setup provider and wallet
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(ARENA_CONTRACT, ARENA_ABI, wallet);

        // Generate unique nonce
        const nonce = ethers.keccak256(
            ethers.toUtf8Bytes(`${roomId}-${Date.now()}-${Math.random()}`)
        );

        // Determine winner address (address(0) for draw)
        const winnerAddress = winner || ethers.ZeroAddress;
        const isDraw = winner === null;

        // Create message hash: keccak256(roomId, winner, nonce)
        const messageHash = ethers.solidityPackedKeccak256(
            ['bytes32', 'address', 'bytes32'],
            [roomId, winnerAddress, nonce]
        );

        // Sign the message
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));

        console.log('Oracle resolving room:', {
            roomId,
            winner: winnerAddress,
            isDraw,
            nonce
        });

        // Call appropriate contract function
        let tx;
        if (isDraw) {
            tx = await contract.resolveRoomDraw(roomId, nonce, signature);
        } else {
            tx = await contract.resolveRoom(roomId, winnerAddress, nonce, signature);
        }

        // Wait for confirmation
        const receipt = await tx.wait();

        console.log('Room resolved:', {
            roomId,
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString()
        });

        return res.status(200).json({
            success: true,
            roomId,
            winner: winnerAddress,
            isDraw,
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString()
        });

    } catch (error: any) {
        console.error('Oracle resolve error:', error);
        return res.status(500).json({
            error: 'Failed to resolve',
            message: error.message
        });
    }
}
