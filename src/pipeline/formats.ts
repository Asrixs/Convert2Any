/**
 * Canonical format definitions. The registry in registry.ts derives all
 * user-facing copy (accepted inputs, output labels) from these tables, so
 * adding a format means touching formats.ts + decoders/encoders only.
 */

export type ImageOutputFormat = 'jpeg' | 'png' | 'webp';

export type PdfTool = 'pdf-merge' | 'pdf-split' | 'pdf-rotate';

export type OutputKind =
  | { type: 'image'; format: ImageOutputFormat }
  | { type: 'pdf-tool'; tool: PdfTool; degrees?: 90 | 180 | 270; index?: number };

export type ImageFormatKey = ImageOutputFormat | 'heic';

export interface ImageFormatDef {
  type: 'image';
  /** Extensions that decode via this format, e.g. jpg+jpeg both hit 'jpeg'. */
  extensions: string[];
  label: string;
  /** Byte string expected by ImageBitmap→Blob conversion. */
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
