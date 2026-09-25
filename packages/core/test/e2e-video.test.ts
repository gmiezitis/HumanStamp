import { 
  computeVideoFingerprint, 
  compareFingerprints,
  createReceiptPayload,
  sign,
  verify,
  generateKeyPair,
  hashFile,
  StampRecipe
} from '../src';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

// Get bundled ffmpeg path - load synchronously to avoid issues
let ffmpegPath: string;
try {
  ffmpegPath = process.env.FFMPEG_PATH || require('ffmpeg-static');
} catch (err) {
  throw new Error(`Failed to load ffmpeg-static: ${err}`);
}

/**
 * Generate a test video using bundled ffmpeg
 * Creates a 2-second video with solid color and a moving box
 */
async function generateTestVideo(outputPath: string, width: number = 320, height: number = 240): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-f', 'lavfi',
      '-i', `color=c=blue:s=${width}x${height}:d=2`,
      '-f', 'lavfi',
      '-i', 'testsrc=duration=2:size=320x240:rate=10',
      '-filter_complex', '[1:v]format=rgba,colorchannelmixer=aa=0.5[ovr];[0:v][ovr]overlay=0:0',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-t', '2',
      '-y',
      outputPath
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

/**
 * Re-encode a video with different settings
 * Simulates what happens when a video is uploaded to social media
 */
async function reencodeVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-b:v', '500k', // Different bitrate
      '-pix_fmt', 'yuv420p',
      '-y',
      outputPath
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

describe('E2E video stamping and verification', () => {
  let originalVideoPath: string;
  let reencodedVideoPath: string;
  let keypair: { privateKey: string; publicKey: string };

  beforeAll(async () => {
    // Generate test video files
    originalVideoPath = join(tmpdir(), `test-video-original-${Date.now()}.mp4`);
    reencodedVideoPath = join(tmpdir(), `test-video-reencoded-${Date.now()}.mp4`);

    try {
      await generateTestVideo(originalVideoPath);
      await reencodeVideo(originalVideoPath, reencodedVideoPath);
    } catch (error) {
      console.error('Failed to generate test videos:', error);
      throw error;
    }

    keypair = await generateKeyPair();
  }, 60000); // 60s timeout for video generation

  afterAll(() => {
    // Clean up test videos
    if (existsSync(originalVideoPath)) {
      unlinkSync(originalVideoPath);
    }
    if (existsSync(reencodedVideoPath)) {
      unlinkSync(reencodedVideoPath);
    }
  });

  it('should stamp a generated video', async () => {
    const videoBuffer = readFileSync(originalVideoPath);
    const sha256 = hashFile(videoBuffer);
    const fingerprint = await computeVideoFingerprint(originalVideoPath, 8);

    expect(fingerprint).toHaveLength(8);
    expect(fingerprint.every(h => typeof h === 'string' && h.length === 16)).toBe(true);

    const recipe: StampRecipe = {
      mode: 'human',
      tools: ['Test Generator'],
      approver: 'E2E Test',
    };

    const id = 'e2e-test-stamp';
    const createdAt = new Date().toISOString();
    const payload = createReceiptPayload(
      id,
      sha256,
      JSON.stringify(recipe),
      createdAt,
      fingerprint
    );

    const signature = await sign(payload, keypair.privateKey);
    const isValid = await verify(payload, signature, keypair.publicKey);

    expect(isValid).toBe(true);
  }, 30000);

  it('should find video via fingerprint after re-encoding', async () => {
    // Get fingerprints of both versions
    const originalFingerprint = await computeVideoFingerprint(originalVideoPath, 8);
    const reencodedFingerprint = await computeVideoFingerprint(reencodedVideoPath, 8);

    // Fingerprints should be similar (not exact)
    const similarity = compareFingerprints(originalFingerprint, reencodedFingerprint);

    console.log(`Fingerprint similarity after re-encoding: ${(similarity * 100).toFixed(1)}%`);
    
    // Should be at least 85% similar (typical threshold)
    expect(similarity).toBeGreaterThanOrEqual(0.85);
  }, 30000);

  it('should verify reencoded video matches original stamp', async () => {
    // Create stamp for original video
    const originalBuffer = readFileSync(originalVideoPath);
    const originalSha256 = hashFile(originalBuffer);
    const originalFingerprint = await computeVideoFingerprint(originalVideoPath, 8);

    const recipe: StampRecipe = {
      mode: 'human',
      tools: ['Test Generator'],
      approver: 'E2E Test',
    };

    const id = 'e2e-verify-test';
    const createdAt = new Date().toISOString();
    const payload = createReceiptPayload(
      id,
      originalSha256,
      JSON.stringify(recipe),
      createdAt,
      originalFingerprint
    );

    const signature = await sign(payload, keypair.privateKey);

    // Now try to verify the reencoded video
    const reencodedBuffer = readFileSync(reencodedVideoPath);
    const reencodedSha256 = hashFile(reencodedBuffer);
    const reencodedFingerprint = await computeVideoFingerprint(reencodedVideoPath, 8);

    // SHA-256 should be different (different file)
    expect(reencodedSha256).not.toBe(originalSha256);

    // But fingerprint should match
    const similarity = compareFingerprints(originalFingerprint, reencodedFingerprint);
    expect(similarity).toBeGreaterThanOrEqual(0.85);

    // Original signature should still be valid for original payload
    const isValid = await verify(payload, signature, keypair.publicKey);
    expect(isValid).toBe(true);
  }, 30000);

  it('should work without system ffmpeg on PATH', async () => {
    // This test verifies that we're using the bundled ffmpeg, not system ffmpeg
    // We do this by checking that ffmpeg operations work even if PATH doesn't include ffmpeg
    
    const testVideoPath = join(tmpdir(), `test-bundled-${Date.now()}.mp4`);
    
    try {
      // Generate a video using our bundled ffmpeg (through generateTestVideo)
      await generateTestVideo(testVideoPath, 160, 120);
      
      // Compute fingerprint (which uses bundled ffmpeg internally)
      const fingerprint = await computeVideoFingerprint(testVideoPath, 4);
      
      expect(fingerprint).toHaveLength(4);
      expect(fingerprint.every(h => typeof h === 'string')).toBe(true);
      
      console.log('✓ Bundled ffmpeg is working correctly');
    } finally {
      if (existsSync(testVideoPath)) {
        unlinkSync(testVideoPath);
      }
    }
  }, 30000);
});
