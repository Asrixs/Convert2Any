import { describe, expect, it } from 'vitest';
import { ALL_IMAGE_EXTENSIONS, IMAGE_FORMATS } from './formats';
import { SUPPORTED_EXTENSIONS } from './registry';

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
    for (const ext of SUPPORTED_EXTENSIONS) {
      if (ext === 'pdf') continue;
      expect(ALL_IMAGE_EXTENSIONS).toContain(ext);
    }
  });
});
