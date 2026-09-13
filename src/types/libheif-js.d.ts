/**
 * Ambient declaration for libheif-js's pre-bundled WASM variant, which ships
 * no types of its own. That variant is a CJS bundle evaluated at import time
 * (`module.exports = factory()`), so it exports the initialized Emscripten
 * module — not a factory function. API surface verified against 1.x: images
 * expose get_width/get_height, and display() fills a {data,width,height}
 * payload (NOT an ImageData) and reports via callback.
 */
declare module 'libheif-js/wasm-bundle' {
  export interface HeifDisplayPayload {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }

  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(payload: HeifDisplayPayload, cb: (out: HeifDisplayPayload | null) => void): void;
    free?(): void;
  }

  export interface HeifDecoder {
    decode(buffer: ArrayBuffer): HeifImage[];
  }

  export interface HeifModule {
    HeifDecoder: new () => HeifDecoder;
  }

  const libheif: HeifModule;
  export default libheif;
}
