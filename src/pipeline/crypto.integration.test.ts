import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { protectPdf, unlockPdf } from './crypto';
import { mergePdfs, rotatePdf, watermarkPdf } from './pdf';
import { pdfDrawnText as drawnText } from './testutils/pdfContent';

/**
 * Real qpdf (WASM) round trips, run in Node.
 *
 * In the browser, crypto.ts points Emscripten at the bundled .wasm URL. Node
 * cannot fetch that, so the factory is wrapped to hand it the WASM bytes
 * straight from node_modules. Everything else is the code the app runs.
 */
vi.mock('@jspawn/qpdf-wasm/qpdf.wasm?url', () => ({ default: 'qpdf.wasm' }));
vi.mock('@jspawn/qpdf-wasm/qpdf.js', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const factory = require('@jspawn/qpdf-wasm/qpdf.js') as (o: object) => Promise<unknown>;
  const wasm = readFileSync(require.resolve('@jspawn/qpdf-wasm/qpdf.wasm'));
  return {
    default: (options: object) =>
      factory({
        ...options,
        instantiateWasm: (
          imports: WebAssembly.Imports,
          done: (instance: WebAssembly.Instance) => void,
        ) => {
          void WebAssembly.instantiate(wasm, imports).then((result) => done(result.instance));
          return {};
        },
      }),
  };
});

async function makePdf(text = 'Top secret figures'): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([300, 400]).drawText(text, { x: 40, y: 200, size: 18, font });
  return blobOf(await doc.save());
}

function blobOf(bytes: Uint8Array): Blob {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}

describe('protectPdf / unlockPdf', () => {
  it('encrypts with AES-256 and decrypts back to readable text', async () => {
    const locked = await protectPdf(await makePdf(), { password: 'correct horse' });
    const raw = Buffer.from(locked).toString('latin1');
    expect(raw).toContain('/Encrypt');
    expect(raw).toMatch(/\/V 5/); // V5 is the AES-256 security handler
    expect(drawnText(locked)).not.toContain('Top secret figures');

    const unlocked = await unlockPdf(blobOf(locked), { password: 'correct horse' });
    expect(drawnText(unlocked)).toContain('Top secret figures');
  });

  it('uses the password exactly as typed, spaces included', async () => {
    const locked = await protectPdf(await makePdf(), { password: ' pass ' });
    await expect(unlockPdf(blobOf(locked), { password: 'pass' })).rejects.toThrow(/password/);
    const unlocked = await unlockPdf(blobOf(locked), { password: ' pass ' });
    expect(drawnText(unlocked)).toContain('Top secret figures');
  });

  it('rejects a wrong password', async () => {
    const locked = await protectPdf(await makePdf(), { password: 'right' });
    await expect(unlockPdf(blobOf(locked), { password: 'wrong' })).rejects.toThrow(/password/);
  });

  it('rejects a blank password', async () => {
    await expect(protectPdf(await makePdf(), { password: '   ' })).rejects.toThrow(/required/);
  });
});

describe('editing tools on encrypted PDFs', () => {
  it('refuse with a next step instead of producing blank pages', async () => {
    // pdf-lib cannot decrypt, so before this check any encrypted input —
    // including "restricted" PDFs that open without a password — was copied
    // with its content still encrypted, and came out as blank pages.
    const encrypted = blobOf(await protectPdf(await makePdf(), { password: 'pw' }));
    await expect(mergePdfs([await makePdf(), encrypted])).rejects.toThrow(/Unlock PDF/);
    await expect(rotatePdf(encrypted, 90)).rejects.toThrow(/password-protected/);
    await expect(watermarkPdf(encrypted, { text: 'DRAFT' })).rejects.toThrow(/password-protected/);
  });
});
