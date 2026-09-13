/**
 * Turning a PDF's positioned glyph runs back into lines, and lines back into
 * table rows.
 *
 * A PDF stores text as fragments at x/y coordinates with no notion of "line"
 * or "column" — reconstructing those is inference, not decoding. The rules
 * live here as pure functions so they can be tested against fixtures without
 * a browser, and so the lossiness is inspectable rather than buried in a
 * conversion routine.
 */

export interface PositionedText {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Group fragments into visual lines by their baseline.
 *
 * `tolerance` absorbs the sub-pixel baseline drift that superscripts and
 * font switches introduce within a single visual line.
 */
export function groupIntoLines(items: PositionedText[], tolerance = 2.5): PositionedText[][] {
  const usable = items.filter((item) => item.str !== '');
  if (usable.length === 0) return [];

  // Top-down: PDF y grows upward, so descending y is reading order.
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedText[][] = [];
  let current: PositionedText[] = [];
  let baseline = sorted[0]!.y;

  for (const item of sorted) {
    if (current.length > 0 && Math.abs(item.y - baseline) > tolerance) {
      lines.push(current.sort((a, b) => a.x - b.x));
      current = [];
      baseline = item.y;
    }
    if (current.length === 0) baseline = item.y;
    current.push(item);
  }
  if (current.length > 0) lines.push(current.sort((a, b) => a.x - b.x));
  return lines;
}

/**
 * Join one line's fragments, inserting a space only where the horizontal gap
 * implies one. PDFs frequently split words across fragments with no space,
 * so naive concatenation with spaces mangles ordinary prose.
 */
export function lineToString(line: PositionedText[], gapRatio = 0.25): string {
  let out = '';
  let previousEnd: number | null = null;
  let previousHeight = 0;

  for (const item of line) {
    if (previousEnd !== null) {
      const gap = item.x - previousEnd;
      const threshold = Math.max(previousHeight, item.height, 6) * gapRatio;
      if (gap > threshold && !out.endsWith(' ') && !item.str.startsWith(' ')) out += ' ';
    }
    out += item.str;
    previousEnd = item.x + item.width;
    previousHeight = item.height;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Infer column boundaries by finding x positions where many lines start a
 * fragment. A gap shared by most rows is a column edge; a gap unique to one
 * row is just a wide word space.
 */
export function inferColumns(lines: PositionedText[][], tolerance = 8): number[] {
  const counts = new Map<number, number>();
  // Track the true leftmost x seen in each bucket: the boundary a cell is
  // compared against must not sit to the right of the text it should capture.
  const leftEdge = new Map<number, number>();

  for (const line of lines) {
    const seen = new Set<number>();
    for (const item of line) {
      // Bucket x positions so near-identical starts reinforce each other.
      const bucket = Math.round(item.x / tolerance) * tolerance;
      const known = leftEdge.get(bucket);
      if (known === undefined || item.x < known) leftEdge.set(bucket, item.x);
      if (seen.has(bucket)) continue;
      seen.add(bucket);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.ceil(lines.length * 0.4));
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([bucket]) => leftEdge.get(bucket) ?? bucket)
    .sort((a, b) => a - b);
}

/** Assign each fragment to the nearest column boundary at or left of it. */
export function linesToRows(lines: PositionedText[][], boundaries: number[]): string[][] {
  if (boundaries.length === 0) {
    return lines.map((line) => [lineToString(line)]);
  }
  return lines.map((line) => {
    const cells: PositionedText[][] = boundaries.map(() => []);
    for (const item of line) {
      let index = 0;
      for (let c = 0; c < boundaries.length; c++) {
        if (item.x + 1 >= boundaries[c]!) index = c;
      }
      cells[index]!.push(item);
    }
    return cells.map((cell) => lineToString(cell));
  });
}

/** Extract positioned text for every page. Requires a browser/worker context. */
export async function extractPdfText(
  file: Blob,
  password?: string,
): Promise<{ pages: PositionedText[][] }> {
  const { loadPdfJs } = await import('./pdf');
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), password });
  const doc = await task.promise;
  const pages: PositionedText[][] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: PositionedText[] = [];
      for (const item of content.items) {
        // TextMarkedContent entries carry no `str`; only TextItem does.
        if (!('str' in item)) continue;
        const transform = item.transform as number[];
        items.push({
          str: item.str,
          x: transform[4] ?? 0,
          y: transform[5] ?? 0,
          width: item.width ?? 0,
          height: item.height || Math.abs(transform[3] ?? 10),
        });
      }
      pages.push(items);
      page.cleanup();
    }
  } finally {
    task.destroy();
  }
  return { pages };
}
