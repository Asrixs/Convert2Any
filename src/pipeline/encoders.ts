import { IMAGE_FORMATS, type ImageOutputFormat } from './formats';

/**
 * WASM encode fallbacks for formats a browser's canvas encoder may not
 * support (WebP on older Safari is the real one). All consume ImageData —
 * raw pixels only, so no metadata can travel through them.
 */

/**
 * Draw a bitmap ready for encoding. JPEG has no alpha channel and encoders
 * turn transparent pixels black, so JPEG output gets a white backdrop first —
 * which is how a transparent image looks on a page anyway.
 */
export function paintForFormat(
  ctx: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  format: ImageOutputFormat,
): void {
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  }
  ctx.drawImage(bitmap, 0, 0);
}

async function imageDataFromBitmap(
  bitmap: ImageBitmap,
  format: ImageOutputFormat,
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Convert2Any: 2D context unavailable');
  paintForFormat(ctx, bitmap, format);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function wasmEncode(
  bitmap: ImageBitmap,
  format: ImageOutputFormat,
  quality: number,
): Promise<Blob> {
  const imageData = await imageDataFromBitmap(bitmap, format);
  const mime = IMAGE_FORMATS[format].mime;
  if (format === 'png') {
    const { encode: encodePng } = await import('@jsquash/png');
    return new Blob([await encodePng(imageData)], { type: mime });
  }
  if (format === 'jpeg') {
    const { encode: encodeJpeg } = await import('@jsquash/jpeg');
    return new Blob([await encodeJpeg(imageData, { quality })], { type: mime });
  }
  const { encode: encodeWebp } = await import('@jsquash/webp');
  return new Blob([await encodeWebp(imageData, { quality })], { type: mime });
}

/** Encode an ImageBitmap to a format the canvas API cannot (or may not) hit. */
export async function encodeBitmap(
  bitmap: ImageBitmap,
  format: ImageOutputFormat,
  quality: number,
): Promise<Blob> {
  try {
    return await wasmEncode(bitmap, format, quality);
  } catch (err) {
    throw new Error(
      `Convert2Any: failed to encode ${format} (${err instanceof Error ? err.message : 'unknown'})`,
      { cause: err },
    );
  }
}
