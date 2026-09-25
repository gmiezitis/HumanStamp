import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

/**
 * Ed25519 keypair generation and signing/verification
 */

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
  };
}

export async function sign(message: string, privateKeyHex: string): Promise<string> {
  const messageBytes = new TextEncoder().encode(message);
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const signature = await ed.signAsync(messageBytes, privateKey);
  
  return Buffer.from(signature).toString('hex');
}

export async function verify(
  message: string,
  signatureHex: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signature = Buffer.from(signatureHex, 'hex');
    const publicKey = Buffer.from(publicKeyHex, 'hex');
    
    return await ed.verifyAsync(signature, messageBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Create canonical receipt payload for signing
 * Version 1: includes id, sha256, recipe, createdAt, and fingerprint
 * 
 * CRITICAL: This payload must be deterministic and versioned.
 * Any change to the structure requires a new version number.
 */
export function createReceiptPayload(
  id: string, 
  sha256: string, 
  recipeJson: string, 
  createdAt: string,
  fingerprint?: string[]
): string {
  const payload = {
    v: 1, // payload version
    id,
    sha256,
    recipe: JSON.parse(recipeJson),
    createdAt,
    fingerprint: fingerprint || null,
  };
  // Use JSON.stringify with deterministic key ordering
  return JSON.stringify(payload, Object.keys(payload).sort());
}
