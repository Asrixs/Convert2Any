/**
 * Pure page-selection maths. No browser APIs and no pdf-lib, so every rule
 * here is unit-testable in Node and shared by the PDF tools and their UI
 * (the tool forms preview the resulting page count before you run anything).
 */

/**
 * Parse a human page range — "1-3, 5, 8-" — into 0-based page indices.
 *
 * `total` bounds the result: out-of-range pages are dropped rather than
 * throwing, so a user typing "1-999" on a 4-page PDF gets all 4 pages
 * instead of an error. Returns indices in ascending order, de-duplicated.
 */
export function parseRanges(spec: string, total: number): number[] {
  if (total <= 0) return [];
  const trimmed = spec.trim();
  if (trimmed === '') return Array.from({ length: total }, (_, i) => i);

  const picked = new Set<number>();
  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim();
    if (part === '') continue;

    const match = /^(\d*)\s*-\s*(\d*)$/.exec(part);
    if (match) {
      // "-5" means 1..5, "3-" means 3..end, "2-4" is the closed interval.
      const from = match[1] === '' ? 1 : Number(match[1]);
      const to = match[2] === '' ? total : Number(match[2]);
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
      const lo = Math.max(1, Math.min(from, to));
      const hi = Math.min(total, Math.max(from, to));
      for (let page = lo; page <= hi; page++) picked.add(page - 1);
      continue;
    }

    const single = Number(part);
    if (!Number.isInteger(single)) continue;
    if (single >= 1 && single <= total) picked.add(single - 1);
  }
  return [...picked].sort((a, b) => a - b);
}

/**
 * Normalize a reorder instruction into a complete 0-based permutation.
 * Pages the user did not mention keep their relative order at the end, so a
 * partial order like [3] on a 4-page document means "move page 3 first".
 */
export function normalizeOrder(order: number[], total: number): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const page of order) {
    const index = page - 1;
    if (!Number.isInteger(index) || index < 0 || index >= total) continue;
    if (seen.has(index)) continue;
    seen.add(index);
    result.push(index);
  }
  for (let i = 0; i < total; i++) if (!seen.has(i)) result.push(i);
  return result;
}

/** Indices remaining after deleting 1-based `pages`. Never returns empty. */
export function keepAfterDelete(pages: number[], total: number): number[] {
  const drop = new Set(pages.map((p) => p - 1));
  const kept = Array.from({ length: total }, (_, i) => i).filter((i) => !drop.has(i));
  return kept;
}

/** Fill {n} / {total} in a page-number template. */
export function formatPageLabel(template: string, n: number, total: number): string {
  return template.replaceAll('{n}', String(n)).replaceAll('{total}', String(total));
}
