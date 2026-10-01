import { getWorkflowStatus } from './workflow';

export type DemoState = {
  version: number;
  requested: boolean;
  internalApproved: boolean;
  decision: 'approved' | 'changes-requested' | null;
  recordOpen: boolean;
};
export type DemoAction =
  | 'approve'
  | 'request-changes'
  | 'open-record'
  | 'replace'
  | 'request-review'
  | 'reset';
export const initialDemoState: DemoState = {
  version: 1,
  requested: true,
  internalApproved: true,
  decision: null,
  recordOpen: false,
};

export function demoStatus(state: DemoState) {
  return getWorkflowStatus({
    versionNumber: state.version,
    latestVersionNumber: state.version,
    approvalCount: state.internalApproved ? 1 : 0,
    signOffs: state.requested
      ? [
          {
            usedAt: state.decision ? 'example-decision' : null,
            decision: state.decision,
            cancelledAt: null,
          },
        ]
      : [],
  });
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action === 'reset') return { ...initialDemoState };
  if (action === 'replace')
    return {
      version: state.version + 1,
      requested: false,
      internalApproved: false,
      decision: null,
      recordOpen: false,
    };
  if (action === 'request-review' && !state.requested)
    return { ...state, requested: true, internalApproved: true };
  if (
    (action === 'approve' || action === 'request-changes') &&
    state.requested &&
    !state.decision
  )
    return {
      ...state,
      decision: action === 'approve' ? 'approved' : 'changes-requested',
    };
  if (action === 'open-record' && demoStatus(state) === 'approved')
    return { ...state, recordOpen: true };
  return state;
}

export function demoRecord(state: DemoState) {
  if (demoStatus(state) !== 'approved') return null;
  return {
    example: true,
    signed: false,
    warning:
      'Illustrative demo only. This is not a real approval, signed receipt, or compliance certificate.',
    project: 'Spring campaign',
    filename: `spring-campaign-v${state.version}.mp4`,
    version: state.version,
    workflowStatus: 'approved',
    internalApproval: 'Example agency producer',
    clientDecision: state.decision,
    aiDisclosure: 'AI-assisted — example agency declaration',
    identityIndependentlyVerified: false,
  };
}
