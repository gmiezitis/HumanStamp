import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, mkdirSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';

const execAsync = promisify(exec);

export interface SegmentFingerprint {
  timestamp: number;
  hash: string;
}

export interface VideoFingerprint {
  segments: SegmentFingerprint[];
  fps: number;
  duration: number;
}

async function computeDHash(imagePath: string): Promise<string> {
  const image = sharp(imagePath);
  const resized = await image
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();

  const pixels: number[] = Array.from(resized);
  let hash = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col];
      const right = pixels[row * 9 + col + 1];
      hash += left > right ? '1' : '0';
    }
  }

  return BigInt('0b' + hash).toString(16).padStart(16, '0');
}

export async function generateSegmentFingerprint(
  buffer: Buffer,
  segmentInterval = 1.0
): Promise<VideoFingerprint> {
  const tmpDir = join(tmpdir(), `fingerprint-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const videoPath = join(tmpDir, 'video.mp4');
  writeFileSync(videoPath, buffer);

  try {
    const { stdout: probeOutput } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,duration -of csv=p=0 "${videoPath}"`
    );

    const [fpsStr, durationStr] = probeOutput.trim().split(',');
    const [num, den] = fpsStr.split('/').map(Number);
    const fps = num / den;
    const duration = parseFloat(durationStr) || 0;

    const framesDir = join(tmpDir, 'frames');
    mkdirSync(framesDir);

    await execAsync(
      `ffmpeg -i "${videoPath}" -vf "fps=1/${segmentInterval}" "${framesDir}/frame_%04d.png"`
    );

    const frameFiles = readdirSync(framesDir)
      .filter((f) => f.endsWith('.png'))
      .sort();

    const segments: SegmentFingerprint[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = join(framesDir, frameFiles[i]);
      const hash = await computeDHash(framePath);
      
      segments.push({
        timestamp: i * segmentInterval,
        hash,
      });
    }

    return {
      segments,
      fps,
      duration,
    };
  } finally {
    try {
      await execAsync(`rm -rf "${tmpDir}"`);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function hammingDistance(hash1: string, hash2: string): number {
  const a = BigInt('0x' + hash1);
  const b = BigInt('0x' + hash2);
  const xor = a ^ b;
  
  let distance = 0;
  let n = xor;
  while (n > 0n) {
    distance++;
    n = n & (n - 1n);
  }
  
  return distance;
}

export interface SegmentMatch {
  v1Index: number;
  v2Index: number;
  v1Timestamp: number;
  v2Timestamp: number;
  similarity: number;
  changed: boolean;
}

export interface VersionDiff {
  matches: SegmentMatch[];
  changedSpans: Array<{ start: number; end: number }>;
  overallSimilarity: number;
}

export function compareVersionFingerprints(
  fp1: VideoFingerprint,
  fp2: VideoFingerprint,
  similarityThreshold = 0.85
): VersionDiff {
  const matches: SegmentMatch[] = [];
  const maxLen = Math.max(fp1.segments.length, fp2.segments.length);

  for (let i = 0; i < maxLen; i++) {
    const seg1 = fp1.segments[i];
    const seg2 = fp2.segments[i];

    if (!seg1 || !seg2) {
      break;
    }

    const distance = hammingDistance(seg1.hash, seg2.hash);
    const similarity = 1 - distance / 64;
    const changed = similarity < similarityThreshold;

    matches.push({
      v1Index: i,
      v2Index: i,
      v1Timestamp: seg1.timestamp,
      v2Timestamp: seg2.timestamp,
      similarity,
      changed,
    });
  }

  const changedSpans: Array<{ start: number; end: number }> = [];
  let spanStart: number | null = null;

  for (const match of matches) {
    if (match.changed && spanStart === null) {
      spanStart = match.v1Timestamp;
    } else if (!match.changed && spanStart !== null) {
      changedSpans.push({ start: spanStart, end: match.v1Timestamp });
      spanStart = null;
    }
  }

  if (spanStart !== null) {
    const lastMatch = matches[matches.length - 1];
    changedSpans.push({ start: spanStart, end: lastMatch.v1Timestamp + 1 });
  }

  const totalSimilarity = matches.reduce((sum, m) => sum + m.similarity, 0);
  const overallSimilarity = matches.length > 0 ? totalSimilarity / matches.length : 0;

  return {
    matches,
    changedSpans,
    overallSimilarity,
  };
}

export async function findMatchingVersion(
  uploadedBuffer: Buffer,
  existingVersions: Array<{ id: string; fingerprint: string | null }>
): Promise<{ versionId: string; similarity: number } | null> {
  const uploadedFp = await generateSegmentFingerprint(uploadedBuffer);

  let bestMatch: { versionId: string; similarity: number } | null = null;

  for (const version of existingVersions) {
    if (!version.fingerprint) continue;

    try {
      const existingFp: VideoFingerprint = JSON.parse(version.fingerprint);
      const diff = compareVersionFingerprints(existingFp, uploadedFp);

      if (diff.overallSimilarity > 0.7) {
        if (!bestMatch || diff.overallSimilarity > bestMatch.similarity) {
          bestMatch = {
            versionId: version.id,
            similarity: diff.overallSimilarity,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return bestMatch;
}
