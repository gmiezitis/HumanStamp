import { generateKeyPair } from '@human-stamp/core';

let cachedPrivateKey: string | null = null;
let cachedPublicKey: string | null = null;

export async function getSigningKeys(): Promise<{ privateKey: string; publicKey: string }> {
  const envPrivateKey = process.env.SIGNING_PRIVATE_KEY;
  const envPublicKey = process.env.SIGNING_PUBLIC_KEY;

  if (envPrivateKey && envPublicKey) {
    return {
      privateKey: envPrivateKey,
      publicKey: envPublicKey,
    };
  }

  if (cachedPrivateKey && cachedPublicKey) {
    return {
      privateKey: cachedPrivateKey,
      publicKey: cachedPublicKey,
    };
  }

  console.warn('No signing keys in env, generating ephemeral keypair (DEV ONLY)');
  const keypair = await generateKeyPair();
  cachedPrivateKey = keypair.privateKey;
  cachedPublicKey = keypair.publicKey;

  return keypair;
}
