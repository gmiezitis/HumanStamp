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
 * 2. Persistent keys file (generated on first boot) - ONLY in development
 * 3. In production (NODE_ENV=production), missing env keys cause a fatal error
 */
export async function getSigningKeys(): Promise<SigningKeySet> {
  const envPrivateKey = process.env.SIGNING_PRIVATE_KEY;
  const envPublicKey = process.env.SIGNING_PUBLIC_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  // If env keys are set, use them
  if (envPrivateKey && envPublicKey) {
    return {
      privateKey: envPrivateKey,
      publicKey: envPublicKey,
      keyId: PROD_KEY_ID,
    };
  }

  // In production, env keys are REQUIRED
  if (isProduction) {
    console.error('❌ FATAL: Production requires SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY environment variables.');
    console.error('   Receipts must stay valid across deploys. Generate a key pair and set these env vars:');
    console.error('   SIGNING_PRIVATE_KEY=<your-ed25519-private-key>');
    console.error('   SIGNING_PUBLIC_KEY=<your-ed25519-public-key>');
    console.error('   Without fixed keys, old receipts will show as "Invalid" after deployment.');
    throw new Error('Missing required SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY in production');
  }

  // Development: If keys are cached in memory, return them
  if (cachedPrivateKey && cachedPublicKey) {
    return {
      privateKey: cachedPrivateKey,
      publicKey: cachedPublicKey,
      keyId: DEV_KEY_ID,
    };
  }

  // Development: Load or generate persistent keys
  console.log('⚠️  Development mode: using auto-generated keys (not for production)');
  const keys = await loadOrGeneratePersistentKeys();
  cachedPrivateKey = keys.privateKey;
  cachedPublicKey = keys.publicKey;

  return {
    privateKey: cachedPrivateKey,
    publicKey: cachedPublicKey,
    keyId: DEV_KEY_ID,
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
