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
function wrap(
  runs: Run[],
  fonts: Fonts,
  size: number,
  maxWidth: number,
  clean: (text: string) => string,
): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const run of runs) {
    const font = pick(fonts, run);
    const pieces = run.text.split(/(\s+)/).filter((p) => p !== '');
    for (const piece of pieces) {
      if (/^\s+$/.test(piece)) {
        if (line.length === 0) continue;
        const width = font.widthOfTextAtSize(' ', size);
        line.push({ text: ' ', font, width });
        lineWidth += width;
        continue;
      }
      // Clean BEFORE measuring, so the width is that of what gets drawn.
      for (const text of splitToFit(clean(piece), font, size, maxWidth)) {
        const width = font.widthOfTextAtSize(text, size);
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
  }
  if (line.length > 0) lines.push(line);
  return lines.length > 0 ? lines : [[]];
}

/**
 * Break a word wider than the line (a long URL, an ID in a narrow table
 * column) into pieces that fit, instead of letting it run off the page.
 * Character widths are summed rather than re-measured, so this stays linear.
 */
export function splitToFit(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const pieces: string[] = [];
  let piece = '';
  let width = 0;
  for (const ch of word) {
    const charWidth = font.widthOfTextAtSize(ch, size);
    if (piece !== '' && width + charWidth > maxWidth) {
      pieces.push(piece);
      piece = '';
      width = 0;
    }
    piece += ch;
    width += charWidth;
  }
  if (piece !== '') pieces.push(piece);
  return pieces;
}

/**
 * Build a cleaner that swaps characters the standard PDF fonts cannot draw
 * for "?". The drawable set comes from the font itself (WinAnsi: ASCII,
 * Latin-1 and extras such as \u20ac \u201e \u2122 \u0152 \u0160), so nothing drawable is thrown away
 * \u2014 a hand-written list is how "\u20ac" once came out as "?". Tabs become spaces.
 */
function makeCleaner(font: PDFFont): (text: string) => string {
  const drawable = new Set(font.getCharacterSet());
  return (text) => {
    let out = '';
    for (const ch of text.replace(/\t/g, '    ')) {
      out += drawable.has(ch.codePointAt(0)!) ? ch : '?';
    }
    return out;
  };
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
  // Every standard font here shares the WinAnsi encoding, so one cleaner fits all.
  const clean = makeCleaner(fonts.regular);

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
        // Words were cleaned in wrap(), so every character is drawable.
        page.drawText(word.text, { x, y: y - size, size, font: word.font, color: black });
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
        drawLines(wrap(runs, fonts, size, maxWidth, clean), size, 0, size * 1.35);
        y -= size * 0.25;
        break;
      }
      case 'paragraph': {
        drawLines(wrap(block.runs, fonts, base, maxWidth, clean), base, 0, base * 1.5);
        y -= base * 0.5;
        break;
      }
      case 'list-item': {
        const indent = base * 1.6;
        const lines = wrap(block.runs, fonts, base, maxWidth - indent, clean);
        // Draw the marker on the first line only, then indent the rest.
        ensureSpace(base * 1.5);
        page.drawText(clean(block.marker), {
          x: margin,
          y: y - base,
          size: base,
          font: fonts.regular,
          color: black,
        });
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
        for (const rawLine of block.text.split(/\r?\n/)) {
          ensureSpace(size * 1.4);
          page.drawText(clean(rawLine), {
            x: margin,
            y: y - size,
            size,
            font: fonts.mono,
            color: black,
          });
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
        wrap(
          [{ text: row[c] ?? '' }],
          { ...fonts, regular: font },
          size,
          colWidth - padding * 2,
          clean,
        ),
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
            page.drawText(word.text, { x: tx, y: ty - size, size, font: word.font, color: black });
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
