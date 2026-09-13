import { describe, expect, it } from 'vitest';
import { formatPageLabel, keepAfterDelete, normalizeOrder, parseRanges } from './pages';

describe('parseRanges', () => {
  it('treats an empty spec as every page', () => {
    expect(parseRanges('', 3)).toEqual([0, 1, 2]);
    expect(parseRanges('   ', 2)).toEqual([0, 1]);
  });

  it('parses singles, closed ranges and open ends', () => {
    expect(parseRanges('1,3', 5)).toEqual([0, 2]);
    expect(parseRanges('2-4', 6)).toEqual([1, 2, 3]);
    expect(parseRanges('3-', 5)).toEqual([2, 3, 4]);
    expect(parseRanges('-3', 5)).toEqual([0, 1, 2]);
  });

  it('clamps out-of-range pages instead of throwing', () => {
    // A user typing 1-999 on a 4-page PDF means "all of it", not an error.
    expect(parseRanges('1-999', 4)).toEqual([0, 1, 2, 3]);
    expect(parseRanges('7', 4)).toEqual([]);
    expect(parseRanges('0', 4)).toEqual([]);
  });

  it('deduplicates and sorts overlapping selections', () => {
    expect(parseRanges('3,1-2,2', 5)).toEqual([0, 1, 2]);
  });

  it('accepts reversed ranges and ignores junk', () => {
    expect(parseRanges('4-2', 6)).toEqual([1, 2, 3]);
    expect(parseRanges('abc,2', 4)).toEqual([1]);
    expect(parseRanges('', 0)).toEqual([]);
  });
});

describe('normalizeOrder', () => {
  it('produces a complete permutation from a partial order', () => {
    expect(normalizeOrder([3], 4)).toEqual([2, 0, 1, 3]);
    expect(normalizeOrder([3, 1, 2], 3)).toEqual([2, 0, 1]);
  });

  it('ignores duplicates and out-of-range pages', () => {
    expect(normalizeOrder([2, 2, 9, 0, -1], 3)).toEqual([1, 0, 2]);
  });

  it('returns the identity for an empty order', () => {
    expect(normalizeOrder([], 3)).toEqual([0, 1, 2]);
  });
});

describe('keepAfterDelete', () => {
  it('keeps everything not listed', () => {
    expect(keepAfterDelete([2], 4)).toEqual([0, 2, 3]);
    expect(keepAfterDelete([1, 4], 4)).toEqual([1, 2]);
  });

  it('returns empty when every page is deleted, so callers can refuse', () => {
    expect(keepAfterDelete([1, 2], 2)).toEqual([]);
  });

  it('ignores pages outside the document', () => {
    expect(keepAfterDelete([9], 2)).toEqual([0, 1]);
  });
});

describe('formatPageLabel', () => {
  it('fills both placeholders, repeatedly', () => {
    expect(formatPageLabel('{n}', 3, 10)).toBe('3');
    expect(formatPageLabel('Page {n} of {total}', 3, 10)).toBe('Page 3 of 10');
    expect(formatPageLabel('{n}/{total} — {n}', 2, 4)).toBe('2/4 — 2');
  });

  it('leaves a template with no placeholders alone', () => {
    expect(formatPageLabel('Draft', 1, 2)).toBe('Draft');
  });
});
