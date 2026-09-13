/**
 * Ambient declarations for dependencies that ship no types.
 *
 * Each is typed to exactly the surface Convert2Any calls, so a wrong argument
 * is still a compile error rather than `any` leaking through the codebase.
 */

declare module '@jspawn/qpdf-wasm/qpdf.js' {
  interface QpdfEmscriptenModule {
    /** Runs qpdf's CLI main(). Single-shot: one call per module instance. */
    callMain(args: string[]): void;
    FS: {
      writeFile(path: string, data: Uint8Array): void;
      readFile(path: string): Uint8Array;
    };
  }
  /** Emscripten MODULARIZE factory. */
  export default function createQpdfModule(
    options?: Record<string, unknown>,
  ): Promise<QpdfEmscriptenModule>;
}

declare module '@jspawn/qpdf-wasm/qpdf.wasm?url' {
  const url: string;
  export default url;
}

declare module 'mammoth/mammoth.browser.js' {
  interface ConvertInput {
    arrayBuffer: ArrayBuffer;
  }
  interface ConvertMessage {
    type: string;
    message: string;
  }
  interface ConvertResult {
    value: string;
    messages: ConvertMessage[];
  }
  export function convertToHtml(input: ConvertInput): Promise<ConvertResult>;
  export function extractRawText(input: ConvertInput): Promise<ConvertResult>;
}
