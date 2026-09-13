/**
 * Canonical format definitions. The registry in registry.ts and the tool
 * catalog in tools/catalog.ts derive all user-facing copy (accepted inputs,
 * output labels, format chips) from these tables, so adding a format means
 * touching formats.ts + decoders/encoders only.
 */

export type ImageOutputFormat = 'jpeg' | 'png' | 'webp';

/** Structural PDF operations. Every one of these outputs one or more PDFs. */
export type PdfTool =
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-rotate'
  | 'pdf-reorder'
  | 'pdf-delete'
  | 'pdf-compress'
  | 'pdf-watermark'
  | 'pdf-numbers'
  | 'pdf-protect'
  | 'pdf-unlock';

/** Cross-family document conversions (Office, HTML, image->PDF). */
export type DocTool =
  | 'images-to-pdf'
  | 'pdf-to-docx'
  | 'docx-to-pdf'
  | 'pdf-to-xlsx'
  | 'xlsx-to-pdf'
  | 'html-to-pdf';

export type WatermarkPosition =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-center' | 'top-left';

/**
 * One flat, JSON-only options bag shared by every tool.
 *
 * Flat and primitive on purpose: options ride to the worker through
 * `postMessage`'s structured clone alongside the job's files, so anything
 * non-cloneable (functions, class instances) would throw at the boundary.
 */
export interface ToolOptions {
  /** pdf-split: "1-3,5,8-" — empty means one file per page. */
  ranges?: string;
  /** pdf-reorder: 1-based page order, e.g. [3,1,2]. */
  order?: number[];
  /** pdf-delete: 1-based pages to drop. */
  pages?: number[];
  /** pdf-compress: raster scale and JPEG quality. */
  dpi?: number;
  imageQuality?: number;
  /** pdf-watermark */
  text?: string;
  opacity?: number;
  rotation?: number;
  fontSize?: number;
  position?: WatermarkPosition;
  /** pdf-numbers */
  numberPosition?: NumberPosition;
  startAt?: number;
  /** Template with {n} and {total}, e.g. "Page {n} of {total}". */
  template?: string;
  margin?: number;
  /** pdf-protect / pdf-unlock */
  password?: string;
  ownerPassword?: string;
  keyLength?: 40 | 128 | 256;
  /** images-to-pdf */
  pageSize?: 'fit' | 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  /** html-to-pdf */
  html?: string;
  title?: string;
  /** Image outputs produced by a doc tool (pdf-to-image via tool pages). */
  imageFormat?: ImageOutputFormat;
}

/**
 * `degrees` and `index` stay inline (rather than moving into `options`)
 * because the rotate/split naming contract in registry.ts and its tests
 * predate the options bag and remain the canonical shape for those two.
 */
export type OutputKind =
  | { type: 'image'; format: ImageOutputFormat }
  | {
      type: 'pdf-tool';
      tool: PdfTool;
      degrees?: 90 | 180 | 270;
      index?: number;
      options?: ToolOptions;
    }
  | { type: 'doc-tool'; tool: DocTool; index?: number; options?: ToolOptions };

export type ImageFormatKey = ImageOutputFormat | 'heic';

export interface ImageFormatDef {
  type: 'image';
  /** Extensions that decode via this format, e.g. jpg+jpeg both hit 'jpeg'. */
  extensions: string[];
  label: string;
  /** Byte string expected by ImageBitmap->Blob conversion. */
  mime: string;
}

export const IMAGE_FORMATS: Record<ImageFormatKey, ImageFormatDef> = {
  jpeg: { type: 'image', extensions: ['jpg', 'jpeg'], label: 'JPEG', mime: 'image/jpeg' },
  png: { type: 'image', extensions: ['png'], label: 'PNG', mime: 'image/png' },
  webp: { type: 'image', extensions: ['webp'], label: 'WebP', mime: 'image/webp' },
  // HEIC is input-only: browsers cannot encode it, so it never appears as an output.
  heic: { type: 'image', extensions: ['heic', 'heif'], label: 'HEIC/HEIF', mime: 'image/heic' },
};

export const ALL_IMAGE_EXTENSIONS: string[] = Object.values(IMAGE_FORMATS).flatMap(
  (f) => f.extensions,
);

export const PDF_EXTENSIONS = ['pdf'];

/** Office extensions the pipeline can read. */
export const OFFICE_EXTENSIONS = ['docx', 'xlsx', 'csv'];

export const MARKUP_EXTENSIONS = ['html', 'htm'];
