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
  'keyLength',
]);

/** Parse "3, 1, 2" into [3,1,2], ignoring anything that is not a number. */
export function parseNumberList(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
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

    if (NUMBER_LIST_FIELDS.has(field.name) && parseNumberList(raw).length === 0) {
      errors[field.name] = 'Enter page numbers separated by commas, e.g. 3,1,2.';
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
