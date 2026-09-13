import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  FIDELITY_COPY,
  initialOptions,
  runnableTools,
  toolBySlug,
  toolPaths,
  TOOLS,
  toolsByCategory,
} from './catalog';
import { buildOptions, coerceField, initialValues, parseNumberList, validate } from './options';
import { isSupportedExtension } from '../pipeline/registry';

/**
 * The catalog drives routing, the sitemap and every tool page, so these tests
 * guard its integrity rather than its wording. A malformed entry would
 * otherwise surface as a broken page at runtime.
 */
describe('tool catalog integrity', () => {
  it('has unique slugs', () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses URL-safe slugs', () => {
    for (const tool of TOOLS) {
      expect(tool.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('declares a known category and fidelity for every tool', () => {
    for (const tool of TOOLS) {
      expect(Object.keys(CATEGORIES)).toContain(tool.category);
      expect(Object.keys(FIDELITY_COPY)).toContain(tool.fidelity);
    }
  });

  it('only accepts extensions the registry supports', () => {
    for (const tool of TOOLS) {
      for (const ext of tool.accepts) {
        expect(isSupportedExtension(ext)).toBe(true);
      }
    }
  });

  it('gives every runnable tool at least one accepted input', () => {
    for (const tool of runnableTools()) {
      expect(tool.accepts.length).toBeGreaterThan(0);
    }
  });

  it('builds a valid output kind from each tool defaults', () => {
    for (const tool of TOOLS) {
      const kind = tool.toKind(initialOptions(tool));
      expect(['image', 'pdf-tool', 'doc-tool']).toContain(kind.type);
    }
  });

  it('covers all three categories from the brief', () => {
    for (const category of Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]) {
      expect(toolsByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it('exposes one route per tool', () => {
    const paths = toolPaths();
    expect(paths).toHaveLength(TOOLS.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/tools/merge-pdf');
  });

  it('resolves slugs, and nothing else', () => {
    expect(toolBySlug('merge-pdf')?.title).toBe('Merge PDF');
    expect(toolBySlug('nope')).toBeUndefined();
  });

  it('documents a caveat wherever a tool is not exact', () => {
    // A lossy tool with no explanation is the failure mode worth preventing.
    for (const tool of TOOLS) {
      if (tool.fidelity === 'exact') continue;
      expect(tool.caveat, `${tool.slug} needs a caveat`).toBeTruthy();
    }
  });

  it('gives select fields an initial value that is one of their choices', () => {
    for (const tool of TOOLS) {
      for (const field of tool.fields) {
        if (field.type !== 'select') continue;
        const values = (field.choices ?? []).map((c) => c.value);
        expect(values, `${tool.slug}.${field.name}`).toContain(String(field.initial));
      }
    }
  });
});

describe('option coercion', () => {
  it('parses page lists, ignoring junk and non-positive numbers', () => {
    expect(parseNumberList('3,1,2')).toEqual([3, 1, 2]);
    expect(parseNumberList('3, 1 2')).toEqual([3, 1, 2]);
    expect(parseNumberList('a,2,-1,0')).toEqual([2]);
    expect(parseNumberList('')).toEqual([]);
  });

  it('converts numeric fields to numbers, not strings', () => {
    const tool = toolBySlug('page-numbers')!;
    const options = buildOptions(tool, { ...initialValues(tool), startAt: '5', fontSize: '14' });
    expect(options.startAt).toBe(5);
    expect(options.fontSize).toBe(14);
  });

  it('keeps text fields as text', () => {
    const field = { name: 'text', label: 'Text', type: 'text' } as const;
    expect(coerceField(field, 'DRAFT')).toBe('DRAFT');
  });

  it('omits empty optional fields so pipeline defaults apply', () => {
    const tool = toolBySlug('split-pdf')!;
    expect(buildOptions(tool, { ranges: '' })).toEqual({});
  });

  it('rejects a missing required field', () => {
    const tool = toolBySlug('protect-pdf')!;
    const errors = validate(tool, { ...initialValues(tool), password: '' });
    expect(errors.password).toBeTruthy();
  });

  it('accepts a filled required field', () => {
    const tool = toolBySlug('protect-pdf')!;
    expect(validate(tool, { ...initialValues(tool), password: 'hunter2' })).toEqual({});
  });

  it('flags out-of-range numbers', () => {
    const tool = toolBySlug('compress-pdf')!;
    expect(validate(tool, { ...initialValues(tool), dpi: '5000' }).dpi).toBeTruthy();
    expect(validate(tool, { ...initialValues(tool), dpi: '120' }).dpi).toBeUndefined();
  });

  it('flags a page-order field containing no usable numbers', () => {
    const tool = toolBySlug('reorder-pdf')!;
    expect(validate(tool, { order: 'abc' }).order).toBeTruthy();
    expect(validate(tool, { order: '2,1' }).order).toBeUndefined();
  });

  it('starts every tool form with values for its fields', () => {
    for (const tool of TOOLS) {
      const values = initialValues(tool);
      for (const field of tool.fields) {
        expect(values).toHaveProperty(field.name);
      }
    }
  });
});
