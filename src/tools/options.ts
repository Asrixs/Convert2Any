import type { ToolOptions } from '../pipeline/formats';
import type { Tool, ToolField } from './catalog';

/**
 * Form values -> ToolOptions.
 *
 * Every HTML control hands back a string, but the pipeline is typed on real
 * numbers and number arrays (and those values cross a structured-clone
 * boundary into a Web Worker, where a stray "90" instead of 90 would silently
 * change behaviour). Coercion therefore happens once, here, as a pure
 * function the tests can pin.
 */

/** Fields whose value is a comma-separated list of page numbers. */
const NUMBER_LIST_FIELDS = new Set<keyof ToolOptions>(['order', 'pages']);

/** Fields that must arrive at the pipeline as numbers. */
const NUMERIC_FIELDS = new Set<keyof ToolOptions>([
  'dpi',
  'imageQuality',
  'opacity',
  'rotation',
  'fontSize',
  'startAt',
  'margin',
]);

/** A single range may not expand past this many pages ("1-99999999" is a typo). */
const MAX_RANGE = 10_000;

/** "3, 1  5 - 7" -> ["3", "1", "5-7"]: commas or spaces separate, dashes join. */
function pageListParts(value: string): string[] {
  return value
    .replace(/\s*-\s*/g, '-')
    .split(/[,\s]+/)
    .filter((part) => part !== '');
}

function isPagePart(part: string): boolean {
  const range = /^(\d+)-(\d+)$/.exec(part);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    return from > 0 && to > 0 && Math.abs(to - from) < MAX_RANGE;
  }
  return /^\d+$/.test(part) && Number(part) > 0;
}

/**
 * Parse "3, 1, 5-7" into [3, 1, 5, 6, 7], keeping the order given. A
 * descending range counts down ("4-2" is 4, 3, 2), which is how you reverse
 * pages in Reorder. Anything unreadable is skipped here; validate() reports
 * it, so the user never has part of a list silently ignored.
 */
export function parseNumberList(value: string): number[] {
  const pages: number[] = [];
  for (const part of pageListParts(value)) {
    if (!isPagePart(part)) continue;
    const [fromText, toText = fromText] = part.split('-');
    const from = Number(fromText);
    const to = Number(toText);
    const step = from <= to ? 1 : -1;
    for (let n = from; n !== to + step; n += step) pages.push(n);
  }
  return pages;
}

/** The parts of a page list that are not a page number or a range. */
export function unreadablePageParts(value: string): string[] {
  return pageListParts(value).filter((part) => !isPagePart(part));
}

/** Coerce one field's raw form value to its pipeline type. */
export function coerceField(field: ToolField, raw: string): unknown {
  if (NUMBER_LIST_FIELDS.has(field.name)) return parseNumberList(raw);
  if (NUMERIC_FIELDS.has(field.name)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return raw;
}

/**
 * Build the options object for a tool from its raw form state.
 * Empty optional strings are omitted so the pipeline's `??` defaults apply
 * instead of being overridden by "".
 */
export function buildOptions(tool: Tool, values: Record<string, string>): ToolOptions {
  const options: Record<string, unknown> = {};
  for (const field of tool.fields) {
    const raw = values[field.name];
    if (raw === undefined) continue;
    if (raw === '' && !field.required) continue;
    const coerced = coerceField(field, raw);
    if (coerced === undefined) continue;
    if (Array.isArray(coerced) && coerced.length === 0) continue;
    options[field.name] = coerced;
  }
  return options as ToolOptions;
}

/**
 * Validate a tool's form before running. Returns a field-keyed message map;
 * empty means the job is safe to queue.
 */
export function validate(tool: Tool, values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of tool.fields) {
    const raw = (values[field.name] ?? '').trim();
    if (field.required && raw === '') {
      errors[field.name] = `${field.label} is required.`;
      continue;
    }
    if (raw === '') continue;

    if (NUMBER_LIST_FIELDS.has(field.name)) {
      const unreadable = unreadablePageParts(raw);
      if (unreadable.length > 0) {
        errors[field.name] =
          `Could not read "${unreadable[0]}". Use page numbers and ranges, e.g. 2, 5-7.`;
      } else if (parseNumberList(raw).length === 0) {
        errors[field.name] = 'Enter page numbers and ranges, e.g. 2, 5-7.';
      }
    }
    if (field.type === 'number' || field.type === 'range') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[field.name] = 'Enter a number.';
      else if (field.min !== undefined && n < field.min)
        errors[field.name] = `Must be at least ${field.min}.`;
      else if (field.max !== undefined && n > field.max)
        errors[field.name] = `Must be at most ${field.max}.`;
    }
  }
  return errors;
}

/** Starting form state for a tool: every field as its initial string. */
export function initialValues(tool: Tool): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of tool.fields) {
    values[field.name] = field.initial === undefined ? '' : String(field.initial);
  }
  return values;
}
