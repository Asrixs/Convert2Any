import { describe, expect, it } from 'vitest';
import { dedupeName } from './download';

describe('dedupeName', () => {
  it('passes through unique names without mutating the set', () => {
    const taken = new Set<string>();
    expect(dedupeName('photo.jpg', taken)).toBe('photo.jpg');
    expect(taken.has('photo.jpg')).toBe(false);
  });

  it('suffixes duplicates (2), (3), … skipping gaps correctly', () => {
    const taken = new Set(['photo.jpg', 'photo (2).jpg', 'photo (3).jpg']);
    expect(dedupeName('photo.jpg', taken)).toBe('photo (4).jpg');
  });

  it('handles extensionless names', () => {
    const taken = new Set(['README']);
    expect(dedupeName('README', taken)).toBe('README (2)');
  });
});
