import { ALL_IMAGE_EXTENSIONS } from './formats';

/**
 * Lazy decoders. Everything funnels to a canvas-convertible ImageBitmap so
 * encode and metadata-stripping can treat every input uniformly.
 *
 * Orientation: createImageBitmap's default imageOrientation is 'from-image',
 * which bakes EXIF rotation into pixels for JPEG inputs in modern browsers.
 * That is the spec-default behavior; see the decision note in exif.ts.
 */

async function nativeDecode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (err) {
    throw new Error(
      `no-upload: browser could not decode this file natively (${err instanceof Error ? err.message : 'unknown error'})`,
      { cause: err },
    );
  }
}

async function imageBitmapFromImageData(img: ImageData): Promise<ImageBitmap> {
  // OffscreenCanvas exists in every browser that also ships the WASM codecs we
  // use; this guard is for the type system, not for real browsers.
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('no-upload: OffscreenCanvas unavailable — cannot convert this file');
  }
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-upload: 2D context unavailable');
  ctx.putImageData(img, 0, 0);
  return canvas.transferToImageBitmap();
}

async function pngDecode(data: ArrayBuffer): Promise<ImageBitmap> {
  // Fallback for PNGs the browser refuses (rare color profiles, 16-bit oddities).
  const { decode: pngDecodeWasm } = await import('@jsquash/png');
  const imageData = await pngDecodeWasm(data);
  return imageBitmapFromImageData(imageData);
}

async function heicDecode(data: ArrayBuffer): Promise<ImageBitmap> {
  // libheif-js/wasm-bundle: pre-bundled WASM, the variant the README says is
  // meant for browser bundlers. Loaded only when a HEIC/HEIF file arrives.
  // NOTE: this variant exports the *initialized* Emscripten module (CJS:
  // module.exports = factory()), not a factory — HeifDecoder lives on it.
  const mod = await import('libheif-js/wasm-bundle');
  const libheif = mod.default ?? mod;
  if (!libheif || typeof libheif.HeifDecoder !== 'function') {
    throw new Error('no-upload: HEIC decoder failed to initialize');
  }
  const decoder = new libheif.HeifDecoder();
  const frames = decoder.decode(data);
  if (!frames || frames.length === 0) {
    throw new Error('no-upload: HEIC container had no decodable image');
  }
  const image = frames[0]!;
  // libheif-js exposes get_width/get_height (no getDimensions).
  const w = image.get_width() | 0;
  const h = image.get_height() | 0;
  if (w <= 0 || h <= 0) throw new Error('no-upload: HEIC image had invalid dimensions');

  const payload = {
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  };
  await new Promise<void>((resolve, reject) => {
    image.display(payload, (out) => {
      if (!out || !out.data) reject(new Error('no-upload: HEIC decode failed'));
      else resolve();
    });
  });
  try {
    image.free?.();
  } catch {
    // Release is best-effort; decoding already succeeded.
  }
  const imageData = new ImageData(payload.data, w, h);
  return imageBitmapFromImageData(imageData);
}

/** Decode any supported input to an ImageBitmap. */
export async function decodeInput(file: Blob, ext: string): Promise<ImageBitmap> {
  if (!ALL_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`no-upload: "${ext}" is not a decodable image format`);
  }
  if (ext === 'png') {
    try {
      return await nativeDecode(file);
    } catch {
      return pngDecode(await file.arrayBuffer());
    }
  }
  if (ext === 'heic' || ext === 'heif') {
    return heicDecode(await file.arrayBuffer());
  }
  // jpeg, webp: native decode (rotation baked for JPEG via from-image).
  return nativeDecode(file);
}
