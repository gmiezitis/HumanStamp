import { describe, it, expect } from 'vitest';
import { compareVersionFingerprints } from '../lib/segment-fingerprint';
import type { VideoFingerprint } from '../lib/segment-fingerprint';

describe('Changed Span Detection', () => {
  it('should detect changed spans when segments differ', () => {
    const fp1: VideoFingerprint = {
      segments: [
        { timestamp: 0, hash: 'aaaaaaaaaaaaaaaa' },
        { timestamp: 1, hash: 'bbbbbbbbbbbbbbbb' },
        { timestamp: 2, hash: 'cccccccccccccccc' },
        { timestamp: 3, hash: 'dddddddddddddddd' },
      ],
      fps: 30,
      duration: 4,
    };

    const fp2: VideoFingerprint = {
      segments: [
        { timestamp: 0, hash: 'aaaaaaaaaaaaaaaa' },
        { timestamp: 1, hash: 'xxxxxxxxxxxxxxxx' },
        { timestamp: 2, hash: 'yyyyyyyyyyyyyyyy' },
        { timestamp: 3, hash: 'dddddddddddddddd' },
      ],
      fps: 30,
      duration: 4,
    };

    const diff = compareVersionFingerprints(fp1, fp2);

    expect(diff.changedSpans.length).toBeGreaterThan(0);
    expect(diff.changedSpans[0].start).toBe(1);
    expect(diff.changedSpans[0].end).toBeGreaterThanOrEqual(2);
  });

  it('should not detect changed spans for identical videos', () => {
    const fp: VideoFingerprint = {
      segments: [
        { timestamp: 0, hash: 'aaaaaaaaaaaaaaaa' },
        { timestamp: 1, hash: 'bbbbbbbbbbbbbbbb' },
      ],
      fps: 30,
      duration: 2,
    };

    const diff = compareVersionFingerprints(fp, fp);

    expect(diff.changedSpans.length).toBe(0);
    expect(diff.overallSimilarity).toBeGreaterThan(0.99);
  });

  it('should calculate overall similarity', () => {
    const fp1: VideoFingerprint = {
      segments: [
        { timestamp: 0, hash: 'aaaaaaaaaaaaaaaa' },
        { timestamp: 1, hash: 'bbbbbbbbbbbbbbbb' },
      ],
      fps: 30,
      duration: 2,
    };

    const fp2: VideoFingerprint = {
      segments: [
        { timestamp: 0, hash: 'aaaaaaaaaaaaaaaa' },
        { timestamp: 1, hash: 'xxxxxxxxxxxxxxxx' },
      ],
      fps: 30,
      duration: 2,
    };

    const diff = compareVersionFingerprints(fp1, fp2);

    expect(diff.overallSimilarity).toBeGreaterThan(0);
    expect(diff.overallSimilarity).toBeLessThan(1);
  });
});
