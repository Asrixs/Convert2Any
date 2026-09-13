import { describe, expect, it } from 'vitest';
import {
  acceptedInputAttr,
  detectInput,
  extensionOf,
  isSupportedExtension,
  outputName,
  pageImageName,
  supportedOutputs,
} from './registry';

describe('extensionOf', () => {
  it('returns lowercase extension', () => {
    expect(extensionOf('photo.JPG')).toBe('jpg');
  });

  it('handles dotfiles and trailing dots as no extension', () => {
    expect(extensionOf('.gitignore')).toBeNull();
    expect(extensionOf('archive.tar.')).toBeNull();
    expect(extensionOf('noext')).toBeNull();
  });
});

describe('detectInput', () => {
  it('accepts every supported extension case-insensitively', () => {
    expect(detectInput('a.jpg')).toBe('jpg');
    expect(detectInput('a.JPEG')).toBe('jpeg');
    expect(detectInput('a.PNG')).toBe('png');
    expect(detectInput('a.webp')).toBe('webp');
    expect(detectInput('IMG_0001.heic')).toBe('heic');
    expect(detectInput('IMG_0001.heif')).toBe('heif');
    expect(detectInput('doc.pdf')).toBe('pdf');
  });

  it('rejects unsupported and malformed names', () => {
    expect(detectInput('a.gif')).toBeNull();
    expect(detectInput('.heic')).toBeNull();
    expect(detectInput('file.')).toBeNull();
  });
});

describe('isSupportedExtension', () => {
  it('guards the union', () => {
    expect(isSupportedExtension('jpg')).toBe(true);
    expect(isSupportedExtension('exe')).toBe(false);
  });
});

describe('acceptedInputAttr', () => {
  it('includes all extensions and distinct mimes', () => {
    const attr = acceptedInputAttr();
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf']) {
      expect(attr).toContain(`.${ext}`);
    }
    expect(attr).toContain('image/jpeg');
    expect(attr).toContain('application/pdf');
  });
});

describe('outputName', () => {
  it('maps image outputs to conventional file extensions', () => {
    expect(outputName('photo.jpg', { type: 'image', format: 'png' })).toBe('photo.png');
    expect(outputName('photo.png', { type: 'image', format: 'jpeg' })).toBe('photo.jpg');
    expect(outputName('photo.heic', { type: 'image', format: 'webp' })).toBe('photo.webp');
  });

  it('covers merge, split indexing, and rotation naming', () => {
    expect(outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-merge' })).toBe('a-merged.pdf');
    expect(
      outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-split', index: 0 }),
    ).toBe('a-1.pdf');
    expect(
      outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-split', index: 11 }),
    ).toBe('a-12.pdf');
    expect(outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-rotate', degrees: 180 })).toBe(
      'a-180.pdf',
    );
  });

  it('handles names without extensions', () => {
    expect(outputName('README', { type: 'image', format: 'png' })).toBe('README.png');
  });
});

describe('pageImageName', () => {
  it('rasterized PDF pages get image extensions, not .pdf', () => {
    expect(pageImageName('a.pdf', 'jpeg', 0)).toBe('a-1.jpg');
    expect(pageImageName('a.pdf', 'jpeg', 1)).toBe('a-2.jpg');
    expect(pageImageName('scan.pdf', 'png', 4)).toBe('scan-5.png');
    expect(pageImageName('doc.pdf', 'webp', 0)).toBe('doc-1.webp');
  });
});

describe('supportedOutputs', () => {
  it('gives images the three raster outputs', () => {
    const outs = supportedOutputs('jpg');
    expect(outs).toHaveLength(3);
    expect(outs.map((k) => (k.type === 'image' ? k.format : 'pdf'))).toEqual([
      'jpeg',
      'png',
      'webp',
    ]);
  });

  it('gives PDFs the three tools plus rasterization outputs', () => {
    const outs = supportedOutputs('pdf');
    expect(outs.map((k) => (k.type === 'pdf-tool' ? k.tool : 'img'))).toEqual([
      'pdf-merge',
      'pdf-split',
      'pdf-rotate',
      'img',
      'img',
      'img',
    ]);
  });

  it('keeps merge jobs tool-only via isMergeKind', async () => {
    const { isMergeKind } = await import('./registry');
    const outs = supportedOutputs('pdf');
    const mergeOptions = outs.filter((k) => !isMergeKind(k) || k.type === 'pdf-tool');
    expect(mergeOptions.some((k) => k.type === 'image')).toBe(true);
    expect(isMergeKind({ type: 'pdf-tool', tool: 'pdf-merge' })).toBe(true);
    expect(isMergeKind({ type: 'pdf-tool', tool: 'pdf-split' })).toBe(false);
    expect(isMergeKind({ type: 'image', format: 'png' })).toBe(false);
  });
});
