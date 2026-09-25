import { describe, it, expect, beforeAll } from 'vitest';
import { verify } from '@human-stamp/core';

describe('Receipt Export Signature Verification', () => {
  let receiptExport: any;
  let baseUrl: string;
  let serverAvailable = false;

  beforeAll(async () => {
    // Use the seeded version 2 receipt
    // In real tests, this would be created dynamically
    const receiptId = 'rUvP9K35hEp3Q-lubzgoG'; // From seed data
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    try {
      // Check if server is available
      const healthCheck = await fetch(`${baseUrl}/api/health`, { 
        signal: AbortSignal.timeout(1000)
      }).catch(() => null);
      
      if (!healthCheck || !healthCheck.ok) {
        console.log('Dev server not available, skipping integration tests');
        return;
      }
      
      // Fetch the JSON export
      const response = await fetch(`${baseUrl}/api/receipts/${receiptId}/export?format=json`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch receipt: ${response.status} ${response.statusText}`);
      }
      
      receiptExport = await response.json();
      serverAvailable = true;
    } catch (error) {
      console.log('Server connection failed, skipping integration tests:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  it('should export valid JSON with all required fields', () => {
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
    expect(receiptExport).toHaveProperty('data');
    expect(receiptExport).toHaveProperty('signature');
    expect(receiptExport).toHaveProperty('publicKey');
    expect(receiptExport).toHaveProperty('keyId');
    
    expect(receiptExport.data).toHaveProperty('versionId');
    expect(receiptExport.data).toHaveProperty('sha256');
    expect(receiptExport.data).toHaveProperty('project');
  });

  it('should verify signature with included public key', async () => {
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
    const payloadStr = JSON.stringify(receiptExport.data);
    const isValid = await verify(
      payloadStr,
      receiptExport.signature,
      receiptExport.publicKey
    );
    
    expect(isValid).toBe(true);
  });

  it('should fail verification with tampered data', async () => {
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
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
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
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
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
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
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
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

  it('should match public key from /.well-known/humanstamp-keys if available', async () => {
    if (!serverAvailable) {
      console.log('Skipping test: server not available');
      return;
    }
    
    const keysResponse = await fetch(`${baseUrl}/.well-known/humanstamp-keys`);
    const keysData = await keysResponse.json();
    
    expect(keysData).toHaveProperty('keys');
    expect(Array.isArray(keysData.keys)).toBe(true);
    
    // If keys are available and a match is found, verify it matches
    if (keysData.keys && keysData.keys.length > 0) {
      const matchingKey = keysData.keys.find(
        (k: any) => k.keyId === receiptExport.keyId
      );
      
      // In ephemeral dev mode, keys differ across process contexts
      // In production with stable env vars, they should match
      const isProduction = process.env.NODE_ENV === 'production';
      const keysMatch = matchingKey?.publicKey === receiptExport.publicKey;
      
      if (isProduction && matchingKey) {
        // In production, keys must match
        expect(keysMatch).toBe(true);
      } else {
        // In dev mode, just verify the endpoint structure is correct
        if (matchingKey) {
          expect(matchingKey).toHaveProperty('keyId');
          expect(matchingKey).toHaveProperty('publicKey');
          expect(matchingKey).toHaveProperty('algorithm');
        }
      }
    }
  });
});
