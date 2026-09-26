#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const RUN_WORKER_IN_PROCESS = process.env.RUN_WORKER_IN_PROCESS === 'true';

async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    execSync('prisma migrate deploy', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}

async function runSeedIfEmpty() {
  console.log('Checking if database needs seeding...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      console.log('Database is empty, running inline seed...');
      
      const { randomUUID } = require('crypto');
      
      const workspaceId = randomUUID();
      const userId = randomUUID();
      
      // Create workspace
      await prisma.workspace.create({
        data: {
          id: workspaceId,
          name: 'Demo Agency',
        },
      });
      
      // Create demo user (no password - uses JWT-only demo login)
      await prisma.user.create({
        data: {
          id: userId,
          email: 'demo@humanstamp.test',
          name: 'Demo User',
        },
      });
      
      // Create workspace membership
      await prisma.workspaceMembership.create({
        data: {
          workspaceId,
          userId,
          role: 'ADMIN',
        },
      });
      
      console.log('Seed completed successfully');
      console.log('Demo user: demo@humanstamp.test (use demo login button)');
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
  
  try {
    // Register tsx to handle TypeScript files
    require('tsx/cjs/api').register();
    
    const { getQueue } = require(path.join(__dirname, 'lib', 'queue'));
    const { prisma: workerPrisma } = require(path.join(__dirname, 'lib', 'prisma'));
    const { getStorage } = require(path.join(__dirname, 'lib', 'storage'));
    const { scanVideo, detectMismatch } = require(path.join(__dirname, 'lib', 'video-scan'));
    const { generateSegmentFingerprint } = require(path.join(__dirname, 'lib', 'segment-fingerprint'));
  
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

    const { burnLabel: burnLabelFn } = require(path.join(__dirname, 'lib', 'label-burner'));
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

    const { generateStorageKey } = require(path.join(__dirname, 'lib', 'storage'));
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

    const { appendEvent } = require(path.join(__dirname, 'lib', 'event-log'));
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
  } catch (error) {
    console.error('Worker initialization error:', error);
    console.log('Worker will not be started due to initialization failure');
    return;
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
  
  const serverPath = path.join(__dirname, '..', 'server.js');
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
