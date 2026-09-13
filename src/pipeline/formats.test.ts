import { describe, expect, it } from 'vitest';
import {
  ALL_IMAGE_EXTENSIONS,
  IMAGE_FORMATS,
  MARKUP_EXTENSIONS,
  OFFICE_EXTENSIONS,
  PDF_EXTENSIONS,
} from './formats';
import { familyOf, SUPPORTED_EXTENSIONS } from './registry';

describe('formats consistency', () => {
  it('keeps registry mimes aligned with format tables', () => {
    const family: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
    };
    for (const [format, def] of Object.entries(IMAGE_FORMATS)) {
      expect(def.mime).toBe(family[format]);
    }
  });

  it('covers every registry extension in a format table', () => {
    // Each supported input must belong to exactly one family table, so a new
    // extension cannot be added to the registry without being classified.
    const known = [
      ...ALL_IMAGE_EXTENSIONS,
      ...PDF_EXTENSIONS,
      ...OFFICE_EXTENSIONS,
      ...MARKUP_EXTENSIONS,
    ];
    for (const ext of SUPPORTED_EXTENSIONS) {
      expect(known).toContain(ext);
    }
  });

  it('assigns every supported extension a single family', () => {
    for (const ext of SUPPORTED_EXTENSIONS) {
      expect(['image', 'pdf', 'office', 'markup']).toContain(familyOf(ext));
    }
    expect(familyOf('pdf')).toBe('pdf');
    expect(familyOf('heic')).toBe('image');
    expect(familyOf('docx')).toBe('office');
    expect(familyOf('html')).toBe('markup');
  });
});
