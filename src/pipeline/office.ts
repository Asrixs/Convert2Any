/**
 * Office and markup conversions — all in the browser, all lazy-loaded.
 *
 * FIDELITY, STATED PLAINLY. Faithful Office conversion is a layout-engine
 * problem that real products solve with LibreOffice on a server. Convert2Any
 * has no server, so these routines are text-fidelity: words, order, headings,
 * lists and tables survive; exact typography, positioning, floats, and
 * embedded drawings do not. Every tool using this module carries a
 * "text-fidelity" badge in the UI so the limitation is visible before upload,
 * not discovered afterwards.
 *
 * PowerPoint is deliberately absent: PPTX is a slide-canvas format whose
 * layout cannot be approximated honestly this way, so the catalog marks it
 * unavailable instead of shipping something that looks broken.
 */
import type { Block } from './blocks';
import { parseHtmlBlocks } from './blocks';
import { renderBlocksToPdf, type LayoutOptions } from './layout';
import { extractPdfText, groupIntoLines, inferColumns, lineToString, linesToRows } from './pdftext';
import type { ToolOptions } from './formats';

/** HTML source -> PDF with selectable text. */
export async function htmlToPdf(html: string, options: ToolOptions): Promise<Uint8Array> {
  if (html.trim() === '') throw new Error('Convert2Any: there is no HTML to convert');
  const blocks = parseHtmlBlocks(html);
  if (blocks.length === 0) throw new Error('Convert2Any: that HTML produced no readable content');
  return renderBlocksToPdf(blocks, layoutFrom(options));
}

/** Word (.docx) -> PDF, via mammoth's semantic HTML. */
export async function docxToPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const mammoth = await import('mammoth/mammoth.browser.js');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const blocks = parseHtmlBlocks(html);
  if (blocks.length === 0) throw new Error('Convert2Any: this document had no extractable text');
  return renderBlocksToPdf(blocks, layoutFrom(options));
}

/**
 * CSV is detected by file name: Windows reports .csv files as
 * application/vnd.ms-excel when Excel is installed, so the MIME type alone
 * cannot be trusted.
 */
function isCsv(file: Blob): boolean {
  if (typeof File !== 'undefined' && file instanceof File) return /\.csv$/i.test(file.name);
  return file.type === 'text/csv';
}

/**
 * CSV text, decoded as UTF-8 when the bytes are valid UTF-8, otherwise as
 * Windows-1252 — what Excel's plain "CSV (comma delimited)" export writes.
 */
async function csvText(file: Blob): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Spreadsheet (.xlsx/.csv) -> PDF, one table per sheet. */
export async function spreadsheetToPdf(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  // CSV is text: decode it ourselves (handed raw bytes, SheetJS reads them as
  // Latin-1, so UTF-8 "Café" became "CafÃ©"), and keep every value exactly as
  // written rather than letting "007" become 7 or a date be reformatted.
  const workbook = isCsv(file)
    ? XLSX.read(await csvText(file), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const blocks: Block[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    // raw: false gives each cell's text as the spreadsheet displays it: dates
    // as dates rather than serial numbers like 46096, "€1,234.50" rather than
    // 1234.5, "15%" rather than 0.15.
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });
    const cleaned = rows
      .map((row) => (Array.isArray(row) ? row.map((cell) => stringifyCell(cell)) : []))
      .filter((row) => row.some((cell) => cell !== ''));
    if (cleaned.length === 0) continue;
    // Name each sheet so a multi-sheet workbook stays navigable.
    if (workbook.SheetNames.length > 1) {
      blocks.push({ type: 'heading', level: 2, runs: [{ text: name, bold: true }] });
    }
    blocks.push({ type: 'table', rows: cleaned });
  }

  if (blocks.length === 0) throw new Error('Convert2Any: this spreadsheet had no data');
  return renderBlocksToPdf(blocks, { ...layoutFrom(options), pageSize: options.pageSize === 'letter' ? 'letter' : 'a4' });
}

/**
 * PDF -> Word (.docx). Text is recovered per page and emitted as paragraphs
 * with page breaks; styling and positioning are not recovered.
 */
export async function pdfToDocx(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const { pages } = await extractPdfText(file, options.password);

  const children: InstanceType<typeof Paragraph>[] = [];
  for (const [pageIndex, items] of pages.entries()) {
    const lines = groupIntoLines(items).map((line) => lineToString(line));
    for (const line of lines) {
      if (line === '') continue;
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
    const isLast = pageIndex === pages.length - 1;
    if (!isLast) children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

  if (children.length === 0) {
    throw new Error(
      'Convert2Any: no text found. This PDF is probably scanned images, which needs OCR',
    );
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * PDF -> Excel (.xlsx). Column boundaries are inferred from the x positions
 * shared across lines; a PDF without tabular structure yields one cell per
 * line rather than a fabricated grid.
 */
export async function pdfToSpreadsheet(file: Blob, options: ToolOptions): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const { pages } = await extractPdfText(file, options.password);
  const workbook = XLSX.utils.book_new();
  let added = 0;

  for (const [index, items] of pages.entries()) {
    const lines = groupIntoLines(items);
    if (lines.length === 0) continue;
    const rows = linesToRows(lines, inferColumns(lines));
    const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
    if (nonEmpty.length === 0) continue;
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(nonEmpty),
      `Page ${index + 1}`.slice(0, 31),
    );
    added += 1;
  }

  if (added === 0) {
    throw new Error(
      'Convert2Any: no text found. This PDF is probably scanned images, which needs OCR',
    );
  }
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

function stringifyCell(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell);
}

function layoutFrom(options: ToolOptions): LayoutOptions {
  const layout: LayoutOptions = {
    pageSize: options.pageSize === 'letter' ? 'letter' : 'a4',
  };
  if (options.margin !== undefined) layout.margin = options.margin;
  if (options.fontSize !== undefined) layout.baseFontSize = options.fontSize;
  if (options.title !== undefined) layout.title = options.title;
  return layout;
}
