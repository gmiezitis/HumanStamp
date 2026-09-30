import { prisma } from './prisma';
import { getSigningKeys } from './keys';
import { sign } from '@human-stamp/core';
import { nanoid } from 'nanoid';
import {
  getWorkflowStatus,
  lockProject,
  WorkflowError,
  type WorkflowStatus,
} from './workflow';

export interface ReceiptPayload {
  workflowStatus?: WorkflowStatus;
  versionId: string;
  versionNumber: number;
  filename: string;
  sha256: string;
  fingerprint: string | null;
  aiClaim: string;
  c2paPresent: boolean;
  approvals: Array<{
    approverName: string | null;
    approverRole: string;
    company: string;
    createdAt: string;
  }>;
  clientSignOffs: Array<{
    decision: string;
    signerName: string;
    email: string;
    createdAt: string;
  }>;
  aiLabel?: {
    labelText: string;
    corner: string;
    appliedAt: string;
    labeledFileSha256: string;
  };
  project: {
    name: string;
    client: {
      name: string;
    };
  };
  eventChainHead: string | null;
  createdAt: string;
}

export async function generateReceipt(versionId: string): Promise<string> {
  const keys = await getSigningKeys();
  return prisma.$transaction(async (tx) => {
    const target = await tx.version.findUnique({
      where: { id: versionId },
      select: { projectId: true },
    });
    if (!target) throw new WorkflowError('Version not found', 404);
    await lockProject(tx, target.projectId);
    const version = await tx.version.findUnique({
      where: { id: versionId },
      include: {
        project: {
          include: {
            client: {
              include: {
                workspace: true,
              },
            },
            signOffs: {
              where: {
                usedAt: { not: null },
                versionId,
                cancelledAt: null,
              },
            },
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { versionNumber: true },
            },
          },
        },
        approvals: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    const reviews = await tx.clientSignOff.findMany({ where: { versionId } });
    const workflowStatus = getWorkflowStatus({
      versionNumber: version.versionNumber,
      latestVersionNumber: version.project.versions[0].versionNumber,
      approvalCount: version.approvals.length,
      signOffs: reviews,
    });
    if (workflowStatus !== 'approved')
      throw new WorkflowError(
        'A final receipt requires internal approval and all client reviews approved for the current version.'
      );

    const { getEventChainHead, getEventLog } = await import('./event-log');
    const eventChainHead = await getEventChainHead(
      version.project.client.workspaceId,
      tx
    );

    const events = await getEventLog(
      version.project.client.workspaceId,
      'version',
      version.id,
      tx
    );
    const labelEvent = events.find((e) => e.eventType === 'label.applied');

    let aiLabel = undefined;
    if (labelEvent) {
      const labelData = JSON.parse(labelEvent.data);
      const labeledVersionId = labelData.labeledVersionId;
      if (labeledVersionId) {
        const labeledVersion = await tx.version.findUnique({
          where: { id: labeledVersionId },
          select: { sha256: true },
        });
        if (labeledVersion) {
          aiLabel = {
            labelText: labelData.labelText,
            corner: labelData.corner,
            appliedAt: labelData.appliedAt,
            labeledFileSha256: labeledVersion.sha256,
          };
        }
      }
    }

    const payload: ReceiptPayload = {
      workflowStatus,
      versionId: version.id,
      versionNumber: version.versionNumber,
      filename: version.filename,
      sha256: version.sha256,
      fingerprint: version.fingerprint,
      aiClaim: version.aiClaim,
      c2paPresent: version.c2paPresent,
      approvals: version.approvals.map((a) => ({
        approverName: a.approverName,
        approverRole: a.approverRole,
        company: a.company,
        createdAt: a.createdAt.toISOString(),
      })),
      clientSignOffs: version.project.signOffs
        .filter((s) => s.decision)
        .map((s) => ({
          decision: s.decision!,
          signerName: s.signerName!,
          email: s.email,
          createdAt: s.usedAt!.toISOString(),
        })),
      aiLabel,
      project: {
        name: version.project.name,
        client: {
          name: version.project.client.name,
        },
      },
      eventChainHead,
      createdAt: new Date().toISOString(),
    };

    const payloadStr = JSON.stringify(payload);
    const signature = await sign(payloadStr, keys.privateKey);

    const receiptId = nanoid();

    await tx.receipt.create({
      data: {
        id: receiptId,
        versionId: version.id,
        signature,
        publicKey: keys.publicKey,
        keyId: keys.keyId,
        payloadVersion: 2,
        receiptData: payloadStr,
      },
    });

    return receiptId;
  });
}

export async function getReceipt(receiptId: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      version: {
        include: {
          project: {
            include: {
              client: true,
              versions: {
                orderBy: { versionNumber: 'desc' },
                take: 1,
                select: { versionNumber: true },
              },
            },
          },
          approvals: true,
          signOffs: true,
        },
      },
    },
  });

  return receipt;
}
