import { IMAGE_FORMATS, type ImageOutputFormat } from './formats';
import { encodeBitmap } from './encoders';

/**
 * Decision note — metadata stripping by construction:
 *
 * We never parse or surgically remove EXIF. Inputs are decoded to raw pixels
 * (createImageBitmap with the spec-default 'from-image' orientation bakes JPEG
 * rotation into the bitmap; libheif yields flat pixel data), and outputs are
 * freshly encoded from those pixels. EXIF, GPS, and camera metadata cannot
 * appear in an output because no code path carries metadata from input to
 * output. The only hard requirement is that every decoder produces upright,
 * raw pixels — which decoders.ts guarantees.
 *
 * Why not @jsquash encoders for everything? The canvas encoder is faster and
 * ships in every browser; the WASM path (encoders.ts) is the fallback for
 * formats canvas cannot encode (notably WebP on older Safari). Both consume
 * raw pixels, so the stripping guarantee is identical.
 */

/**
 * Encode a decoded bitmap as a clean, metadata-free blob.
 * `quality` is 1–100 and applies to lossy formats (jpeg/webp).
 */
export async function encodeStripped(
  bitmap: ImageBitmap,
  format: ImageOutputFormat,
  quality = 85,
): Promise<Blob> {
  const def = IMAGE_FORMATS[format];
  if (!def) throw new Error(`no-upload: unknown output format "${format}"`);

  // Native canvas encode: the bitmap holds upright raw pixels, so the fresh
  // encode carries no metadata by construction.
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({
      type: def.mime,
      quality: format === 'png' ? undefined : quality / 100,
    });
  } catch {
    // Canvas refused (older WebP support, exotic profiles): fall back to WASM.
    return encodeBitmap(bitmap, format, quality);
  }
}
