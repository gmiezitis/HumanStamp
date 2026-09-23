import crypto from 'crypto';
import { spawn } from 'child_process';
import { createWriteStream, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Extract ~6-8 frames from video at evenly spaced intervals
 * Returns paths to extracted frame images
 */
export async function extractFrames(videoPath: string, frameCount: number = 8): Promise<string[]> {
  const tempDir = mkdtempSync(join(tmpdir(), 'stamp-frames-'));
  const framePaths: string[] = [];

  try {
    // First, get video duration
    const duration = await getVideoDuration(videoPath);
    if (duration <= 0) {
      throw new Error('Could not determine video duration');
    }

    // Calculate frame timestamps (start, end, and evenly spaced in between)
    const timestamps: number[] = [];
    if (frameCount === 1) {
      timestamps.push(duration / 2); // middle frame
    } else {
      for (let i = 0; i < frameCount; i++) {
        timestamps.push((i * duration) / (frameCount - 1));
      }
    }

    // Extract frames using ffmpeg
    for (let i = 0; i < timestamps.length; i++) {
      const framePath = join(tempDir, `frame_${i}.png`);
      await extractFrameAt(videoPath, timestamps[i], framePath);
      framePaths.push(framePath);
    }

    return framePaths;
  } catch (error) {
    // Clean up on error
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Get video duration in seconds using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
      } else {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      }
    });

    ffprobe.on('error', reject);
  });
}

/**
 * Extract a single frame at specific timestamp using ffmpeg
 */
async function extractFrameAt(videoPath: string, timestamp: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-ss', timestamp.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
      } else {
        resolve();
      }
    });

    ffmpeg.on('error', reject);
  });
}

/**
 * Compute dHash (difference hash) for an image
 * dHash is more resilient to minor changes than average hash
 * Returns 64-bit hex hash
 */
export async function computeDHash(imagePath: string): Promise<string> {
  // Use sharp for image processing if available, otherwise fall back to basic implementation
  try {
    const sharp = require('sharp');
    return await computeDHashWithSharp(imagePath, sharp);
  } catch {
    // Fallback: use basic image processing
    return await computeDHashBasic(imagePath);
  }
}

/**
 * Compute dHash using sharp library (preferred)
 */
async function computeDHashWithSharp(imagePath: string, sharp: any): Promise<string> {
  // Resize to 9x8, convert to grayscale
  const { data, info } = await sharp(imagePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute differences horizontally
  const hash: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      hash.push(left < right ? 1 : 0);
    }
  }

  // Convert binary to hex
  return binaryToHex(hash);
}

/**
 * Basic dHash implementation using ffmpeg for image processing
 */
async function computeDHashBasic(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', imagePath,
      '-vf', 'scale=9:8,format=gray',
      '-f', 'rawvideo',
      '-pix_fmt', 'gray',
      'pipe:1'
    ]);

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
      } else {
        const data = Buffer.concat(chunks);
        if (data.length !== 72) {
          reject(new Error(`Expected 72 bytes, got ${data.length}`));
          return;
        }

        const hash: number[] = [];
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const left = data[row * 9 + col];
            const right = data[row * 9 + col + 1];
            hash.push(left < right ? 1 : 0);
          }
        }

        resolve(binaryToHex(hash));
      }
    });

    ffmpeg.on('error', reject);
  });
}

/**
 * Convert binary array to hex string
 */
function binaryToHex(binary: number[]): string {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const nibble = binary.slice(i, i + 4).reduce((acc, bit, idx) => acc | (bit << (3 - idx)), 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Compute video fingerprint: extract frames and hash each
 * Returns array of frame hashes
 */
export async function computeVideoFingerprint(videoPath: string, frameCount: number = 8): Promise<string[]> {
  const framePaths = await extractFrames(videoPath, frameCount);
  
  try {
    const hashes: string[] = [];
    for (const framePath of framePaths) {
      const hash = await computeDHash(framePath);
      hashes.push(hash);
    }
    return hashes;
  } finally {
    // Clean up frame files
    const tempDir = framePaths[0] ? join(framePaths[0], '..') : null;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Calculate Hamming distance between two hex hashes
 * Used for perceptual similarity matching
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    // Count set bits
    distance += xor.toString(2).split('1').length - 1;
  }
  return distance;
}

/**
 * Compare two fingerprints (arrays of frame hashes)
 * Returns similarity score (0-1, where 1 is identical)
 */
export function compareFingerprints(fp1: string[], fp2: string[]): number {
  if (fp1.length !== fp2.length) {
    return 0; // Different number of frames = not similar
  }

  const maxDistance = 64; // 64 bits per hash
  let totalSimilarity = 0;

  for (let i = 0; i < fp1.length; i++) {
    const distance = hammingDistance(fp1[i], fp2[i]);
    const similarity = 1 - (distance / maxDistance);
    totalSimilarity += similarity;
  }

  return totalSimilarity / fp1.length;
}

/**
 * Check if fingerprints match above threshold
 * Default threshold: 0.85 (85% similar)
 */
export function fingerprintsMatch(fp1: string[], fp2: string[], threshold: number = 0.85): boolean {
  const similarity = compareFingerprints(fp1, fp2);
  return similarity >= threshold;
}
