import { 
  hammingDistance, 
  compareFingerprints, 
  fingerprintsMatch 
} from '../src/fingerprint';

describe('Fingerprint', () => {
  describe('hammingDistance', () => {
    it('should return 0 for identical hashes', () => {
      const hash = 'a1b2c3d4';
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('should calculate correct distance for different hashes', () => {
      // 'f' = 1111, '0' = 0000 -> distance = 4
      expect(hammingDistance('f', '0')).toBe(4);
    });

    it('should handle longer hashes', () => {
      const hash1 = 'ffffffff';
      const hash2 = '00000000';
      // Each 'f' vs '0' = 4 bits different, 8 chars * 4 = 32
      expect(hammingDistance(hash1, hash2)).toBe(32);
    });

    it('should throw for different length hashes', () => {
      expect(() => hammingDistance('abc', 'abcd')).toThrow('Hashes must be same length');
    });
  });

  describe('compareFingerprints', () => {
    it('should return 1 for identical fingerprints', () => {
      const fp = ['a1b2c3d4', 'e5f6a7b8'];
      expect(compareFingerprints(fp, fp)).toBe(1);
    });

    it('should return 0 for different length fingerprints', () => {
      const fp1 = ['a1b2c3d4'];
      const fp2 = ['a1b2c3d4', 'e5f6a7b8'];
      expect(compareFingerprints(fp1, fp2)).toBe(0);
    });

    it('should return value between 0 and 1 for similar fingerprints', () => {
      // Similar but not identical frames
      const fp1 = ['ffffffff', 'aaaaaaaa'];
      const fp2 = ['fffffffe', 'aaaaaaab']; // 1 bit different per frame
      const similarity = compareFingerprints(fp1, fp2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
      expect(similarity).toBeGreaterThan(0.95); // Very similar
    });

    it('should return low value for very different fingerprints', () => {
      const fp1 = ['ffffffff', 'ffffffff'];
      const fp2 = ['00000000', '00000000'];
      const similarity = compareFingerprints(fp1, fp2);
      
      expect(similarity).toBeLessThanOrEqual(0.5); // Very different
      expect(similarity).toBeLessThan(0.85); // Below match threshold
    });
  });

  describe('fingerprintsMatch', () => {
    it('should match identical fingerprints', () => {
      const fp = ['a1b2c3d4', 'e5f6a7b8'];
      expect(fingerprintsMatch(fp, fp)).toBe(true);
    });

    it('should match very similar fingerprints above threshold', () => {
      const fp1 = ['ffffffff', 'aaaaaaaa'];
      const fp2 = ['fffffffe', 'aaaaaaab']; // 1 bit different per frame
      expect(fingerprintsMatch(fp1, fp2, 0.85)).toBe(true);
    });

    it('should not match different fingerprints below threshold', () => {
      const fp1 = ['ffffffff', 'ffffffff'];
      const fp2 = ['00000000', '00000000'];
      expect(fingerprintsMatch(fp1, fp2, 0.85)).toBe(false);
    });

    it('should not match fingerprints of different lengths', () => {
      const fp1 = ['a1b2c3d4'];
      const fp2 = ['a1b2c3d4', 'e5f6a7b8'];
      expect(fingerprintsMatch(fp1, fp2)).toBe(false);
    });

    it('should respect custom threshold', () => {
      // Create fingerprints with ~75% similarity
      const fp1 = ['ffffffff', 'ffffffff', 'ffffffff'];
      const fp2 = ['ffffff00', 'ffffff00', 'ffffff00']; // 8/32 bits different per frame = 75% similar
      
      expect(fingerprintsMatch(fp1, fp2, 0.90)).toBe(false); // Below 90%
      expect(fingerprintsMatch(fp1, fp2, 0.70)).toBe(true);  // Above 70%
    });
  });
});
