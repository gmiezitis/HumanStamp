import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import { randomUUID } from 'crypto';

export interface StorageConfig {
  type: 'local' | 's3';
  localPath?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
}

export interface StorageInterface {
  put(key: string, buffer: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  size(key: string): Promise<number>;
  stream(
    key: string,
    range?: { start: number; end: number },
    signal?: AbortSignal
  ): Promise<ReadableStream<Uint8Array>>;
}

class LocalStorage implements StorageInterface {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(this.basePath, key);
    await this.ensureDir(filePath);
    await fs.writeFile(filePath, buffer);
  }

  async get(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return await fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    await fs.unlink(filePath);
  }

  async getSignedUrl(key: string): Promise<string> {
    return `/api/storage/${key}`;
  }

  private resolveKey(key: string) {
    const root = path.resolve(this.basePath);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep))
      throw new Error('Invalid storage key');
    return target;
  }

  async size(key: string) {
    return (await fs.stat(this.resolveKey(key))).size;
  }

  async stream(
    key: string,
    range?: { start: number; end: number },
    signal?: AbortSignal
  ) {
    return Readable.toWeb(
      createReadStream(this.resolveKey(key), { ...range, signal })
    ) as ReadableStream<Uint8Array>;
  }
}

class S3Storage implements StorageInterface {
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    if (
      !config.s3Bucket ||
      !config.s3Region ||
      !config.s3AccessKeyId ||
      !config.s3SecretAccessKey
    ) {
      throw new Error(
        'S3 storage requires bucket, region, accessKeyId, and secretAccessKey'
      );
    }

    this.bucket = config.s3Bucket;
    this.client = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
    });
  }

  async put(
    key: string,
    buffer: Buffer,
    contentType = 'application/octet-stream'
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`No body in S3 response for key: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return await getSignedUrl(this.client, command, { expiresIn });
  }

  async size(key: string) {
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key })
    );
    if (response.ContentLength === undefined)
      throw new Error('Missing file size');
    return response.ContentLength;
  }

  async stream(
    key: string,
    range?: { start: number; end: number },
    signal?: AbortSignal
  ) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      }),
      { abortSignal: signal }
    );
    if (!response.Body) throw new Error('Missing file body');
    return response.Body.transformToWebStream() as ReadableStream<Uint8Array>;
  }
}

let storageInstance: StorageInterface | null = null;

export function getStorage(): StorageInterface {
  if (storageInstance) {
    return storageInstance;
  }

  const storageType = process.env.STORAGE_TYPE || 'local';

  if (storageType === 's3') {
    const config: StorageConfig = {
      type: 's3',
      s3Bucket: process.env.S3_BUCKET,
      s3Region: process.env.S3_REGION,
      s3Endpoint: process.env.S3_ENDPOINT,
      s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    };
    storageInstance = new S3Storage(config);
  } else {
    const localPath = process.env.STORAGE_LOCAL_PATH || './storage';
    storageInstance = new LocalStorage(localPath);
  }

  return storageInstance;
}

export function generateStorageKey(
  workspaceId: string,
  projectId: string,
  filename: string
): string {
  // Two simultaneous uploads of the same filename must never overwrite a cut.
  const hash = randomUUID();
  const ext = path.extname(filename);
  return `${workspaceId}/${projectId}/${hash}${ext}`;
}
