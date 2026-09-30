import { workflowLabels, type WorkflowStatus } from '@/lib/workflow';

const colors: Record<WorkflowStatus, string> = {
  draft: 'bg-stone-100 text-stone-700',
  'awaiting-review': 'bg-blue-50 text-blue-800',
  'changes-requested': 'bg-amber-50 text-amber-900',
  approved: 'bg-green-50 text-green-800',
  superseded: 'bg-stone-100 text-stone-600',
};

export function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  return (
    <span
      className={`inline-block rounded px-2 py-1 text-sm font-medium ${colors[status]}`}
    >
      {workflowLabels[status]}
    </span>
  );
}
