/**
 * Block-model -> PDF renderer.
 *
 * Shared by HTML-to-PDF and Word-to-PDF. It draws real text with pdf-lib
 * rather than screenshotting a rendered page, which is a deliberate trade:
 * the output keeps SELECTABLE, SEARCHABLE text and stays small, at the cost
 * of not reproducing CSS. That matches the "text-fidelity" promise the UI
 * makes for these tools.
 */
import type { PDFFont } from 'pdf-lib';
import type { Block, Run } from './blocks';

export interface LayoutOptions {
  pageSize?: 'a4' | 'letter';
  margin?: number;
  baseFontSize?: number;
  title?: string;
}

const SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
} as const;

const HEADING_SCALE: Record<number, number> = { 1: 2, 2: 1.6, 3: 1.35, 4: 1.2, 5: 1.1, 6: 1 };

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  mono: PDFFont;
}

function pick(fonts: Fonts, run: Run): PDFFont {
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
}

/** One laid-out piece of text at a resolved position. */
interface Word {
  text: string;
  font: PDFFont;
  width: number;
}

/**
 * Greedy word wrap across styled runs. Runs are split into words so a bold
 * phrase mid-sentence wraps at the right place instead of jumping a line.
 */
function wrap(runs: Run[], fonts: Fonts, size: number, maxWidth: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const run of runs) {
    const font = pick(fonts, run);
    const pieces = run.text.split(/(\s+)/).filter((p) => p !== '');
    for (const piece of pieces) {
      const isSpace = /^\s+$/.test(piece);
      const text = isSpace ? ' ' : piece;
      let width: number;
      try {
        width = font.widthOfTextAtSize(text, size);
      } catch {
        // WinAnsi cannot encode every character; fall back to an estimate
        // rather than aborting the whole document.
        width = size * 0.5 * text.length;
      }
      if (isSpace) {
        if (line.length === 0) continue;
        line.push({ text, font, width });
        lineWidth += width;
        continue;
      }
      if (lineWidth + width > maxWidth && line.length > 0) {
        // Drop a trailing space before breaking.
        while (line.length > 0 && line[line.length - 1]!.text === ' ') {
          lineWidth -= line.pop()!.width;
        }
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      line.push({ text, font, width });
      lineWidth += width;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.length > 0 ? lines : [[]];
}

/**
 * Replace characters the standard WinAnsi fonts cannot encode.
 *
 * The allowed set is written with escapes rather than literal glyphs so no
 * invisible character can hide inside the class: tab/LF/CR, printable ASCII,
 * Latin-1, and the typographic marks WinAnsi adds (smart quotes, en/em dash,
 * bullet, ellipsis).
 */
function sanitize(text: string): string {
  const ENCODABLE =
    // eslint-disable-next-line no-control-regex -- tab/LF/CR are intentionally kept
    /[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u2018\u2019\u201c\u201d\u2013\u2014\u2022\u2026]/g;
  return text.replace(ENCODABLE, '?');
}

/** Render blocks into a fresh PDF document. */
export async function renderBlocksToPdf(
  blocks: Block[],
  options: LayoutOptions = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  if (options.title) doc.setTitle(options.title);

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };

  const [pageWidth, pageHeight] = SIZES[options.pageSize ?? 'a4'];
  const margin = options.margin ?? 56;
  const base = options.baseFontSize ?? 11;
  const maxWidth = pageWidth - margin * 2;
  const black = rgb(0.08, 0.08, 0.08);
  const grayRule = rgb(0.75, 0.75, 0.75);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed: number): void {
    if (y - needed >= margin) return;
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  function drawLines(lines: Word[][], size: number, indent: number, leading: number): void {
    for (const line of lines) {
      ensureSpace(leading);
      let x = margin + indent;
      for (const word of line) {
        try {
          page.drawText(sanitize(word.text), { x, y: y - size, size, font: word.font, color: black });
        } catch {
          // A single unencodable word must not abort the document.
        }
        x += word.width;
      }
      y -= leading;
    }
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const size = base * (HEADING_SCALE[block.level] ?? 1);
        y -= size * 0.5;
        const runs = block.runs.map((r) => ({ ...r, bold: true }));
        drawLines(wrap(runs, fonts, size, maxWidth), size, 0, size * 1.35);
        y -= size * 0.25;
        break;
      }
      case 'paragraph': {
        drawLines(wrap(block.runs, fonts, base, maxWidth), base, 0, base * 1.5);
        y -= base * 0.5;
        break;
      }
      case 'list-item': {
        const indent = base * 1.6;
        const lines = wrap(block.runs, fonts, base, maxWidth - indent);
        // Draw the marker on the first line only, then indent the rest.
        ensureSpace(base * 1.5);
        try {
          page.drawText(sanitize(block.marker), {
            x: margin,
            y: y - base,
            size: base,
            font: fonts.regular,
            color: black,
          });
        } catch {
          /* marker is decorative */
        }
        drawLines(lines, base, indent, base * 1.5);
        break;
      }
      case 'rule': {
        ensureSpace(base);
        page.drawLine({
          start: { x: margin, y: y - base / 2 },
          end: { x: pageWidth - margin, y: y - base / 2 },
          thickness: 0.75,
          color: grayRule,
        });
        y -= base * 1.5;
        break;
      }
      case 'pre': {
        const size = base * 0.9;
        for (const rawLine of block.text.split('\n')) {
          ensureSpace(size * 1.4);
          try {
            page.drawText(sanitize(rawLine), {
              x: margin,
              y: y - size,
              size,
              font: fonts.mono,
              color: black,
            });
          } catch {
            /* skip unencodable line */
          }
          y -= size * 1.4;
        }
        y -= base * 0.5;
        break;
      }
      case 'table': {
        drawTable(block.rows);
        break;
      }
    }
  }

  function drawTable(rows: string[][]): void {
    if (rows.length === 0) return;
    const columns = Math.max(...rows.map((r) => r.length));
    if (columns === 0) return;
    const colWidth = maxWidth / columns;
    const size = base * 0.9;
    const padding = 4;

    for (const [rowIndex, row] of rows.entries()) {
      const isHeader = rowIndex === 0;
      const font = isHeader ? fonts.bold : fonts.regular;
      // Height is driven by the tallest wrapped cell in the row.
      const cellLines = Array.from({ length: columns }, (_, c) =>
        wrap([{ text: row[c] ?? '' }], { ...fonts, regular: font }, size, colWidth - padding * 2),
      );
      const rowHeight = Math.max(...cellLines.map((l) => l.length)) * size * 1.35 + padding * 2;
      ensureSpace(rowHeight);

      const top = y;
      for (let c = 0; c < columns; c++) {
        const x = margin + c * colWidth;
        page.drawRectangle({
          x,
          y: top - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderColor: grayRule,
          borderWidth: 0.5,
        });
        let ty = top - padding;
        for (const line of cellLines[c] ?? []) {
          let tx = x + padding;
          for (const word of line) {
            try {
              page.drawText(sanitize(word.text), {
                x: tx,
                y: ty - size,
                size,
                font: word.font,
                color: black,
              });
            } catch {
              /* skip */
            }
            tx += word.width;
          }
          ty -= size * 1.35;
        }
      }
      y = top - rowHeight;
    }
    y -= base * 0.5;
  }

  return doc.save();
}
