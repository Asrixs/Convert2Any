import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { htmlToPdf, spreadsheetToPdf } from './office';
import { splitToFit } from './layout';
import { pdfDrawnText as drawnText } from './testutils/pdfContent';

/**
 * Real conversions for the paths that need no browser APIs: HTML to PDF and
 * spreadsheet to PDF both run through the shared block renderer, so these
 * cover the layout engine as well as the converters.
 *
 * PDF-to-Word and PDF-to-Excel are not here: they depend on pdf.js text
 * extraction, which needs the bundled worker, so they are browser-verified.
 */

describe('htmlToPdf', () => {
  it('renders headings and paragraph text into the document', async () => {
    const bytes = await htmlToPdf('<h1>Quarterly report</h1><p>Revenue grew 18 percent.</p>', {});
    const text = drawnText(bytes);
    expect(text).toContain('Quarterly report');
    expect(text).toContain('Revenue grew 18 percent.');
  });

  it('keeps bold runs as text rather than dropping them', async () => {
    const bytes = await htmlToPdf('<p>Growth was <strong>excellent</strong> this year.</p>', {});
    const text = drawnText(bytes);
    expect(text).toContain('excellent');
    expect(text).toContain('Growth was');
  });

  it('renders list markers alongside item text', async () => {
    const bytes = await htmlToPdf('<ol><li>First item</li><li>Second item</li></ol>', {});
    const text = drawnText(bytes);
    expect(text).toContain('First item');
    expect(text).toContain('Second item');
    expect(text).toContain('1.');
    expect(text).toContain('2.');
  });

  it('renders table cells', async () => {
    const bytes = await htmlToPdf(
      '<table><tr><th>Widget</th><th>Count</th></tr><tr><td>Bolt</td><td>42</td></tr></table>',
      {},
    );
    const text = drawnText(bytes);
    expect(text).toContain('Widget');
    expect(text).toContain('Bolt');
    expect(text).toContain('42');
  });

  it('flows long content onto additional pages', async () => {
    const paragraphs = Array.from({ length: 120 }, (_, i) => `<p>Paragraph number ${i}.</p>`).join('');
    const bytes = await htmlToPdf(paragraphs, {});
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('honours the requested page size', async () => {
    const bytes = await htmlToPdf('<p>Hello</p>', { pageSize: 'letter' });
    const doc = await PDFDocument.load(bytes);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(612);
  });

  it('rejects empty input and content-free markup', async () => {
    await expect(htmlToPdf('   ', {})).rejects.toThrow(/no HTML/);
    await expect(htmlToPdf('<div></div>', {})).rejects.toThrow(/no readable content/);
  });

  it('replaces characters the standard fonts cannot encode, without failing', async () => {
    // Emoji are outside WinAnsi; the document must still be produced.
    const bytes = await htmlToPdf('<p>Rocket 🚀 launch</p>', {});
    const text = drawnText(bytes);
    expect(text).toContain('Rocket');
    expect(text).toContain('launch');
  });
});

describe('spreadsheetToPdf', () => {
  /** Build a real .xlsx in memory. */
  function workbook(sheets: Record<string, unknown[][]>): Blob {
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return new Blob([out]);
  }

  it('renders cell values into a table', async () => {
    const file = workbook({
      Sheet1: [
        ['Product', 'Units'],
        ['Hammer', 12],
        ['Chisel', 7],
      ],
    });
    const text = drawnText(await spreadsheetToPdf(file, {}));
    expect(text).toContain('Product');
    expect(text).toContain('Hammer');
    expect(text).toContain('12');
    expect(text).toContain('Chisel');
  });

  it('titles each sheet when a workbook has several', async () => {
    const file = workbook({ Revenue: [['a', 1]], Costs: [['b', 2]] });
    const text = drawnText(await spreadsheetToPdf(file, {}));
    expect(text).toContain('Revenue');
    expect(text).toContain('Costs');
  });

  it('throws on a workbook with no data', async () => {
    await expect(spreadsheetToPdf(workbook({ Empty: [] }), {})).rejects.toThrow(/no data/);
  });
});

describe('runConversion with no input file', () => {
  it('renders pasted HTML when no file was selected', async () => {
    // Regression: html-to-pdf is the one tool that can run file-less, and an
    // unconditional empty-input guard used to reject it before it ran.
    const { runConversion } = await import('./convert');
    const outputs = await runConversion(
      [],
      { type: 'doc-tool', tool: 'html-to-pdf', options: { html: '<h1>Pasted only</h1>' } },
      85,
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.name).toBe('document.pdf');
    expect(drawnText(new Uint8Array(await outputs[0]!.blob.arrayBuffer()))).toContain('Pasted only');
  });

  it('still rejects an empty job for every other tool', async () => {
    const { runConversion } = await import('./convert');
    await expect(
      runConversion([], { type: 'pdf-tool', tool: 'pdf-compress' }, 85),
    ).rejects.toThrow(/no files given/);
    await expect(
      runConversion([], { type: 'doc-tool', tool: 'html-to-pdf', options: { html: '   ' } }, 85),
    ).rejects.toThrow(/no files given/);
  });
});

describe('characters and long words', () => {
  it('draws € and the other WinAnsi extras instead of "?"', async () => {
    // A hand-written allow-list used to turn every € into "?".
    const text = drawnText(await htmlToPdf('<p>Totaal: €1.250 — „citaat” ™ Œuvre</p>', {}));
    // The standard fonts use WinAnsi, where € is byte 0x80, „ 0x84, ™ 0x99, Œ 0x8C.
    expect(text).toContain('\x801.250');
    expect(text).toContain('\x84citaat');
    expect(text).toContain('\x99');
    expect(text).toContain('\x8Cuvre');
    expect(text).not.toContain('?');
  });

  it('breaks a word wider than the line into pieces that fit', async () => {
    const { PDFDocument: Doc, StandardFonts } = await import('pdf-lib');
    const font = await (await Doc.create()).embedFont(StandardFonts.Helvetica);
    const word = 'https://example.com/' + 'a'.repeat(300);
    const pieces = splitToFit(word, font, 11, 200);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join('')).toBe(word);
    for (const piece of pieces) expect(font.widthOfTextAtSize(piece, 11)).toBeLessThanOrEqual(200);
  });
});

describe('spreadsheetToPdf cell text', () => {
  it('shows dates, currency and percentages as the spreadsheet displays them', async () => {
    const sheet = XLSX.utils.aoa_to_sheet(
      [
        ['Date', 'Amount', 'Share'],
        [new Date(Date.UTC(2026, 2, 15)), 1234.5, 0.15],
      ],
      { cellDates: true },
    );
    sheet['B2']!.z = '"€"#,##0.00';
    sheet['C2']!.z = '0%';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
    const file = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer]);

    const text = drawnText(await spreadsheetToPdf(file, {}));
    // Raw values used to come through: 46096.04…, 1234.5 and 0.15.
    expect(text).toContain('3/15/26');
    expect(text).toContain('\x801,234.50');
    expect(text).toContain('15%');
    expect(text).not.toContain('46096');
  });

  it('reads UTF-8 CSV as UTF-8 and keeps values exactly as written', async () => {
    const csv = new File(['Name,Price,Code\nCafé Ü,€5.50,007\n'], 'prices.csv', { type: 'text/csv' });
    const text = drawnText(await spreadsheetToPdf(csv, {}));
    // Read as Latin-1 this used to come out as "CafÃ©" and "â¬5.50".
    expect(text).toContain('Café Ü');
    expect(text).toContain('\x805.50');
    expect(text).toContain('007');
  });

  it('falls back to Windows-1252 for CSV exported by older Excel', async () => {
    // "Café €5" in Windows-1252: é is 0xE9 and € is 0x80 — invalid as UTF-8.
    const bytes = new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x2c, 0x80, 0x35, 0x0a]);
    const csv = new File([bytes], 'export.csv', { type: 'application/vnd.ms-excel' });
    const text = drawnText(await spreadsheetToPdf(csv, {}));
    expect(text).toContain('Café');
    expect(text).toContain('\x805');
  });
});
