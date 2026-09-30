import type { Prisma } from '@prisma/client';

export type WorkflowStatus =
  | 'draft'
  | 'awaiting-review'
  | 'changes-requested'
  | 'approved'
  | 'superseded';

export const workflowLabels: Record<WorkflowStatus, string> = {
  draft: 'Draft',
  'awaiting-review': 'Awaiting review',
  'changes-requested': 'Changes requested',
  approved: 'Approved',
  superseded: 'Superseded',
};

interface Decision {
  usedAt: Date | string | null;
  decision: string | null;
  cancelledAt: Date | string | null;
}

// Derive status from exact-version records rather than maintaining a second,
// possibly stale approval flag. Both internal and all requested client reviews
// are required for final approval. Expiry does not turn a pending review green.
export function getWorkflowStatus(input: {
  versionNumber: number;
  latestVersionNumber: number;
  approvalCount: number;
  signOffs: Decision[];
}): WorkflowStatus {
  if (input.versionNumber < input.latestVersionNumber) return 'superseded';
  const reviews = input.signOffs.filter((s) => !s.cancelledAt);
  if (reviews.some((s) => s.usedAt && s.decision === 'changes-requested'))
    return 'changes-requested';
  if (!reviews.length) return 'draft';
  if (
    input.approvalCount > 0 &&
    reviews.every((s) => s.usedAt && s.decision === 'approved')
  )
    return 'approved';
  return 'awaiting-review';
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 409
  ) {
    super(message);
  }
}

// Serialize version allocation, invitations and decisions for one project.
// New uploads cannot race an approval into being applied to the wrong file.
export async function lockProject(
  tx: Prisma.TransactionClient,
  projectId: string
) {
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
}

export async function requireCurrentVersion(
  tx: Prisma.TransactionClient,
  versionId: string,
  projectId: string
) {
  const version = await tx.version.findUnique({ where: { id: versionId } });
  const latest = await tx.version.findFirst({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
  });
  if (!version || version.projectId !== projectId)
    throw new WorkflowError('Version does not belong to this project', 400);
  if (latest?.id !== versionId)
    throw new WorkflowError(
      'This version has been superseded. Review the current version instead.'
    );
  return version;
}
