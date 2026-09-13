import { describe, expect, it } from 'vitest';
import {
  groupIntoLines,
  inferColumns,
  lineToString,
  linesToRows,
  type PositionedText,
} from './pdftext';

/** Helper mirroring what pdf.js hands back for one text fragment. */
function frag(str: string, x: number, y: number, width = str.length * 5): PositionedText {
  return { str, x, y, width, height: 10 };
}

describe('groupIntoLines', () => {
  it('groups fragments by baseline, top-down and left-to-right', () => {
    const lines = groupIntoLines([
      frag('world', 60, 100),
      frag('Hello', 10, 100),
      frag('Second', 10, 80),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.map((i) => i.str)).toEqual(['Hello', 'world']);
    expect(lines[1]?.map((i) => i.str)).toEqual(['Second']);
  });

  it('absorbs sub-pixel baseline drift within one visual line', () => {
    // Superscripts and font switches nudge y slightly; that is still one line.
    const lines = groupIntoLines([frag('a', 10, 100), frag('b', 20, 101.4)]);
    expect(lines).toHaveLength(1);
  });

  it('drops empty fragments and handles an empty page', () => {
    expect(groupIntoLines([frag('', 0, 0)])).toEqual([]);
    expect(groupIntoLines([])).toEqual([]);
  });
});

describe('lineToString', () => {
  it('inserts a space only where the gap warrants one', () => {
    // "Hel" + "lo" are adjacent (one word split across fragments).
    const joined = lineToString([frag('Hel', 10, 0, 15), frag('lo', 25, 0, 10)]);
    expect(joined).toBe('Hello');
  });

  it('separates fragments with a real gap between them', () => {
    const joined = lineToString([frag('Hello', 10, 0, 25), frag('world', 60, 0, 25)]);
    expect(joined).toBe('Hello world');
  });

  it('never doubles an existing space', () => {
    expect(lineToString([frag('Hello ', 10, 0, 30), frag('world', 60, 0, 25)])).toBe('Hello world');
  });
});

describe('inferColumns / linesToRows', () => {
  it('detects x positions repeated across most lines', () => {
    const lines = [
      [frag('Name', 10, 100), frag('Qty', 200, 100)],
      [frag('Bolt', 10, 80), frag('4', 200, 80)],
      [frag('Nut', 10, 60), frag('9', 200, 60)],
    ];
    const columns = inferColumns(lines);
    expect(columns).toHaveLength(2);
    expect(linesToRows(lines, columns)).toEqual([
      ['Name', 'Qty'],
      ['Bolt', '4'],
      ['Nut', '9'],
    ]);
  });

  it('does not invent columns from a one-off wide gap', () => {
    const lines = [
      [frag('a', 10, 100), frag('b', 300, 100)],
      [frag('c', 10, 80)],
      [frag('d', 10, 60)],
    ];
    // Only x=10 repeats across lines, so there is exactly one column.
    expect(inferColumns(lines)).toEqual([10]);
  });

  it('falls back to one cell per line when no columns are found', () => {
    const lines = [[frag('just prose', 10, 100)]];
    expect(linesToRows(lines, [])).toEqual([['just prose']]);
  });

  it('assigns a fragment to the nearest boundary at or left of it', () => {
    const lines = [[frag('x', 205, 100)]];
    expect(linesToRows(lines, [10, 200])).toEqual([['', 'x']]);
  });
});
