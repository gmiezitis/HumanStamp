import { generateKeyPair } from '@human-stamp/core';

let devPrivateKey: string | null = null;
let devPublicKey: string | null = null;

const DEV_KEY_ID = 'dev-ephemeral';
const PROD_KEY_ID = 'prod-v1';

export interface SigningKeySet {
  privateKey: string;
  publicKey: string;
  keyId: string;
}

/**
 * Get signing keys for creating stamps.
 * In production, SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY must be set.
 * In development, falls back to ephemeral keys with clear warnings.
 */
export async function getSigningKeys(): Promise<SigningKeySet> {
  const envPrivateKey = process.env.SIGNING_PRIVATE_KEY;
  const envPublicKey = process.env.SIGNING_PUBLIC_KEY;
  const nodeEnv = process.env.NODE_ENV;

  // Production mode: require env keys
  if (nodeEnv === 'production') {
    if (!envPrivateKey || !envPublicKey) {
      throw new Error(
        'CRITICAL: SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY must be set in production. ' +
        'Refusing to sign with ephemeral keys in production.'
      );
    }
    return {
      privateKey: envPrivateKey,
      publicKey: envPublicKey,
      keyId: PROD_KEY_ID,
    };
  }

  // Development/test mode: prefer env keys, fall back to ephemeral
  if (envPrivateKey && envPublicKey) {
    return {
      privateKey: envPrivateKey,
      publicKey: envPublicKey,
      keyId: PROD_KEY_ID,
    };
  }

  // Generate ephemeral dev key once per process
  if (devPrivateKey && devPublicKey) {
    return {
      privateKey: devPrivateKey,
      publicKey: devPublicKey,
      keyId: DEV_KEY_ID,
    };
  }

  console.warn(
    '⚠️  DEV MODE: No signing keys in env, generating ephemeral keypair.\n' +
    '   This key will NOT persist across server restarts.\n' +
    '   Set SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY in .env for stable keys.'
  );
  
  const keypair = await generateKeyPair();
  devPrivateKey = keypair.privateKey;
  devPublicKey = keypair.publicKey;

  return {
    privateKey: devPrivateKey,
    publicKey: devPublicKey,
    keyId: DEV_KEY_ID,
  };
}

/**
 * Get the server's known public keys for verification.
 * Returns an array of key records (to support key rotation).
 */
export async function getKnownPublicKeys(): Promise<Array<{ keyId: string; publicKey: string }>> {
  const envPublicKey = process.env.SIGNING_PUBLIC_KEY;
  const nodeEnv = process.env.NODE_ENV;

  const keys: Array<{ keyId: string; publicKey: string }> = [];

  // Add production key if available
  if (envPublicKey) {
    keys.push({
      keyId: PROD_KEY_ID,
      publicKey: envPublicKey,
    });
  }

  // In dev mode, also accept ephemeral key if it exists
  if (nodeEnv !== 'production' && devPublicKey) {
    keys.push({
      keyId: DEV_KEY_ID,
      publicKey: devPublicKey,
    });
  }

  return keys;
}
