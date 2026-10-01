import { describe, expect, it } from 'vitest';
import {
  demoReducer,
  demoRecord,
  demoStatus,
  initialDemoState,
} from '../lib/agency-demo';

describe('honest agency demo', () => {
  it('starts with an example review, not a completed approval', () => {
    expect(demoStatus(initialDemoState)).toBe('awaiting-review');
    expect(demoRecord(initialDemoState)).toBeNull();
  });
  it('opens and exports only an approved, explicitly unsigned example', () => {
    const state = demoReducer(
      demoReducer(initialDemoState, 'approve'),
      'open-record'
    );
    expect(state.recordOpen).toBe(true);
    expect(demoStatus(state)).toBe('approved');
    expect(demoRecord(state)).toMatchObject({
      example: true,
      signed: false,
      identityIndependentlyVerified: false,
      version: 1,
    });
  });
  it('changes requests cannot create a handoff', () => {
    const state = demoReducer(initialDemoState, 'request-changes');
    expect(demoStatus(state)).toBe('changes-requested');
    expect(demoReducer(state, 'open-record').recordOpen).toBe(false);
    expect(demoRecord(state)).toBeNull();
  });
  it('replacements erase current decisions but do not pretend to be approved', () => {
    const state = demoReducer(
      demoReducer(initialDemoState, 'approve'),
      'replace'
    );
    expect(state).toMatchObject({
      version: 2,
      requested: false,
      internalApproved: false,
      decision: null,
    });
    expect(demoStatus(state)).toBe('draft');
    expect(demoRecord(state)).toBeNull();
    expect(demoReducer(state, 'approve')).toEqual(state);
  });
  it('replacement can begin a fresh review and resets cleanly', () => {
    const state = demoReducer(
      demoReducer(initialDemoState, 'replace'),
      'request-review'
    );
    expect(demoStatus(state)).toBe('awaiting-review');
    expect(demoStatus(demoReducer(state, 'approve'))).toBe('approved');
    expect(demoReducer(state, 'reset')).toEqual(initialDemoState);
  });
  it('a recorded decision cannot be silently changed', () => {
    const state = demoReducer(initialDemoState, 'approve');
    expect(demoReducer(state, 'request-changes')).toEqual(state);
  });
});
