import { describe, expect, it } from 'vitest';
import {
  acceptedInputAttr,
  detectInput,
  extensionOf,
  isGroupingKind,
  isSupportedExtension,
  kindLabel,
  outputName,
  pageImageName,
  supportedOutputs,
} from './registry';
import type { PdfTool } from './formats';

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

  it('suffixes each editing tool distinctly', () => {
    const name = (tool: PdfTool) => outputName('report.pdf', { type: 'pdf-tool', tool });
    expect(name('pdf-reorder')).toBe('report-reordered.pdf');
    expect(name('pdf-delete')).toBe('report-trimmed.pdf');
    expect(name('pdf-compress')).toBe('report-compressed.pdf');
    expect(name('pdf-watermark')).toBe('report-watermarked.pdf');
    expect(name('pdf-numbers')).toBe('report-numbered.pdf');
    expect(name('pdf-protect')).toBe('report-protected.pdf');
    expect(name('pdf-unlock')).toBe('report-unlocked.pdf');
  });

  it('collapses a ranged split into one file, but numbers a full split', () => {
    expect(
      outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-split', options: { ranges: '1-3' } }),
    ).toBe('a-pages.pdf');
    expect(outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-split', index: 2 })).toBe('a-3.pdf');
    // A blank range is not a range: it still means "one file per page".
    expect(
      outputName('a.pdf', { type: 'pdf-tool', tool: 'pdf-split', index: 0, options: { ranges: '  ' } }),
    ).toBe('a-1.pdf');
  });

  it('gives document conversions the target extension', () => {
    expect(outputName('notes.pdf', { type: 'doc-tool', tool: 'pdf-to-docx' })).toBe('notes.docx');
    expect(outputName('notes.pdf', { type: 'doc-tool', tool: 'pdf-to-xlsx' })).toBe('notes.xlsx');
    expect(outputName('letter.docx', { type: 'doc-tool', tool: 'docx-to-pdf' })).toBe('letter.pdf');
    expect(outputName('data.xlsx', { type: 'doc-tool', tool: 'xlsx-to-pdf' })).toBe('data.pdf');
    expect(outputName('page.html', { type: 'doc-tool', tool: 'html-to-pdf' })).toBe('page.pdf');
    expect(outputName('scan.jpg', { type: 'doc-tool', tool: 'images-to-pdf' })).toBe('scan.pdf');
  });
});

describe('kindLabel', () => {
  it('labels every output kind without falling through', () => {
    expect(kindLabel({ type: 'image', format: 'webp' })).toBe('WEBP');
    expect(kindLabel({ type: 'pdf-tool', tool: 'pdf-rotate', degrees: 270 })).toBe('Rotate 270°');
    expect(kindLabel({ type: 'pdf-tool', tool: 'pdf-merge' })).toBe('Merge PDFs');
    expect(kindLabel({ type: 'doc-tool', tool: 'pdf-to-docx' })).toBe('Word (.docx)');
  });
});

describe('grouping', () => {
  it('treats merge and image assembly as multi-file jobs', () => {
    expect(isGroupingKind({ type: 'pdf-tool', tool: 'pdf-merge' })).toBe(true);
    expect(isGroupingKind({ type: 'doc-tool', tool: 'images-to-pdf' })).toBe(true);
    expect(isGroupingKind({ type: 'pdf-tool', tool: 'pdf-split' })).toBe(false);
    expect(isGroupingKind({ type: 'image', format: 'png' })).toBe(false);
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
  it('gives images the three raster outputs plus PDF assembly', () => {
    const outs = supportedOutputs('jpg');
    expect(outs.filter((k) => k.type === 'image').map((k) => (k.type === 'image' ? k.format : ''))).toEqual([
      'jpeg',
      'png',
      'webp',
    ]);
    expect(outs.some((k) => k.type === 'doc-tool' && k.tool === 'images-to-pdf')).toBe(true);
  });

  it('gives PDFs the no-option tools plus rasterization outputs', () => {
    const outs = supportedOutputs('pdf');
    expect(outs.map((k) => (k.type === 'image' ? 'img' : k.tool))).toEqual([
      'pdf-merge',
      'pdf-split',
      'pdf-rotate',
      'pdf-compress',
      'pdf-to-docx',
      'pdf-to-xlsx',
      'img',
      'img',
      'img',
    ]);
  });

  it('keeps option-requiring tools out of the quick picker', () => {
    // Watermark text, page ranges and passwords cannot be collected by a
    // dropdown, so those tools belong on their own pages only.
    const tools = supportedOutputs('pdf').map((k) => (k.type === 'image' ? 'img' : k.tool));
    for (const gated of ['pdf-watermark', 'pdf-numbers', 'pdf-protect', 'pdf-unlock', 'pdf-reorder']) {
      expect(tools).not.toContain(gated);
    }
  });

  it('routes office and markup inputs to their conversions', () => {
    expect(supportedOutputs('docx')).toEqual([{ type: 'doc-tool', tool: 'docx-to-pdf' }]);
    expect(supportedOutputs('xlsx')).toEqual([{ type: 'doc-tool', tool: 'xlsx-to-pdf' }]);
    expect(supportedOutputs('csv')).toEqual([{ type: 'doc-tool', tool: 'xlsx-to-pdf' }]);
    expect(supportedOutputs('html')).toEqual([{ type: 'doc-tool', tool: 'html-to-pdf' }]);
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
