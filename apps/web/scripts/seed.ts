#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { scanVideo, detectMismatch } from '../src/lib/video-scan';
import { generateSegmentFingerprint } from '../src/lib/segment-fingerprint';
import { sign, generateKeyPair } from '@human-stamp/core';
import { burnLabel } from '../src/lib/label-burner';

const prisma = new PrismaClient();

async function generateSampleVideo(
  filename: string, 
  duration: number, 
  text: string, 
  color: string = 'blue',
  flashStart?: number,
  flashEnd?: number
): Promise<Buffer> {
  const tmpDir = '/tmp/humanstamp-seed';
  mkdirSync(tmpDir, { recursive: true });
  
  const outputPath = join(tmpDir, filename);

  let videoFilter = `drawtext=text='${text}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`;
  
  // Add white flash overlay for specific time spans to create detectable differences
  if (flashStart !== undefined && flashEnd !== undefined) {
    videoFilter += `,drawbox=x=0:y=0:w=iw:h=ih:color=white@0.5:t=fill:enable='between(t,${flashStart},${flashEnd})'`;
  }

  const ffmpegCmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=1280x720:d=${duration} \
    -vf "${videoFilter}" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputPath}`;

  console.log(`Generating video: ${filename}`);
  execSync(ffmpegCmd, { stdio: 'ignore' });

  const buffer = readFileSync(outputPath);
  console.log(`Generated ${filename}: ${buffer.length} bytes`);
  
  return buffer;
}

async function main() {
  console.log('Starting idempotent seed...');
  console.log('NOTE: Seed is idempotent and safe to run multiple times\n');

  let user = await prisma.user.findUnique({
    where: { email: 'demo@humanstamp.test' },
  });

  if (user) {
    console.log('Demo user exists. Cleaning their data...');
    
    const workspaces = await prisma.workspace.findMany({
      where: {
        memberships: {
          some: { userId: user.id },
        },
      },
    });

    for (const workspace of workspaces) {
      await prisma.eventLog.deleteMany({ where: { workspaceId: workspace.id } });
      
      const clients = await prisma.client.findMany({ where: { workspaceId: workspace.id } });
      for (const client of clients) {
        const projects = await prisma.project.findMany({ where: { clientId: client.id } });
        for (const project of projects) {
          await prisma.receipt.deleteMany({ where: { version: { projectId: project.id } } });
          await prisma.approval.deleteMany({ where: { version: { projectId: project.id } } });
          await prisma.clientSignOff.deleteMany({ where: { projectId: project.id } });
          await prisma.version.deleteMany({ where: { projectId: project.id } });
        }
        await prisma.project.deleteMany({ where: { clientId: client.id } });
      }
      await prisma.client.deleteMany({ where: { workspaceId: workspace.id } });
      await prisma.workspaceMembership.deleteMany({ where: { workspaceId: workspace.id } });
    }
    await prisma.workspace.deleteMany({
      where: {
        memberships: {
          some: { userId: user.id },
        },
      },
    });

    console.log('Existing demo data cleaned.');
  } else {
    console.log('Creating demo user...');
    user = await prisma.user.create({
      data: {
        email: 'demo@humanstamp.test',
        name: 'Demo User',
      },
    });
  }

  console.log('Creating workspace: Nordic Creative Agency...');
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Nordic Creative Agency',
      memberships: {
        create: {
          userId: user.id,
          role: 'owner',
        },
      },
    },
  });

  await prisma.eventLog.create({
    data: {
      workspaceId: workspace.id,
      eventType: 'workspace.created',
      entityType: 'workspace',
      entityId: workspace.id,
      actorId: user.id,
      data: JSON.stringify({ name: 'Nordic Creative Agency' }),
      previousHash: null,
      eventHash: createHash('sha256')
        .update(JSON.stringify({ name: 'Nordic Creative Agency', timestamp: new Date() }))
        .digest('hex'),
    },
  });

  console.log('Creating client: TechNordic AB...');
  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'TechNordic AB',
    },
  });

  console.log('Creating project: Winter Product Launch...');
  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: 'Winter Product Launch',
    },
  });

  console.log('Generating sample videos with AI assistance...');
  
  // V1: Original draft (no flash)
  const v1Buffer = await generateSampleVideo('demo-v1.mp4', 8, 'Version 1\\nAI Draft', 'navy');
  const v1Hash = createHash('sha256').update(v1Buffer).digest('hex');

  console.log('Creating version 1...');
  const version1 = await prisma.version.create({
    data: {
      projectId: project.id,
      versionNumber: 1,
      sha256: v1Hash,
      storageKey: `demo/${project.id}/v1.mp4`,
      filename: 'winter-launch-v1.mp4',
      fileSize: v1Buffer.length,
      duration: 8.0,
      aiClaim: 'ai-assisted',
      c2paPresent: false,
    },
  });

  console.log('Processing version 1...');
  const [scanResult1, segmentFp1] = await Promise.all([
    scanVideo(v1Buffer),
    generateSegmentFingerprint(v1Buffer),
  ]);

  await prisma.version.update({
    where: { id: version1.id },
    data: {
      c2paPresent: scanResult1.c2pa.found,
      c2paData: scanResult1.c2pa.found ? JSON.stringify(scanResult1.c2pa) : null,
      ffprobeData: JSON.stringify(scanResult1.ffprobe),
      duration: scanResult1.ffprobe.duration || version1.duration,
      fingerprint: JSON.stringify(segmentFp1),
    },
  });

  // V2: Identical to v3 except for highlight timing (for clean compare demo)
  const v2Buffer = await generateSampleVideo('demo-v2.mp4', 8, 'Version 2\\nAI Enhanced', 'navy', null, null);
  const v2Hash = createHash('sha256').update(v2Buffer).digest('hex');

  console.log('Creating version 2...');
  const version2 = await prisma.version.create({
    data: {
      projectId: project.id,
      versionNumber: 2,
      sha256: v2Hash,
      storageKey: `demo/${project.id}/v2.mp4`,
      filename: 'winter-launch-v2.mp4',
      fileSize: v2Buffer.length,
      duration: 8.0,
      aiClaim: 'ai-assisted',
      c2paPresent: false,
    },
  });

  console.log('Processing version 2...');
  const [scanResult2, segmentFp2] = await Promise.all([
    scanVideo(v2Buffer),
    generateSegmentFingerprint(v2Buffer),
  ]);

  await prisma.version.update({
    where: { id: version2.id },
    data: {
      c2paPresent: scanResult2.c2pa.found,
      c2paData: scanResult2.c2pa.found ? JSON.stringify(scanResult2.c2pa) : null,
      ffprobeData: JSON.stringify(scanResult2.ffprobe),
      duration: scanResult2.ffprobe.duration || version2.duration,
      fingerprint: JSON.stringify(segmentFp2),
    },
  });

  console.log('Creating approval for version 2...');
  await prisma.approval.create({
    data: {
      versionId: version2.id,
      userId: user.id,
      approverName: 'Lars Andersson',
      approverRole: 'Creative Director',
      company: 'Nordic Creative Agency',
    },
  });

  // V3: Modified highlight at 4.5-6.5s (different from V2, shows changed span)
  const v3Buffer = await generateSampleVideo('demo-v3.mp4', 8, 'Version 3\\nAI Final', 'navy', 4.5, 6.5);
  const v3Hash = createHash('sha256').update(v3Buffer).digest('hex');

  console.log('Creating version 3 (final)...');
  const version3 = await prisma.version.create({
    data: {
      projectId: project.id,
      versionNumber: 3,
      sha256: v3Hash,
      storageKey: `demo/${project.id}/v3-final.mp4`,
      filename: 'winter-launch-v3-final.mp4',
      fileSize: v3Buffer.length,
      duration: 8.0,
      aiClaim: 'ai-generated',
      c2paPresent: false,
    },
  });

  console.log('Processing version 3...');
  const [scanResult3, segmentFp3] = await Promise.all([
    scanVideo(v3Buffer),
    generateSegmentFingerprint(v3Buffer),
  ]);

  await prisma.version.update({
    where: { id: version3.id },
    data: {
      c2paPresent: scanResult3.c2pa.found,
      c2paData: scanResult3.c2pa.found ? JSON.stringify(scanResult3.c2pa) : null,
      ffprobeData: JSON.stringify(scanResult3.ffprobe),
      duration: scanResult3.ffprobe.duration || version3.duration,
      fingerprint: JSON.stringify(segmentFp3),
    },
  });

  console.log('Creating approvals for version 3...');
  await prisma.approval.create({
    data: {
      versionId: version3.id,
      userId: user.id,
      approverName: 'Lars Andersson',
      approverRole: 'Creative Director',
      company: 'Nordic Creative Agency',
    },
  });

  await prisma.approval.create({
    data: {
      versionId: version3.id,
      userId: user.id,
      approverName: 'Ingrid Svensson',
      approverRole: 'Account Manager',
      company: 'Nordic Creative Agency',
    },
  });

  console.log('Creating client sign-off for version 3...');
  const signOff = await prisma.clientSignOff.create({
    data: {
      projectId: project.id,
      versionId: version3.id,
      token: 'demo-signoff-v3-token',
      email: 'client@technordic.example',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usedAt: new Date(),
      decision: 'approved',
      signerName: 'Erik Johansson',
      comment: 'Perfect! Ready to launch.',
    },
  });

  console.log('Creating pending sign-off for version 2...');
  await prisma.clientSignOff.create({
    data: {
      projectId: project.id,
      versionId: version2.id,
      token: 'demo-signoff-v2-pending',
      email: 'client@technordic.example',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Generating AI disclosure label for version 3...');
  const labeledV3Buffer = await burnLabel(v3Buffer, {
    labelText: 'AI-GENERATED',
    corner: 'top-left',
    durationSeconds: 3,
  });
  const labeledV3Hash = createHash('sha256').update(labeledV3Buffer).digest('hex');
  console.log(`Labeled video generated: ${labeledV3Buffer.length} bytes, SHA: ${labeledV3Hash.substring(0, 16)}...`);

  // Store labeled video as a file
  const labeledFilename = `winter-launch-v3-final-labeled.mp4`;
  const labeledStorageKey = `${workspace.id}/${project.id}/labeled-${labeledV3Hash.substring(0, 16)}.mp4`;
  await writeFile(path.join(storagePath, labeledStorageKey), labeledV3Buffer);
  
  // Create labeled version record
  const labeledVersion = await prisma.version.create({
    data: {
      projectId: project.id,
      versionNumber: 4,
      filename: labeledFilename,
      sha256: labeledV3Hash,
      fingerprint: null,
      aiClaim: 'ai-generated',
      c2paPresent: false,
      storageKey: labeledStorageKey,
      duration: 8,
    },
  });
  console.log(`Labeled version created: ${labeledVersion.id}`);

  // Log label event
  await prisma.eventLog.create({
    data: {
      workspaceId: workspace.id,
      entityType: 'version',
      entityId: version3.id,
      eventType: 'label.applied',
      eventHash: createHash('sha256').update(JSON.stringify({ 
        labelText: 'AI-GENERATED', 
        corner: 'top-left',
        timestamp: new Date().toISOString() 
      })).digest('hex'),
      data: JSON.stringify({
        labelText: 'AI-GENERATED',
        corner: 'top-left',
        appliedAt: new Date().toISOString(),
        originalVersionId: version3.id,
        labeledVersionId: labeledVersion.id,
      }),
    },
  });

  console.log('Generating receipt for version 3...');
  const { getSigningKeys } = await import('../src/lib/keys');
  const keys = await getSigningKeys();

  const approvals = await prisma.approval.findMany({
    where: { versionId: version3.id },
  });

  const clientSignOffs = await prisma.clientSignOff.findMany({
    where: { projectId: project.id, versionId: version3.id, usedAt: { not: null } },
  });

  const eventChain = await prisma.eventLog.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
  });

  const receiptPayload = {
    payloadVersion: 1,
    project: {
      name: project.name,
      client: {
        name: client.name,
      },
    },
    versionNumber: version3.versionNumber,
    filename: version3.filename,
    sha256: version3.sha256,
    aiClaim: version3.aiClaim,
    c2paPresent: version3.c2paPresent,
    approvals: approvals.map(a => ({
      approverName: a.approverName,
      approverRole: a.approverRole,
      company: a.company,
      createdAt: a.createdAt.toISOString(),
    })),
    clientSignOffs: clientSignOffs.map(s => ({
      email: s.email,
      signerName: s.signerName,
      decision: s.decision,
      comment: s.comment,
      createdAt: s.createdAt.toISOString(),
    })),
    aiLabel: {
      labelText: 'AI-GENERATED',
      corner: 'top-left',
      appliedAt: new Date().toISOString(),
      labeledFileSha256: labeledV3Hash,
      labeledVersionId: labeledVersion.id,
    },
    eventChainHead: eventChain?.eventHash || null,
    createdAt: new Date().toISOString(),
  };

  const receiptData = JSON.stringify(receiptPayload);
  const signature = await sign(receiptData, keys.privateKey);

  const receipt = await prisma.receipt.create({
    data: {
      versionId: version3.id,
      signature,
      publicKey: keys.publicKey,
      keyId: 'demo-key-1',
      payloadVersion: 1,
      receiptData,
    },
  });

  console.log('\n✅ Seed complete! Demo data is ready.');
  console.log('\nDemo credentials:');
  console.log('  Email: demo@humanstamp.test');
  console.log('\nDemo workspace:');
  console.log('  Workspace: Nordic Creative Agency');
  console.log('  Client: TechNordic AB');
  console.log('  Project: Winter Product Launch');
  console.log('  Versions: 3 (v1 draft, v2 edited, v3 final approved)');
  console.log('\nDemo links:');
  console.log(`  Receipt: /r/${receipt.id}`);
  console.log('  Client sign-off (pending): /signoff/demo-signoff-v2-pending');
  console.log('  Client sign-off (completed): /signoff/demo-signoff-v3-token');
  console.log('\nRun again to reset demo data (idempotent).');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
