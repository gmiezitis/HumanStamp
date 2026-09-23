import { hashFile } from '../src/hash';

describe('Hash stability', () => {
  it('should produce consistent SHA-256 hash', () => {
    const buffer = Buffer.from('test data');
    const hash1 = hashFile(buffer);
    const hash2 = hashFile(buffer);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('should produce different hash for different data', () => {
    const buffer1 = Buffer.from('test data');
    const buffer2 = Buffer.from('test data changed');
    
    const hash1 = hashFile(buffer1);
    const hash2 = hashFile(buffer2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should change hash when one byte changes', () => {
    const buffer1 = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const buffer2 = Buffer.from([0x01, 0x02, 0x03, 0x05]);
    
    const hash1 = hashFile(buffer1);
    const hash2 = hashFile(buffer2);
    
    expect(hash1).not.toBe(hash2);
  });
});
