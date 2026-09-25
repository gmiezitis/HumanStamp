import { describe, it, expect, beforeAll } from 'vitest';
import { burnLabel } from '../lib/label-burner';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

describe('Label Burn', () => {
  let testVideoBuffer: Buffer;

  beforeAll(async () => {
    const tmpPath = join(tmpdir(), `test-video-${Date.now()}.mp4`);
    
    await execAsync(
      `ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=10 -pix_fmt yuv420p "${tmpPath}"`
    );
    
    testVideoBuffer = readFileSync(tmpPath);
  });

  it('should burn label into video and create different output', async () => {
    const inputHash = createHash('sha256').update(testVideoBuffer).digest('hex');
    
    const outputBuffer = await burnLabel(testVideoBuffer, {
      labelText: 'AI-generated content',
      corner: 'bottom-right',
    });

    expect(outputBuffer).toBeDefined();
    expect(outputBuffer.length).toBeGreaterThan(0);

    const outputHash = createHash('sha256').update(outputBuffer).digest('hex');
    expect(outputHash).not.toBe(inputHash);

    const inputTmpPath = join(tmpdir(), `input-duration-${Date.now()}.mp4`);
    const outputTmpPath = join(tmpdir(), `output-duration-${Date.now()}.mp4`);
    
    writeFileSync(inputTmpPath, testVideoBuffer);
    writeFileSync(outputTmpPath, outputBuffer);

    const { stdout: inputInfo } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputTmpPath}"`
    );
    const inputDuration = parseFloat(inputInfo.trim());

    const { stdout: outputInfo } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputTmpPath}"`
    );
    const outputDuration = parseFloat(outputInfo.trim());

    expect(Math.abs(outputDuration - inputDuration)).toBeLessThan(0.1);
  });

  it('should support different corner positions', async () => {
    const corners: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ];

    for (const corner of corners) {
      const outputBuffer = await burnLabel(testVideoBuffer, {
        labelText: 'Test Label',
        corner,
      });

      expect(outputBuffer).toBeDefined();
      expect(outputBuffer.length).toBeGreaterThan(0);
    }
  });

  it('should support custom label text', async () => {
    const customText = 'Contains AI-generated content';
    
    const outputBuffer = await burnLabel(testVideoBuffer, {
      labelText: customText,
      corner: 'top-left',
    });

    expect(outputBuffer).toBeDefined();
    expect(outputBuffer.length).toBeGreaterThan(0);
  });
});
