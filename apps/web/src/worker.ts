#!/usr/bin/env node

import { getQueue } from './lib/queue';
import { prisma } from './lib/prisma';
import { getStorage } from './lib/storage';
import { scanVideo, detectMismatch } from './lib/video-scan';
import { generateSegmentFingerprint } from './lib/segment-fingerprint';
import type { ProcessVideoJob, GenerateFingerprintJob, BurnLabelJob } from './lib/queue';

async function processVideo(job: ProcessVideoJob): Promise<void> {
  console.log(`Processing video for version ${job.versionId}`);

  const version = await prisma.version.findUnique({
    where: { id: job.versionId },
  });

  if (!version) {
    throw new Error(`Version ${job.versionId} not found`);
  }

  const storage = getStorage();
  const buffer = await storage.get(version.storageKey);

  const [scanResult, segmentFp] = await Promise.all([
    scanVideo(buffer),
    generateSegmentFingerprint(buffer),
  ]);

  const mismatch = detectMismatch(version.aiClaim, scanResult);

  await prisma.version.update({
    where: { id: version.id },
    data: {
      c2paPresent: scanResult.c2pa.found,
      c2paData: scanResult.c2pa.found ? JSON.stringify(scanResult.c2pa) : null,
      ffprobeData: JSON.stringify(scanResult.ffprobe),
      duration: scanResult.ffprobe.duration || version.duration,
      fingerprint: JSON.stringify(segmentFp),
    },
  });

  if (mismatch.hasMismatch) {
    console.warn(`Mismatch detected for version ${job.versionId}: ${mismatch.reason}`);
  }

  console.log(`Video processing complete for version ${job.versionId}`);
}

async function generateFingerprint(job: GenerateFingerprintJob): Promise<void> {
  console.log(`Generating fingerprint for version ${job.versionId}`);

  const version = await prisma.version.findUnique({
    where: { id: job.versionId },
  });

  if (!version) {
    throw new Error(`Version ${job.versionId} not found`);
  }

  console.log(`Fingerprint generation complete for version ${job.versionId}`);
}

async function burnLabel(job: BurnLabelJob): Promise<void> {
  console.log(`Burning label for version ${job.versionId}`);

  const version = await prisma.version.findUnique({
    where: { id: job.versionId },
    include: {
      project: true,
    },
  });

  if (!version) {
    throw new Error(`Version ${job.versionId} not found`);
  }

  const storage = getStorage();
  const inputBuffer = await storage.get(version.storageKey);

  const { burnLabel: burnLabelFn } = await import('./lib/label-burner');
  const outputBuffer = await burnLabelFn(inputBuffer, {
    labelType: job.labelType as any,
    corner: job.corner as any,
    durationSeconds: job.duration,
  });

  const { createHash } = await import('crypto');
  const sha256 = createHash('sha256').update(outputBuffer).digest('hex');

  const lastVersion = await prisma.version.findFirst({
    where: { projectId: version.projectId },
    orderBy: { versionNumber: 'desc' },
  });

  const newVersionNumber = (lastVersion?.versionNumber || 0) + 1;

  const { generateStorageKey } = await import('./lib/storage');
  const storageKey = generateStorageKey(
    job.workspaceId,
    version.projectId,
    `${version.filename.replace(/\.mp4$/, '')}-labeled.mp4`
  );

  await storage.put(storageKey, outputBuffer, 'video/mp4');

  const newVersion = await prisma.version.create({
    data: {
      projectId: version.projectId,
      versionNumber: newVersionNumber,
      sha256,
      storageKey,
      filename: `${version.filename.replace(/\.mp4$/, '')}-labeled.mp4`,
      fileSize: outputBuffer.length,
      aiClaim: version.aiClaim,
      c2paPresent: false,
    },
  });

  const { appendEvent } = await import('./lib/event-log');
  await appendEvent(
    job.workspaceId,
    'label.applied',
    'version',
    newVersion.id,
    { labelType: job.labelType, corner: job.corner, originalVersionId: job.versionId }
  );

  console.log(`Label burn complete for version ${job.versionId}, created version ${newVersion.id}`);
}

async function main() {
  console.log('Starting worker...');

  const queue = await getQueue();

  await queue.work<ProcessVideoJob>('process-video', async (job) => {
    try {
      await processVideo(job.data);
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }
  });

  await queue.work<GenerateFingerprintJob>('generate-fingerprint', async (job) => {
    try {
      await generateFingerprint(job.data);
    } catch (error) {
      console.error('Error generating fingerprint:', error);
      throw error;
    }
  });

  await queue.work<BurnLabelJob>('burn-label', async (job) => {
    try {
      await burnLabel(job.data);
    } catch (error) {
      console.error('Error burning label:', error);
      throw error;
    }
  });

  console.log('Worker ready');

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await queue.stop();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await queue.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Worker error:', error);
  process.exit(1);
});
