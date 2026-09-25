/**
 * Human Stamp Core Types
 * Dual-trust: separate tool/stack claims from human approval
 */

export type StampMode = 'human' | 'human+ai' | 'agent+human-approved';

export interface StampRecipe {
  mode: StampMode;
  tools: string[];
  agentRoles?: string[];
  approver: string;
}

export interface StampReceipt {
  id: string;
  sha256: string;
  recipe: StampRecipe;
  createdAt: string;
  signature: string;
  publicKey: string;
  fingerprint?: string[];
  keyId?: string;
  payloadVersion?: number;
}

export interface CreateStampInput {
  sha256: string;
  recipe: StampRecipe;
  fingerprint?: string[];
}

export type VerifyMatchType = 'exact' | 'fingerprint' | 'none';

export interface VerifyResult {
  valid: boolean;
  receipt: StampReceipt | null;
  matchType?: VerifyMatchType;
  similarity?: number;
  error?: string;
}
