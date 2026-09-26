import PgBoss from 'pg-boss';

let bossInstance: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (bossInstance) {
    return bossInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for queue');
  }

  bossInstance = new PgBoss({
    connectionString,
    max: 10,
  });

  await bossInstance.start();

  return bossInstance;
}

export interface ProcessVideoJob {
  versionId: string;
  workspaceId: string;
}

export interface GenerateFingerprintJob {
  versionId: string;
  workspaceId: string;
}

export interface BurnLabelJob {
  versionId: string;
  workspaceId: string;
  labelText: string;
  corner: string;
  duration: number;
}

export async function enqueueProcessVideo(data: ProcessVideoJob): Promise<string | null> {
  const queue = await getQueue();
  return await queue.send('process-video', data);
}

export async function enqueueGenerateFingerprint(data: GenerateFingerprintJob): Promise<string | null> {
  const queue = await getQueue();
  return await queue.send('generate-fingerprint', data);
}

export async function enqueueBurnLabel(data: BurnLabelJob): Promise<string | null> {
  const queue = await getQueue();
  return await queue.send('burn-label', data);
}
