import { generateKeyPair } from '@human-stamp/core';
import { promises as fs } from 'fs';
import path from 'path';

let cachedPrivateKey: string | null = null;
let cachedPublicKey: string | null = null;

const DEV_KEY_ID = 'dev-ephemeral';
const PROD_KEY_ID = 'prod-v1';
const PERSISTENT_KEYS_PATH = process.env.SIGNING_KEYS_PATH || '/data/signing-keys.json';

export interface SigningKeySet {
  privateKey: string;
  publicKey: string;
  keyId: string;
}

/**
 * Load or generate persistent signing keys from the filesystem.
 * Used when SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY are not set.
 */
async function loadOrGeneratePersistentKeys(): Promise<{ privateKey: string; publicKey: string }> {
  try {
    const keysJson = await fs.readFile(PERSISTENT_KEYS_PATH, 'utf-8');
    const keys = JSON.parse(keysJson);
    console.log('✅ Loaded signing keys from', PERSISTENT_KEYS_PATH);
    return keys;
  } catch (error) {
    console.log('🔑 Generating new signing keypair...');
    const keypair = await generateKeyPair();
    
    try {
      await fs.mkdir(path.dirname(PERSISTENT_KEYS_PATH), { recursive: true });
      await fs.writeFile(PERSISTENT_KEYS_PATH, JSON.stringify(keypair, null, 2), 'utf-8');
      console.log('✅ Saved signing keys to', PERSISTENT_KEYS_PATH);
    } catch (writeError) {
      console.warn('⚠️  Could not persist signing keys to', PERSISTENT_KEYS_PATH, '- will use ephemeral keys');
    }
    
    return keypair;
  }
}

/**
 * Get signing keys for creating stamps.
 * Priority:
 * 1. SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY environment variables
 * 2. Persistent keys file (generated on first boot)
 * 3. In-memory ephemeral keys (for tests)
 */
export async function getSigningKeys(): Promise<SigningKeySet> {
  const envPrivateKey = process.env.SIGNING_PRIVATE_KEY;
  const envPublicKey = process.env.SIGNING_PUBLIC_KEY;

  // If env keys are set, use them
  if (envPrivateKey && envPublicKey) {
    return {
      privateKey: envPrivateKey,
      publicKey: envPublicKey,
      keyId: PROD_KEY_ID,
    };
  }

  // If keys are cached in memory, return them
  if (cachedPrivateKey && cachedPublicKey) {
    return {
      privateKey: cachedPrivateKey,
      publicKey: cachedPublicKey,
      keyId: PROD_KEY_ID,
    };
  }

  // Load or generate persistent keys
  const keys = await loadOrGeneratePersistentKeys();
  cachedPrivateKey = keys.privateKey;
  cachedPublicKey = keys.publicKey;

  return {
    privateKey: cachedPrivateKey,
    publicKey: cachedPublicKey,
    keyId: PROD_KEY_ID,
  };
}

/**
 * Get the server's known public keys for verification.
 * Returns an array of key records (to support key rotation).
 */
export async function getKnownPublicKeys(): Promise<Array<{ keyId: string; publicKey: string }>> {
  const envPublicKey = process.env.SIGNING_PUBLIC_KEY;

  const keys: Array<{ keyId: string; publicKey: string }> = [];

  // Add env public key if available
  if (envPublicKey) {
    keys.push({
      keyId: PROD_KEY_ID,
      publicKey: envPublicKey,
    });
  }

  // Add persistent/cached key
  if (cachedPublicKey) {
    keys.push({
      keyId: PROD_KEY_ID,
      publicKey: cachedPublicKey,
    });
  } else {
    // Try to load from file
    try {
      const keysJson = await fs.readFile(PERSISTENT_KEYS_PATH, 'utf-8');
      const persistentKeys = JSON.parse(keysJson);
      keys.push({
        keyId: PROD_KEY_ID,
        publicKey: persistentKeys.publicKey,
      });
    } catch (error) {
      // No persistent keys available
    }
  }

  return keys;
}
