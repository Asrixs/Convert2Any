import {
  ALL_IMAGE_EXTENSIONS,
  MARKUP_EXTENSIONS,
  OFFICE_EXTENSIONS,
  type DocTool,
  type ImageOutputFormat,
  type OutputKind,
  type PdfTool,
} from './formats';

/**
 * Pure filename/decision logic. No browser APIs — fully unit-testable in
 * Node, and the single source of truth for what the UI accepts and names.
 */

export const SUPPORTED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'html',
  'htm',
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const MIME_BY_EXTENSION: Record<SupportedExtension, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
};

export const IMAGE_OUTPUTS: ImageOutputFormat[] = ['jpeg', 'png', 'webp'];

export const PDF_TOOLS = [
  'pdf-merge',
  'pdf-split',
  'pdf-rotate',
  'pdf-reorder',
  'pdf-delete',
  'pdf-compress',
  'pdf-watermark',
  'pdf-numbers',
  'pdf-protect',
  'pdf-unlock',
] as const;

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  // Dotfiles like ".gitignore" have no extension; "file." has an empty one.
  if (dot <= 0 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}

export function detectInput(filename: string): SupportedExtension | null {
  const ext = extensionOf(filename);
  return ext && isSupportedExtension(ext) ? ext : null;
}

/** Accept list for the file picker / dropzone: ".jpg,.png,…" plus MIME types. */
export function acceptedInputAttr(): string {
  const exts = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(',');
  const mimes = [...new Set(Object.values(MIME_BY_EXTENSION))];
  return `${exts},${mimes.join(',')}`;
}

export function isImageExtension(ext: string): boolean {
  return ALL_IMAGE_EXTENSIONS.includes(ext);
}

export function isOfficeExtension(ext: string): boolean {
  return OFFICE_EXTENSIONS.includes(ext);
}

export function isMarkupExtension(ext: string): boolean {
  return MARKUP_EXTENSIONS.includes(ext);
}

/** Which family an extension belongs to — drives icons and default tools. */
export function familyOf(ext: SupportedExtension): 'image' | 'pdf' | 'office' | 'markup' {
  if (ext === 'pdf') return 'pdf';
  if (isImageExtension(ext)) return 'image';
  if (isOfficeExtension(ext)) return 'office';
  return 'markup';
}

/** Stem of a filename: everything before the final extension. */
export function stemOf(filename: string): string {
  const ext = extensionOf(filename);
  return ext ? filename.slice(0, filename.length - ext.length - 1) : filename;
}

const IMAGE_EXT_FOR: Record<ImageOutputFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

/** Suffix added to a PDF tool's output filename. */
const PDF_TOOL_SUFFIX: Record<Exclude<PdfTool, 'pdf-split' | 'pdf-rotate'>, string> = {
  'pdf-merge': '-merged',
  'pdf-reorder': '-reordered',
  'pdf-delete': '-trimmed',
  'pdf-compress': '-compressed',
  'pdf-watermark': '-watermarked',
  'pdf-numbers': '-numbered',
  'pdf-protect': '-protected',
  'pdf-unlock': '-unlocked',
};

/** Target extension for each cross-family document conversion. */
const DOC_TOOL_EXT: Record<DocTool, string> = {
  'images-to-pdf': 'pdf',
  'pdf-to-docx': 'docx',
  'docx-to-pdf': 'pdf',
  'pdf-to-xlsx': 'xlsx',
  'xlsx-to-pdf': 'pdf',
  'html-to-pdf': 'pdf',
};

/**
 * Output filename for a job. Pure function so tests can pin naming.
 * `stem` is the source filename without its final extension.
 */
export function outputName(sourceName: string, kind: OutputKind): string {
  const stem = stemOf(sourceName);

  switch (kind.type) {
    case 'image':
      return `${stem}.${IMAGE_EXT_FOR[kind.format]}`;

    case 'doc-tool':
      return `${stem}.${DOC_TOOL_EXT[kind.tool]}`;

    case 'pdf-tool':
      switch (kind.tool) {
        case 'pdf-split':
          // A range selection collapses to one file; otherwise one per page.
          return kind.options?.ranges?.trim()
            ? `${stem}-pages.pdf`
            : `${stem}-${(kind.index ?? 0) + 1}.pdf`;
        case 'pdf-rotate':
          return `${stem}-${kind.degrees ?? 90}.pdf`;
        default:
          return `${stem}${PDF_TOOL_SUFFIX[kind.tool]}.pdf`;
      }
  }
}

/**
 * Name for one rasterized PDF page: 'stem-1.jpg'. Kept here so the
 * image-extension mapping stays consistent with `outputName`.
 */
export function pageImageName(
  sourceName: string,
  format: ImageOutputFormat,
  index: number,
): string {
  return `${stemOf(sourceName)}-${index + 1}.${IMAGE_EXT_FOR[format]}`;
}

/**
 * Outputs offered by the home-page quick picker.
 *
 * Tools needing configuration (watermark text, page ranges, passwords) are
 * NOT here — they live on their own pages where a form can collect those
 * options. This list is only the choices that are meaningful with defaults.
 */
export function supportedOutputs(ext: SupportedExtension): OutputKind[] {
  const family = familyOf(ext);

  if (family === 'pdf') {
    return [
      { type: 'pdf-tool', tool: 'pdf-merge' },
      { type: 'pdf-tool', tool: 'pdf-split' },
      { type: 'pdf-tool', tool: 'pdf-rotate', degrees: 90 },
      { type: 'pdf-tool', tool: 'pdf-compress' },
      { type: 'doc-tool', tool: 'pdf-to-docx' },
      { type: 'doc-tool', tool: 'pdf-to-xlsx' },
      // Rasterization: convert.ts fans every PDF page out as image outputs.
      ...IMAGE_OUTPUTS.map((format) => ({ type: 'image', format }) as OutputKind),
    ];
  }

  if (family === 'image') {
    return [
      ...IMAGE_OUTPUTS.map((format) => ({ type: 'image', format }) as OutputKind),
      { type: 'doc-tool', tool: 'images-to-pdf' },
    ];
  }

  if (family === 'markup') {
    return [{ type: 'doc-tool', tool: 'html-to-pdf' }];
  }

  // Office: .docx converts as a document, .xlsx/.csv as a spreadsheet.
  return ext === 'docx'
    ? [{ type: 'doc-tool', tool: 'docx-to-pdf' }]
    : [{ type: 'doc-tool', tool: 'xlsx-to-pdf' }];
}

/** A merge job groups files; its output picker must not offer image formats. */
export function isMergeKind(kind: OutputKind): boolean {
  return kind.type === 'pdf-tool' && kind.tool === 'pdf-merge';
}

/** Jobs that combine several files into one output. */
export function isGroupingKind(kind: OutputKind): boolean {
  return isMergeKind(kind) || (kind.type === 'doc-tool' && kind.tool === 'images-to-pdf');
}

/** Whether a job needs only itself (true) or grouping/merging logic (false). */
export function isSoloTool(kind: OutputKind): boolean {
  return !isGroupingKind(kind);
}

/** Human label for an output choice, shared by the picker and the queue. */
export function kindLabel(kind: OutputKind): string {
  switch (kind.type) {
    case 'image':
      return kind.format.toUpperCase();
    case 'doc-tool':
      return DOC_TOOL_LABELS[kind.tool];
    case 'pdf-tool':
      return kind.tool === 'pdf-rotate'
        ? `Rotate ${kind.degrees ?? 90}°`
        : PDF_TOOL_LABELS[kind.tool];
  }
}

const PDF_TOOL_LABELS: Record<PdfTool, string> = {
  'pdf-merge': 'Merge PDFs',
  'pdf-split': 'Split to pages',
  'pdf-rotate': 'Rotate',
  'pdf-reorder': 'Reorder pages',
  'pdf-delete': 'Delete pages',
  'pdf-compress': 'Compress',
  'pdf-watermark': 'Watermark',
  'pdf-numbers': 'Page numbers',
  'pdf-protect': 'Protect',
  'pdf-unlock': 'Unlock',
};

const DOC_TOOL_LABELS: Record<DocTool, string> = {
  'images-to-pdf': 'Combine to PDF',
  'pdf-to-docx': 'Word (.docx)',
  'docx-to-pdf': 'PDF',
  'pdf-to-xlsx': 'Excel (.xlsx)',
  'xlsx-to-pdf': 'PDF',
  'html-to-pdf': 'PDF',
};
