import { hashFile, sign, verify, createReceiptPayload, generateKeyPair, StampRecipe } from '../src';

describe('Signature verification regression', () => {
  it('should verify signature of a freshly created stamp', async () => {
    const keypair = await generateKeyPair();
    const fileBuffer = Buffer.from('test video data');
    const sha256 = hashFile(fileBuffer);
    
    const recipe: StampRecipe = {
      mode: 'human',
      tools: ['CapCut', 'Premiere'],
      approver: 'Alice',
    };
    
    const id = 'test-stamp-id';
    const createdAt = '2026-09-23T13:00:00.000Z';
    const recipeJson = JSON.stringify(recipe);
    
    const payload = createReceiptPayload(id, sha256, recipeJson, createdAt);
    const signature = await sign(payload, keypair.privateKey);
    
    const verifyPayload = createReceiptPayload(id, sha256, recipeJson, createdAt);
    const isValid = await verify(verifyPayload, signature, keypair.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should verify signature with agent roles', async () => {
    const keypair = await generateKeyPair();
    const fileBuffer = Buffer.from('test video data');
    const sha256 = hashFile(fileBuffer);
    
    const recipe: StampRecipe = {
      mode: 'agent+human-approved',
      tools: ['Claude', 'GPT-4'],
      agentRoles: ['Code Review', 'Testing'],
      approver: 'Bob',
    };
    
    const id = 'test-stamp-id-2';
    const createdAt = '2026-09-23T13:00:00.000Z';
    const recipeJson = JSON.stringify(recipe);
    
    const payload = createReceiptPayload(id, sha256, recipeJson, createdAt, undefined);
    const signature = await sign(payload, keypair.privateKey);
    
    const verifyPayload = createReceiptPayload(id, sha256, recipeJson, createdAt, undefined);
    const isValid = await verify(verifyPayload, signature, keypair.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should fail verification with different recipe', async () => {
    const keypair = await generateKeyPair();
    const fileBuffer = Buffer.from('test video data');
    const sha256 = hashFile(fileBuffer);
    
    const recipe1: StampRecipe = {
      mode: 'human',
      tools: ['CapCut'],
      approver: 'Alice',
    };
    
    const recipe2: StampRecipe = {
      mode: 'human',
      tools: ['Premiere'],
      approver: 'Alice',
    };
    
    const id = 'test-stamp-id-3';
    const createdAt = '2026-09-23T13:00:00.000Z';
    
    const payload1 = createReceiptPayload(id, sha256, JSON.stringify(recipe1), createdAt, undefined);
    const signature = await sign(payload1, keypair.privateKey);
    
    const payload2 = createReceiptPayload(id, sha256, JSON.stringify(recipe2), createdAt, undefined);
    const isValid = await verify(payload2, signature, keypair.publicKey);
    
    expect(isValid).toBe(false);
  });
});
