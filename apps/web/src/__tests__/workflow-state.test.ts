import { describe, expect, it } from 'vitest';
import { getWorkflowStatus } from '../lib/workflow';

const pending = { decision: null, usedAt: null, cancelledAt: null };
const approved = { ...pending, usedAt: new Date(), decision: 'approved' };
const rejected = { ...approved, decision: 'changes-requested' };
const base = {
  versionNumber: 1,
  latestVersionNumber: 1,
  approvalCount: 0,
  signOffs: [],
};

describe('Exact-file approval states', () => {
  it('starts as a draft', () => expect(getWorkflowStatus(base)).toBe('draft'));
  it('does not confuse internal approval with final client approval', () =>
    expect(getWorkflowStatus({ ...base, approvalCount: 1 })).toBe('draft'));
  it('waits for requested client reviews', () =>
    expect(
      getWorkflowStatus({ ...base, approvalCount: 1, signOffs: [pending] })
    ).toBe('awaiting-review'));
  it('requires internal review even when the client approves', () =>
    expect(getWorkflowStatus({ ...base, signOffs: [approved] })).toBe(
      'awaiting-review'
    ));
  it('requires every client reviewer', () =>
    expect(
      getWorkflowStatus({
        ...base,
        approvalCount: 1,
        signOffs: [approved, pending],
      })
    ).toBe('awaiting-review'));
  it('approves only with internal and all client approvals', () =>
    expect(
      getWorkflowStatus({
        ...base,
        approvalCount: 1,
        signOffs: [approved, approved],
      })
    ).toBe('approved'));
  it('never overrides a request for changes', () =>
    expect(
      getWorkflowStatus({
        ...base,
        approvalCount: 10,
        signOffs: [rejected, approved],
      })
    ).toBe('changes-requested'));
  it('preserves history but supersedes all older files', () =>
    expect(
      getWorkflowStatus({
        ...base,
        latestVersionNumber: 2,
        approvalCount: 1,
        signOffs: [approved],
      })
    ).toBe('superseded'));
  it('does not count cancelled requests as approvals', () =>
    expect(
      getWorkflowStatus({
        ...base,
        approvalCount: 1,
        signOffs: [{ ...approved, cancelledAt: new Date() }],
      })
    ).toBe('draft'));
});
