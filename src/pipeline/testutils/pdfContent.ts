import { inflateSync } from 'node:zlib';

/**
 * Test-only helper: read back the text a generated PDF actually draws.
 *
 * Asserting on drawn text (rather than "the call did not throw") is what makes
 * the conversion tests meaningful, and it takes three steps:
 *
 *  1. Content streams are Flate-compressed, so each is inflated.
 *  2. pdf-lib writes show-text operands as hex strings — `<506167652031> Tj`.
 *  3. The renderer draws word by word, so operators sit between words. Only
 *     the text operands are kept and concatenated, which reconstitutes the
 *     readable line.
 *
 * Not imported by application code — it uses node:zlib and exists purely for
 * the test suite.
 */
export function pdfDrawnText(bytes: Uint8Array): string {
  const operands: string[] = [];

  for (const content of inflatedStreams(bytes)) {
    for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const hex = match[1]!;
      if (hex.length % 2 !== 0) continue;
      let text = '';
      for (let i = 0; i < hex.length; i += 2) {
        text += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
      }
      operands.push(text);
    }
    // Literal strings appear when a font needs no custom encoding.
    for (const match of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      operands.push(match[1]!.replace(/\\([()\\])/g, '$1'));
    }
  }
  return operands.join('');
}

/** Every Flate content stream in the file, inflated. */
function inflatedStreams(bytes: Uint8Array): string[] {
  const buffer = Buffer.from(bytes);
  const streams: string[] = [];
  let cursor = 0;

  for (;;) {
    const start = buffer.indexOf('stream', cursor);
    if (start === -1) break;
    const end = buffer.indexOf('endstream', start);
    if (end === -1) break;

    // Skip the EOL that must follow the `stream` keyword.
    let from = start + 'stream'.length;
    if (buffer[from] === 0x0d) from += 1;
    if (buffer[from] === 0x0a) from += 1;

    try {
      streams.push(inflateSync(buffer.subarray(from, end)).toString('latin1'));
    } catch {
      // Not a Flate stream (an image, or already plain) — nothing to read.
    }
    // Past the whole `endstream` token: it contains "stream" itself, so
    // advancing by one would re-match and desynchronise the scan.
    cursor = end + 'endstream'.length;
  }
  return streams;
}
