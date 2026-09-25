import { describe, it, expect } from 'vitest';
import { detectMismatch } from '../lib/video-scan';
import type { VideoScanResult } from '../lib/video-scan';

describe('Mismatch Detection', () => {
  it('should detect mismatch when claim is human but file has AI signals', () => {
    const scanResult: VideoScanResult = {
      c2pa: {
        found: true,
        generator: 'Generated with Sora',
      },
      ffprobe: {
        encoder: 'ffmpeg',
      },
      aiSignals: {
        fromC2PA: ['sora'],
        fromMetadata: [],
      },
    };

    const result = detectMismatch('human', scanResult);

    expect(result.hasMismatch).toBe(true);
    expect(result.reason).toContain('sora');
    expect(result.reason).toContain('human');
  });

  it('should not detect mismatch when claim matches signals', () => {
    const scanResult: VideoScanResult = {
      c2pa: {
        found: false,
      },
      ffprobe: {
        encoder: 'Adobe Premiere',
      },
      aiSignals: {
        fromC2PA: [],
        fromMetadata: [],
      },
    };

    const result = detectMismatch('human', scanResult);

    expect(result.hasMismatch).toBe(false);
  });

  it('should handle missing AI signals gracefully', () => {
    const scanResult: VideoScanResult = {
      c2pa: {
        found: false,
      },
      ffprobe: {},
      aiSignals: {
        fromC2PA: [],
        fromMetadata: [],
      },
    };

    const result = detectMismatch('human', scanResult);

    expect(result.hasMismatch).toBe(false);
  });
});
