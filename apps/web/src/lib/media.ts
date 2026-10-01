import { getStorage, type StorageInterface } from './storage';
import { WorkflowError } from './workflow';

export function videoContentType(filename: string) {
  const parts = filename.split('.');
  if (parts.length < 2) return null;
  const extension = parts.pop()!.toLowerCase();
  return (
    new Map([
      ['mp4', 'video/mp4'],
      ['m4v', 'video/mp4'],
      ['webm', 'video/webm'],
      ['mov', 'video/quicktime'],
    ]).get(extension) || null
  );
}

// One range is enough for native media controls; reject multi-range amplification.
export function parseByteRange(
  header: string | null,
  size: number
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0)
    throw new WorkflowError('Invalid byte range', 416);
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if (
    (first !== null && !Number.isSafeInteger(first)) ||
    (last !== null && !Number.isSafeInteger(last))
  )
    throw new WorkflowError('Invalid byte range', 416);
  const start = first === null ? Math.max(0, size - last!) : first;
  const end =
    first === null || last === null ? size - 1 : Math.min(last, size - 1);
  if (start >= size || start > end || (first === null && last === 0))
    throw new WorkflowError('Range not satisfiable', 416);
  return { start, end };
}

// Call only after authorizing the exact version. No raw storage keys or signed
// object URLs are exposed. Streaming and byte ranges avoid buffering whole cuts.
export async function serveVideo(
  req: Request,
  file: { storageKey: string; filename: string; fileSize?: number },
  storage: StorageInterface = getStorage()
) {
  const contentType = videoContentType(file.filename);
  if (!contentType)
    throw new WorkflowError(
      'This file type cannot be previewed. Ask for an MP4 or WebM copy.',
      415
    );
  const size = await storage.size(file.storageKey);
  if (file.fileSize !== undefined && file.fileSize !== size)
    throw new WorkflowError(
      'Stored video does not match its recorded size. Ask the agency to upload it again.',
      409
    );
  const headers = new Headers({
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g, '%27')}`,
  });
  let range;
  try {
    range = parseByteRange(req.headers.get('range'), size);
  } catch {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const length = range ? range.end - range.start + 1 : size;
  headers.set('Content-Length', String(length));
  if (range)
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  const body =
    req.method === 'HEAD'
      ? null
      : await storage.stream(file.storageKey, range || undefined, req.signal);
  return new Response(body, { status: range ? 206 : 200, headers });
}
