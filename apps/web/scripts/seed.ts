#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function generateSampleVideo(filename: string, duration: number, text: string): Promise<Buffer> {
  const tmpDir = '/tmp/humanstamp-seed';
  mkdirSync(tmpDir, { recursive: true });
  
  const outputPath = join(tmpDir, filename);

  const ffmpegCmd = `ffmpeg -y -f lavfi -i color=c=blue:s=1280x720:d=${duration} \
    -vf "drawtext=text='${text}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputPath}`;

  console.log(`Generating video: ${filename}`);
  execSync(ffmpegCmd, { stdio: 'ignore' });

  const buffer = readFileSync(outputPath);
  console.log(`Generated ${filename}: ${buffer.length} bytes`);
  
  return buffer;
}

async function main() {
  console.log('Starting seed...');

  console.log('Cleaning existing data...');
  await prisma.eventLog.deleteMany({});
  await prisma.receipt.deleteMany({});
  await prisma.approval.deleteMany({});
  await prisma.clientSignOff.deleteMany({});
  await prisma.version.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.workspaceMembership.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Creating demo user...');
  const user = await prisma.user.create({
    data: {
      email: 'demo@humanstamp.test',
      name: 'Demo User',
    },
  });

  console.log('Creating workspace: Demo Agency...');
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Agency',
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
      data: JSON.stringify({ name: 'Demo Agency' }),
      previousHash: null,
      eventHash: createHash('sha256')
        .update(JSON.stringify({ name: 'Demo Agency', timestamp: new Date() }))
        .digest('hex'),
    },
  });

  console.log('Creating client: Euronics-like Brand...');
  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: 'Euronics-like Brand',
    },
  });

  console.log('Creating project: Autumn Campaign...');
  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: 'Autumn Campaign',
    },
  });

  console.log('Generating sample videos...');
  
  const v1Buffer = await generateSampleVideo('v1.mp4', 5, 'Version 1 - Original');
  const v1Hash = createHash('sha256').update(v1Buffer).digest('hex');

  console.log('Creating version 1...');
  const version1 = await prisma.version.create({
    data: {
      projectId: project.id,
      versionNumber: 1,
      sha256: v1Hash,
      storageKey: `demo/${project.id}/v1.mp4`,
      filename: 'autumn-campaign-v1.mp4',
      fileSize: v1Buffer.length,
      duration: 5.0,
      aiClaim: 'human',
      c2paPresent: false,
    },
  });

  const v2Buffer = await generateSampleVideo('v2.mp4', 5, 'Version 2 - Edited');
  const v2Hash = createHash('sha256').update(v2Buffer).digest('hex');

  console.log('Creating version 2...');
  const version2 = await prisma.version.create({
    data: {
      projectId: project.id,
      versionNumber: 2,
      sha256: v2Hash,
      storageKey: `demo/${project.id}/v2.mp4`,
      filename: 'autumn-campaign-v2.mp4',
      fileSize: v2Buffer.length,
      duration: 5.0,
      aiClaim: 'human',
      c2paPresent: false,
    },
  });

  console.log('Creating approval for version 2...');
  await prisma.approval.create({
    data: {
      versionId: version2.id,
      userId: user.id,
      approverName: 'Alice Johnson',
      approverRole: 'Creative Director',
      company: 'Demo Agency',
    },
  });

  console.log('Creating client sign-off...');
  await prisma.clientSignOff.create({
    data: {
      projectId: project.id,
      versionId: version2.id,
      token: 'demo-signoff-token-123',
      email: 'client@euronics.test',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('\n✅ Seed complete!');
  console.log('\nDemo credentials:');
  console.log('Email: demo@humanstamp.test');
  console.log('\nWorkspace: Demo Agency');
  console.log('Client: Euronics-like Brand');
  console.log('Project: Autumn Campaign');
  console.log('Versions: 2 (v1 original, v2 edited and approved)');
  console.log('\nSign-off link: /signoff/demo-signoff-token-123');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
