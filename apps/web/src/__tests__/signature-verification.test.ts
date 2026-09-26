import { describe, it, expect } from 'vitest';
import { sign, verify } from '@human-stamp/core';
import { generateKeyPair } from '@human-stamp/core';

describe('Signature Verification', () => {
  it('should verify a valid signature', async () => {
    const keys = await generateKeyPair();
    const data = 'test data';

    const signature = await sign(Buffer.from(data), keys.privateKey);
    const isValid = await verify(data, signature, keys.publicKey);

    expect(isValid).toBe(true);
  });

  it('should reject an invalid signature', async () => {
    const keys = await generateKeyPair();
    const data = 'test data';
    const tamperedData = 'tampered data';

    const signature = await sign(Buffer.from(data), keys.privateKey);
    const isValid = await verify(tamperedData, signature, keys.publicKey);

    expect(isValid).toBe(false);
  });

  it('should reject signature from wrong key', async () => {
    const keys1 = await generateKeyPair();
    const keys2 = await generateKeyPair();
    const data = 'test data';

    const signature = await sign(Buffer.from(data), keys1.privateKey);
    const isValid = await verify(data, signature, keys2.publicKey);

    expect(isValid).toBe(false);
  });
});
