#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const RUN_WORKER_IN_PROCESS = process.env.RUN_WORKER_IN_PROCESS === 'true';

async function runMigrations() {
  console.log('Running database migrations...');
  
  const prismaBin = path.join(__dirname, '..', '..', '..', 'node_modules', 'prisma', 'build', 'index.js');
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  
  try {
    execSync(`node ${prismaBin} migrate deploy --schema=${schemaPath}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.warn('Migration failed, trying db push for development...');
    try {
      execSync(`node ${prismaBin} db push --skip-generate --schema=${schemaPath}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('DB push completed successfully');
    } catch (pushError) {
      console.error('DB push failed:', pushError);
      throw pushError;
    }
  }
}

async function runSeedIfEmpty() {
  console.log('Checking if database needs seeding...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      console.log('Database is empty, running seed script...');
      const tsxBin = path.join(__dirname, '..', '..', '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
      const seedScript = path.join(__dirname, '..', 'scripts', 'seed.ts');
      execSync(`node ${tsxBin} ${seedScript}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('Seed completed successfully');
    } else {
      console.log(`Database already has ${userCount} user(s), skipping seed`);
    }
  } catch (error) {
    console.error('Seed check/run failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function startWorkerInProcess() {
  console.log('Starting in-process worker...');
  
  const { getQueue } = require('./apps/web/src/lib/queue');
  const { prisma: workerPrisma } = require('./apps/web/src/lib/prisma');
  const { getStorage } = require('./apps/web/src/lib/storage');
  const { scanVideo, detectMismatch } = require('./apps/web/src/lib/video-scan');
  const { generateSegmentFingerprint } = require('./apps/web/src/lib/segment-fingerprint');
  
  async function processVideo(job) {
    console.log(`Processing video for version ${job.versionId}`);

    const version = await workerPrisma.version.findUnique({
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

    await workerPrisma.version.update({
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

  async function burnLabel(job) {
    console.log(`Burning label for version ${job.versionId}`);

    const version = await workerPrisma.version.findUnique({
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

    const { burnLabel: burnLabelFn } = require('./apps/web/src/lib/label-burner');
    const outputBuffer = await burnLabelFn(inputBuffer, {
      labelText: job.labelText,
      corner: job.corner,
      durationSeconds: job.duration,
    });

    const { createHash } = require('crypto');
    const sha256 = createHash('sha256').update(outputBuffer).digest('hex');

    const lastVersion = await workerPrisma.version.findFirst({
      where: { projectId: version.projectId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (lastVersion?.versionNumber || 0) + 1;

    const { generateStorageKey } = require('./apps/web/src/lib/storage');
    const storageKey = generateStorageKey(
      job.workspaceId,
      version.projectId,
      `${version.filename.replace(/\.mp4$/, '')}-labeled.mp4`
    );

    await storage.put(storageKey, outputBuffer, 'video/mp4');

    const newVersion = await workerPrisma.version.create({
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

    const { appendEvent } = require('./apps/web/src/lib/event-log');
    await appendEvent(
      job.workspaceId,
      'label.applied',
      'version',
      job.versionId,
      { 
        labelText: job.labelText, 
        corner: job.corner, 
        originalVersionId: job.versionId,
        labeledVersionId: newVersion.id,
        appliedAt: new Date().toISOString(),
      }
    );

    console.log(`Label burn complete for version ${job.versionId}, created version ${newVersion.id}`);
  }

  const queue = await getQueue();

  await queue.work('process-video', async (job) => {
    try {
      await processVideo(job.data);
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }
  });

  await queue.work('burn-label', async (job) => {
    try {
      await burnLabel(job.data);
    } catch (error) {
      console.error('Error burning label:', error);
      throw error;
    }
  });

  console.log('Worker ready');
}

async function startServer() {
  console.log('Starting Next.js server...');
  
  const serverPath = path.join(__dirname, '..', '..', 'server.js');
  require(serverPath);
}

async function main() {
  try {
    await runMigrations();
    
    await runSeedIfEmpty();
    
    if (RUN_WORKER_IN_PROCESS) {
      console.log('RUN_WORKER_IN_PROCESS=true, starting worker in-process');
      
      startWorkerInProcess().catch(error => {
        console.error('Worker error:', error);
      });
    } else {
      console.log('RUN_WORKER_IN_PROCESS not set, worker will not run in this process');
    }
    
    await startServer();
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

main();
