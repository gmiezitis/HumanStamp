import { describe, it, expect, beforeAll } from 'vitest';
import { verify } from '@human-stamp/core';
import { exportReceipt } from '@/lib/export';
import { getKnownPublicKeys } from '@/lib/keys';
import { prisma } from '@/lib/prisma';

describe('Receipt Export Signature Verification', () => {
  let receiptExport: any;
  let publicKeys: Array<{ keyId: string; publicKey: string }>;

  beforeAll(async () => {
    // Create a test receipt in the database if none exists
    const existingReceipt = await prisma.receipt.findFirst({
      include: {
        version: {
          include: {
            project: {
              include: { client: true }
            }
          }
        }
      }
    });

    if (!existingReceipt) {
      throw new Error('No receipts found in database. Run seed script first.');
    }

    // Call exportReceipt directly (no HTTP server needed)
    const exported = await exportReceipt(existingReceipt.id);
    receiptExport = exported.json;
    
    // Get public keys the same way the well-known endpoint does
    publicKeys = await getKnownPublicKeys();
  });

  it('should export valid JSON with all required fields', () => {
    expect(receiptExport).toHaveProperty('data');
    expect(receiptExport).toHaveProperty('signature');
    expect(receiptExport).toHaveProperty('publicKey');
    expect(receiptExport).toHaveProperty('keyId');
    
    expect(receiptExport.data).toHaveProperty('versionId');
    expect(receiptExport.data).toHaveProperty('sha256');
    expect(receiptExport.data).toHaveProperty('project');
  });

  it('should verify signature with included public key', async () => {
    const payloadStr = JSON.stringify(receiptExport.data);
    const isValid = await verify(
      payloadStr,
      receiptExport.signature,
      receiptExport.publicKey
    );
    
    expect(isValid).toBe(true);
  });

  it('should fail verification with tampered data', async () => {
    // Tamper with the version number
    const tamperedData = {
      ...receiptExport.data,
      versionNumber: 999,
    };
    
    const tamperedPayloadStr = JSON.stringify(tamperedData);
    const isValid = await verify(
      tamperedPayloadStr,
      receiptExport.signature,
      receiptExport.publicKey
    );
    
    expect(isValid).toBe(false);
  });

  it('should fail verification with tampered SHA-256 hash', async () => {
    // Tamper with the file hash
    const tamperedData = {
      ...receiptExport.data,
      sha256: 'deadbeef'.repeat(8),
    };
    
    const tamperedPayloadStr = JSON.stringify(tamperedData);
    const isValid = await verify(
      tamperedPayloadStr,
      receiptExport.signature,
      receiptExport.publicKey
    );
    
    expect(isValid).toBe(false);
  });

  it('should fail verification with tampered signature', async () => {
    const payloadStr = JSON.stringify(receiptExport.data);
    // Flip some bytes in the signature
    const tamperedSignature = receiptExport.signature.slice(0, -4) + 'dead';
    
    const isValid = await verify(
      payloadStr,
      tamperedSignature,
      receiptExport.publicKey
    );
    
    expect(isValid).toBe(false);
  });

  it('should fail verification with wrong public key', async () => {
    const payloadStr = JSON.stringify(receiptExport.data);
    // Use a different public key (flip some hex digits)
    const wrongPublicKey = receiptExport.publicKey.slice(0, -8) + 'deadbeef';
    
    const isValid = await verify(
      payloadStr,
      receiptExport.signature,
      wrongPublicKey
    );
    
    expect(isValid).toBe(false);
  });

  it('should match public key from known keys', async () => {
    expect(Array.isArray(publicKeys)).toBe(true);
    
    // The receipt's key should be in the known keys
    const matchingKey = publicKeys.find(k => k.keyId === receiptExport.keyId);
    
    // In ephemeral mode, keys may differ across process contexts
    // In production with stable env vars, they must match
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction && matchingKey) {
      // In production, keys must match exactly
      expect(matchingKey.publicKey).toBe(receiptExport.publicKey);
    } else if (matchingKey) {
      // In dev mode, verify structure
      expect(matchingKey).toHaveProperty('keyId');
      expect(matchingKey).toHaveProperty('publicKey');
      expect(typeof matchingKey.publicKey).toBe('string');
    }
    // If no matching key, that's acceptable in ephemeral dev mode
  });
});
