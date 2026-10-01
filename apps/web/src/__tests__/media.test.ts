import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseByteRange, serveVideo, videoContentType } from '../lib/media';
import {
  generateStorageKey,
  getStorage,
  type StorageInterface,
} from '../lib/storage';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('native video range requests', () => {
  it.each([
    ['bytes=0-3', { start: 0, end: 3 }],
    ['bytes=5-', { start: 5, end: 9 }],
    ['bytes=-3', { start: 7, end: 9 }],
    ['bytes=0-999', { start: 0, end: 9 }],
    ['bytes=-999', { start: 0, end: 9 }],
  ])('supports %s', (header, expected) =>
    expect(parseByteRange(header, 10)).toEqual(expected)
  );
  it.each([
    'bytes=10-',
    'bytes=5-2',
    'bytes=-0',
    'bytes=-',
    'bytes=0-1,3-4',
    'bytes=9007199254740992-',
    'items=0-1',
  ])('rejects invalid or amplified %s', (header) =>
    expect(() => parseByteRange(header, 10)).toThrow()
  );
  it('allows a whole file and rejects ranges for an empty file', () => {
    expect(parseByteRange(null, 10)).toBeNull();
    expect(() => parseByteRange('bytes=0-', 0)).toThrow();
  });
  it('never serves HTML as an inline video', () => {
    expect(videoContentType('attack.html')).toBeNull();
    expect(videoContentType('attack.__proto__')).toBeNull();
    expect(videoContentType('attack.constructor')).toBeNull();
    expect(videoContentType('mp4')).toBeNull();
    expect(videoContentType('cut.MP4')).toBe('video/mp4');
  });
  it('gives simultaneous same-name uploads distinct immutable storage keys', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const a = generateStorageKey('w', 'p', 'cut.mp4');
    const b = generateStorageKey('w', 'p', 'cut.mp4');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^w\/p\/.+\.mp4$/);
    vi.restoreAllMocks();
  });
  it('confines local preview paths to the storage root', async () => {
    vi.stubEnv('STORAGE_TYPE', 'local');
    vi.stubEnv('STORAGE_LOCAL_PATH', './test-storage');
    await expect(getStorage().size('../private.txt')).rejects.toThrow(
      'Invalid storage key'
    );
  });
});

describe('streamed video responses', () => {
  const data = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  function storage() {
    return {
      size: vi.fn(async () => data.length),
      stream: vi.fn(
        async (_key: string, range?: { start: number; end: number }) =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                range ? data.slice(range.start, range.end + 1) : data
              );
              controller.close();
            },
          })
      ),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      getSignedUrl: vi.fn(),
    } satisfies StorageInterface;
  }
  const file = {
    storageKey: 'protected-cut',
    filename: 'cut.mp4',
    fileSize: 10,
  };
  it('streams exactly the requested bytes with safe headers and no buffering API', async () => {
    const s = storage();
    const response = await serveVideo(
      new Request('http://test', { headers: { Range: 'bytes=2-4' } }),
      file,
      s
    );
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 2-4/10');
    expect(response.headers.get('Content-Length')).toBe('3');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      2, 3, 4,
    ]);
    expect(s.get).not.toHaveBeenCalled();
  });
  it('serves a full response when no range is requested', async () => {
    const response = await serveVideo(
      new Request('http://test'),
      file,
      storage()
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Range')).toBeNull();
    expect((await response.arrayBuffer()).byteLength).toBe(10);
  });
  it('HEAD returns metadata without reading file content', async () => {
    const s = storage();
    const response = await serveVideo(
      new Request('http://test', { method: 'HEAD' }),
      file,
      s
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Length')).toBe('10');
    expect(await response.text()).toBe('');
    expect(s.stream).not.toHaveBeenCalled();
  });
  it('unsatisfiable ranges return 416 and do not read content', async () => {
    const s = storage();
    const response = await serveVideo(
      new Request('http://test', { headers: { Range: 'bytes=20-' } }),
      file,
      s
    );
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */10');
    expect(s.stream).not.toHaveBeenCalled();
  });
  it('fails closed if stored size differs from the approved file record', async () => {
    const s = storage();
    await expect(
      serveVideo(new Request('http://test'), { ...file, fileSize: 20 }, s)
    ).rejects.toMatchObject({ status: 409 });
    expect(s.stream).not.toHaveBeenCalled();
  });
  it('rejects unsupported inline content types before opening storage', async () => {
    const s = storage();
    await expect(
      serveVideo(
        new Request('http://test'),
        { ...file, filename: 'cut.html' },
        s
      )
    ).rejects.toMatchObject({ status: 415 });
    expect(s.size).not.toHaveBeenCalled();
  });
});
