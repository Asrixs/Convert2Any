import {
  ALL_IMAGE_EXTENSIONS,
  type ImageOutputFormat,
  type OutputKind,
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
};

export const IMAGE_OUTPUTS: ImageOutputFormat[] = ['jpeg', 'png', 'webp'];

export const PDF_TOOLS = ['pdf-merge', 'pdf-split', 'pdf-rotate'] as const;

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

export interface NameOptions {
  /** Image outputs: 'stem.png'. Split: 'stem-1.pdf'. Rotate: 'stem-90.pdf'. */
  index?: number;
}

/**
 * Output filename for a job. Pure function so tests can pin naming.
 * `stem` is the source filename without its final extension.
 */
export function outputName(sourceName: string, kind: OutputKind): string {
  const ext = extensionOf(sourceName);
  const stem = ext ? sourceName.slice(0, sourceName.length - ext.length - 1) : sourceName;

  switch (kind.type) {
    case 'image': {
      const extFor = { jpeg: 'jpg', png: 'png', webp: 'webp' }[kind.format];
      return `${stem}.${extFor}`;
    }
    case 'pdf-tool':
      switch (kind.tool) {
        case 'pdf-merge':
          return `${stem}-merged.pdf`;
        case 'pdf-split':
          return `${stem}-${(kind.index ?? 0) + 1}.pdf`;
        case 'pdf-rotate':
          return `${stem}-${kind.degrees}.pdf`;
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
  const ext = extensionOf(sourceName);
  const stem = ext ? sourceName.slice(0, sourceName.length - ext.length - 1) : sourceName;
  const extFor = { jpeg: 'jpg', png: 'png', webp: 'webp' }[format];
  return `${stem}-${index + 1}.${extFor}`;
}

/** Per-file supported outputs for the UI picker. */
export function supportedOutputs(ext: SupportedExtension): OutputKind[] {
  if (ext === 'pdf') {
    return [
      { type: 'pdf-tool', tool: 'pdf-merge' },
      { type: 'pdf-tool', tool: 'pdf-split' },
      { type: 'pdf-tool', tool: 'pdf-rotate', degrees: 90 },
      // Rasterization: convert.ts fans every PDF page out as image outputs.
      ...IMAGE_OUTPUTS.map((format) => ({ type: 'image', format }) as OutputKind),
    ];
  }
  return IMAGE_OUTPUTS.map((format) => ({ type: 'image', format }));
}

/** A merge job groups files; its output picker must not offer image formats. */
export function isMergeKind(kind: OutputKind): boolean {
  return kind.type === 'pdf-tool' && kind.tool === 'pdf-merge';
}

/** Whether a job needs only itself (true) or grouping/merging logic (false). */
export function isSoloTool(kind: OutputKind): boolean {
  return !(kind.type === 'pdf-tool' && kind.tool === 'pdf-merge');
}
