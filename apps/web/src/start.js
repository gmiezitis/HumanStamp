#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
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
      
      await prisma.workspace.create({
        data: {
          id: workspaceId,
          name: 'Demo Agency',
        },
      });
      
      await prisma.user.create({
        data: {
          id: userId,
          email: 'demo@humanstamp.test',
          name: 'Demo User',
        },
      });
      
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

function startWorkerProcess() {
  console.log('[worker] Starting worker process...');
  
  const workerPath = path.join(__dirname, 'worker.ts');
  const worker = spawn('pnpm', ['exec', 'tsx', workerPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    stdio: 'pipe',
  });
  
  worker.stdout.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      console.log(`[worker] ${line}`);
    });
  });
  
  worker.stderr.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      console.error(`[worker] ${line}`);
    });
  });
  
  worker.on('exit', (code, signal) => {
    console.error(`[worker] Worker process exited with code ${code} and signal ${signal}`);
    console.log('[worker] Restarting worker in 5 seconds...');
    setTimeout(() => {
      startWorkerProcess();
    }, 5000);
  });
  
  console.log('[worker] Worker process started');
}

function startNextServer() {
  console.log('Starting Next.js server...');
  
  const port = process.env.PORT || 3000;
  const nextBin = path.join(__dirname, '..', 'node_modules', '.bin', 'next');
  
  const server = spawn(nextBin, ['start', '-p', port], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });
  
  server.on('exit', (code, signal) => {
    console.error(`Next.js server exited with code ${code} and signal ${signal}`);
    process.exit(code || 1);
  });
}

async function main() {
  try {
    await runMigrations();
    await runSeedIfEmpty();
    
    if (RUN_WORKER_IN_PROCESS) {
      startWorkerProcess();
    } else {
      console.log('RUN_WORKER_IN_PROCESS not set, worker will not run');
    }
    
    startNextServer();
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

main();
