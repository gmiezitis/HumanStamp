import { prisma } from './prisma';
import { getSigningKeys } from './keys';
import { sign } from '@human-stamp/core';
import { nanoid } from 'nanoid';

export interface ReceiptPayload {
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
  const version = await prisma.version.findUnique({
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
            },
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

  const { getEventChainHead } = await import('./event-log');
  const eventChainHead = await getEventChainHead(version.project.client.workspaceId);

  const payload: ReceiptPayload = {
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
    project: {
      name: version.project.name,
      client: {
        name: version.project.client.name,
      },
    },
    eventChainHead,
    createdAt: version.createdAt.toISOString(),
  };

  const keys = await getSigningKeys();
  const payloadStr = JSON.stringify(payload);
  const signature = await sign(payloadStr, keys.privateKey);

  const receiptId = nanoid();

  await prisma.receipt.create({
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
            },
          },
          approvals: true,
        },
      },
    },
  });

  return receipt;
}
