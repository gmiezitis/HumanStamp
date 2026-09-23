import { generateKeyPair, sign, verify, createReceiptPayload } from '../src/crypto';

describe('Ed25519 signing', () => {
  it('should generate valid keypair', async () => {
    const keypair = await generateKeyPair();
    
    expect(keypair.privateKey).toHaveLength(64);
    expect(keypair.publicKey).toHaveLength(64);
  });

  it('should sign and verify message', async () => {
    const keypair = await generateKeyPair();
    const message = 'test message';
    
    const signature = await sign(message, keypair.privateKey);
    const isValid = await verify(message, signature, keypair.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should fail verification with wrong message', async () => {
    const keypair = await generateKeyPair();
    const message = 'test message';
    
    const signature = await sign(message, keypair.privateKey);
    const isValid = await verify('wrong message', signature, keypair.publicKey);
    
    expect(isValid).toBe(false);
  });

  it('should fail verification with wrong public key', async () => {
    const keypair1 = await generateKeyPair();
    const keypair2 = await generateKeyPair();
    const message = 'test message';
    
    const signature = await sign(message, keypair1.privateKey);
    const isValid = await verify(message, signature, keypair2.publicKey);
    
    expect(isValid).toBe(false);
  });

  it('should create consistent receipt payload', () => {
    const id = 'test-id';
    const sha256 = 'abc123';
    const recipe = JSON.stringify({ mode: 'human', tools: [], approver: 'Alice' });
    const createdAt = '2026-01-01T00:00:00.000Z';
    
    const payload = createReceiptPayload(id, sha256, recipe, createdAt);
    
    expect(payload).toContain(id);
    expect(payload).toContain(sha256);
    expect(payload).toContain('human');
  });
});
