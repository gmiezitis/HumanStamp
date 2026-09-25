import { 
  generateKeyPair, 
  sign, 
  verify, 
  createReceiptPayload, 
  hashFile,
  StampRecipe 
} from '../src';

describe('Tampering detection', () => {
  let keypair: { privateKey: string; publicKey: string };
  let recipe: StampRecipe;
  let sha256: string;
  let fingerprint: string[];
  let id: string;
  let createdAt: string;

  beforeEach(async () => {
    keypair = await generateKeyPair();
    recipe = {
      mode: 'human',
      tools: ['CapCut', 'Premiere'],
      approver: 'Alice',
    };
    sha256 = hashFile(Buffer.from('test video data'));
    fingerprint = ['abc123', 'def456', 'ghi789'];
    id = 'test-stamp-id';
    createdAt = '2026-09-25T19:00:00.000Z';
  });

  describe('Fingerprint tampering', () => {
    it('should fail verification if fingerprint is modified', async () => {
      // Create stamp with original fingerprint
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Try to verify with tampered fingerprint
      const tamperedFingerprint = ['xxx999', 'yyy888', 'zzz777'];
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        tamperedFingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification if fingerprint is removed', async () => {
      // Create stamp with fingerprint
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Try to verify without fingerprint
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        undefined
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification if fingerprint is added after signing', async () => {
      // Create stamp without fingerprint
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        undefined
      );
      const signature = await sign(payload, keypair.privateKey);

      // Try to verify with added fingerprint
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Content hash tampering', () => {
    it('should fail verification if SHA-256 is modified', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Tamper with hash
      const tamperedHash = 'deadbeef' + sha256.slice(8);
      const tamperedPayload = createReceiptPayload(
        id, 
        tamperedHash, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Recipe claim tampering', () => {
    it('should fail verification if mode is changed', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Tamper with mode
      const tamperedRecipe = { ...recipe, mode: 'agent+human-approved' as const };
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(tamperedRecipe), 
        createdAt, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification if tools are changed', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Tamper with tools
      const tamperedRecipe = { ...recipe, tools: ['PhotoShop'] };
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(tamperedRecipe), 
        createdAt, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification if approver is changed', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Tamper with approver
      const tamperedRecipe = { ...recipe, approver: 'Bob' };
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(tamperedRecipe), 
        createdAt, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification if agentRoles are added', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Tamper by adding agentRoles
      const tamperedRecipe = { ...recipe, agentRoles: ['Code Review'] };
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(tamperedRecipe), 
        createdAt, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Timestamp tampering', () => {
    it('should fail verification if createdAt is modified', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Tamper with timestamp
      const tamperedTimestamp = '2026-09-26T19:00:00.000Z';
      const tamperedPayload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        tamperedTimestamp, 
        fingerprint
      );
      const isValid = await verify(tamperedPayload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Key tampering', () => {
    it('should fail verification with wrong public key', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);

      // Try to verify with different public key
      const otherKeypair = await generateKeyPair();
      const isValid = await verify(payload, signature, otherKeypair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification with signature from different key', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );

      // Sign with different keypair
      const otherKeypair = await generateKeyPair();
      const signature = await sign(payload, otherKeypair.privateKey);

      // Try to verify with original public key
      const isValid = await verify(payload, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Valid stamps', () => {
    it('should successfully verify a valid stamp with fingerprint', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const signature = await sign(payload, keypair.privateKey);
      const isValid = await verify(payload, signature, keypair.publicKey);

      expect(isValid).toBe(true);
    });

    it('should successfully verify a valid stamp without fingerprint', async () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        undefined
      );
      const signature = await sign(payload, keypair.privateKey);
      const isValid = await verify(payload, signature, keypair.publicKey);

      expect(isValid).toBe(true);
    });
  });

  describe('Payload version', () => {
    it('should include version in payload', () => {
      const payload = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );

      expect(payload).toContain('"v":1');
    });

    it('should maintain deterministic payload ordering', () => {
      const payload1 = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );
      const payload2 = createReceiptPayload(
        id, 
        sha256, 
        JSON.stringify(recipe), 
        createdAt, 
        fingerprint
      );

      expect(payload1).toBe(payload2);
    });
  });
});
