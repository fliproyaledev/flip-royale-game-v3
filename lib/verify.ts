// lib/verify.ts
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

/**
 * Kullanıcının gönderdiği imzayı doğrular.
 * EOA + Smart Wallet (Base App) uyumludur.
 */
export async function verifyUserSignature(
  address: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const valid = await publicClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    return valid
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}
