import { afterEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {},
  DeleteObjectCommand: class {},
}));
afterEach(() => {
  vi.unstubAllEnvs();
  send.mockReset();
  vi.resetModules();
});

describe('S3 preview adapter', () => {
  it('uses metadata and byte-range streaming, not whole-file buffering', async () => {
    vi.stubEnv('STORAGE_TYPE', 's3');
    vi.stubEnv('S3_BUCKET', 'private');
    vi.stubEnv('S3_REGION', 'test');
    vi.stubEnv('S3_ACCESS_KEY_ID', 'test');
    vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test');
    const bytes = new Uint8Array([2, 3, 4]);
    const web = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    });
    const transformToWebStream = vi.fn(() => web);
    send
      .mockResolvedValueOnce({ ContentLength: 10 })
      .mockResolvedValueOnce({ Body: { transformToWebStream } });
    const { getStorage } = await import('../lib/storage');
    const storage = getStorage();
    expect(await storage.size('cut.mp4')).toBe(10);
    const signal = new AbortController().signal;
    const stream = await storage.stream(
      'cut.mp4',
      { start: 2, end: 4 },
      signal
    );
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'private',
      Key: 'cut.mp4',
    });
    expect(send.mock.calls[1][0].input).toEqual({
      Bucket: 'private',
      Key: 'cut.mp4',
      Range: 'bytes=2-4',
    });
    expect(send.mock.calls[1][1]).toEqual({ abortSignal: signal });
    expect(stream).toBe(web);
    expect(transformToWebStream).toHaveBeenCalledOnce();
  });
});
