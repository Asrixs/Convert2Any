/**
 * A tiny, dependency-free HTML -> block-model parser.
 *
 * Why hand-rolled instead of DOMParser: this runs inside a Web Worker, and
 * DOMParser does not exist there. Keeping the parser pure also makes the
 * whole HTML/DOCX -> PDF path unit-testable in Node with no browser at all.
 *
 * The scope is deliberately "document structure", not "a browser": headings,
 * paragraphs, lists, tables, rules, preformatted text, and bold/italic runs.
 * That is exactly what survives a text-fidelity conversion, so parsing more
 * would imply a fidelity the renderer cannot deliver.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; runs: Run[] }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'list-item'; runs: Run[]; ordered: boolean; marker: string }
  | { type: 'rule' }
  | { type: 'pre'; text: string }
  | { type: 'table'; rows: string[][] };

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  para: '¶',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  permil: '‰',
  laquo: '«',
  raquo: '»',
  sbquo: '‚',
  bdquo: '„',
  dagger: '†',
  Dagger: '‡',
  iexcl: '¡',
  iquest: '¿',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  auml: 'ä',
  Auml: 'Ä',
  aring: 'å',
  Aring: 'Å',
  aelig: 'æ',
  AElig: 'Æ',
  ccedil: 'ç',
  Ccedil: 'Ç',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  Egrave: 'È',
  ecirc: 'ê',
  euml: 'ë',
  iacute: 'í',
  iuml: 'ï',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  oacute: 'ó',
  ocirc: 'ô',
  ouml: 'ö',
  Ouml: 'Ö',
  oslash: 'ø',
  Oslash: 'Ø',
  uacute: 'ú',
  uuml: 'ü',
  Uuml: 'Ü',
  szlig: 'ß',
};

/** Decode the entity forms that actually appear in real documents. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    // Entity names are case-sensitive (&Eacute; is É, &eacute; is é); the
    // lowercase fallback only rescues shouty spellings such as &AMP;.
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Elements whose text is never page content: code, styles, the document
 * <title> (it belongs in the browser tab, not on the page), inert templates,
 * and SVG labels.
 * <head> itself is not listed because its closing tag may be omitted.
 */
const SKIPPED_TAGS = new Set(['script', 'style', 'title', 'template', 'noscript', 'svg']);

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'tr',
  'br',
]);

interface Token {
  kind: 'tag' | 'text';
  name: string;
  closing: boolean;
  text: string;
}

/** Split markup into tags and text, dropping comments and doctype. */
function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      tokens.push({ kind: 'text', name: '', closing: false, text: html.slice(i) });
      break;
    }
    if (lt > i) {
      tokens.push({ kind: 'text', name: '', closing: false, text: html.slice(i, lt) });
    }
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const gt = html.indexOf('>', lt);
    if (gt === -1) break;
    const raw = html.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (raw === '' || raw.startsWith('!') || raw.startsWith('?')) continue;

    const closing = raw.startsWith('/');
    const name = (closing ? raw.slice(1) : raw).split(/[\s/>]/, 1)[0]?.toLowerCase() ?? '';
    if (name === '') continue;
    tokens.push({ kind: 'tag', name, closing, text: raw });
  }
  return tokens;
}

/** Collapse runs of whitespace the way HTML rendering does. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/**
 * Parse an HTML fragment or document into an ordered list of blocks.
 * Unknown tags are transparent: their text still comes through.
 */
export function parseHtmlBlocks(html: string): Block[] {
  const tokens = tokenize(html);
  const blocks: Block[] = [];

  let runs: Run[] = [];
  let bold = 0;
  let italic = 0;
  let heading: 1 | 2 | 3 | 4 | 5 | 6 | null = null;
  let skipDepth = 0; // inside <script>/<style>
  let preDepth = 0;
  let preText = '';

  const listStack: { ordered: boolean; count: number }[] = [];
  let pendingListItem = false;

  // Tables are accumulated then emitted whole, so cells keep their grid.
  let table: string[][] | null = null;
  let row: string[] | null = null;
  let cell: string | null = null;

  function pushText(text: string): void {
    if (text === '') return;
    if (cell !== null) {
      cell += text;
      return;
    }
    const last = runs[runs.length - 1];
    // Merge adjacent runs sharing a style so the renderer wraps cleanly.
    if (last && !!last.bold === bold > 0 && !!last.italic === italic > 0) {
      last.text += text;
      return;
    }
    const run: Run = { text };
    if (bold > 0) run.bold = true;
    if (italic > 0) run.italic = true;
    runs.push(run);
  }

  function flush(): void {
    const text = runs.map((r) => r.text).join('');
    if (text.trim() === '') {
      runs = [];
      pendingListItem = false;
      heading = null;
      return;
    }
    // Trim the edges without losing the internal run structure.
    const trimmed = trimRuns(runs);
    if (heading !== null) {
      blocks.push({ type: 'heading', level: heading, runs: trimmed });
    } else if (pendingListItem) {
      const list = listStack[listStack.length - 1];
      const ordered = list?.ordered ?? false;
      const marker = ordered ? `${list ? list.count : 1}.` : '•';
      blocks.push({ type: 'list-item', runs: trimmed, ordered, marker });
    } else {
      blocks.push({ type: 'paragraph', runs: trimmed });
    }
    runs = [];
    pendingListItem = false;
    heading = null;
  }

  for (const token of tokens) {
    if (token.kind === 'text') {
      if (skipDepth > 0) continue;
      if (preDepth > 0) {
        preText += decodeEntities(token.text);
        continue;
      }
      pushText(collapse(decodeEntities(token.text)));
      continue;
    }

    const { name, closing } = token;

    if (SKIPPED_TAGS.has(name)) {
      // A self-closing <svg/> has no content to skip and no end tag to wait for.
      if (!closing && token.text.endsWith('/')) continue;
      skipDepth += closing ? -1 : 1;
      if (skipDepth < 0) skipDepth = 0;
      continue;
    }
    if (skipDepth > 0) continue;

    if (name === 'pre') {
      if (closing) {
        preDepth = Math.max(0, preDepth - 1);
        if (preDepth === 0 && preText.trim() !== '') {
          blocks.push({ type: 'pre', text: preText.replace(/^\n+|\n+$/g, '') });
          preText = '';
        }
      } else {
        flush();
        preDepth += 1;
      }
      continue;
    }
    if (preDepth > 0) continue;

    switch (name) {
      case 'b':
      case 'strong':
        bold += closing ? -1 : 1;
        bold = Math.max(0, bold);
        break;
      case 'i':
      case 'em':
        italic += closing ? -1 : 1;
        italic = Math.max(0, italic);
        break;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        flush();
        heading = closing ? null : (Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6);
        break;
      }
      case 'hr':
        flush();
        blocks.push({ type: 'rule' });
        break;
      case 'br':
        flush();
        break;
      case 'ul':
      case 'ol':
        flush();
        if (closing) listStack.pop();
        else listStack.push({ ordered: name === 'ol', count: 0 });
        break;
      case 'li':
        if (closing) {
          flush();
        } else {
          flush();
          const list = listStack[listStack.length - 1];
          if (list) list.count += 1;
          pendingListItem = true;
        }
        break;
      case 'table':
        flush();
        if (closing) {
          if (table && table.length > 0) blocks.push({ type: 'table', rows: table });
          table = null;
        } else {
          table = [];
        }
        break;
      case 'tr':
        if (!table) break;
        if (closing) {
          if (row) table.push(row);
          row = null;
        } else {
          row = [];
        }
        break;
      case 'td':
      case 'th':
        if (!row) break;
        if (closing) {
          row.push((cell ?? '').trim());
          cell = null;
        } else {
          cell = '';
        }
        break;
      default:
        if (BLOCK_TAGS.has(name)) flush();
        break;
    }
  }

  if (preDepth > 0 && preText.trim() !== '') blocks.push({ type: 'pre', text: preText });
  flush();
  return blocks;
}

/** Drop leading/trailing whitespace across the run sequence. */
function trimRuns(runs: Run[]): Run[] {
  const copy = runs.map((r) => ({ ...r }));
  while (copy.length > 0) {
    const first = copy[0]!;
    first.text = first.text.replace(/^\s+/, '');
    if (first.text !== '') break;
    copy.shift();
  }
  while (copy.length > 0) {
    const last = copy[copy.length - 1]!;
    last.text = last.text.replace(/\s+$/, '');
    if (last.text !== '') break;
    copy.pop();
  }
  return copy;
}

/** Plain text of a block sequence — used for previews and tests. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'rule':
          return '---';
        case 'pre':
          return block.text;
        case 'table':
          return block.rows.map((r) => r.join('\t')).join('\n');
        case 'list-item':
          return `${block.marker} ${block.runs.map((r) => r.text).join('')}`;
        default:
          return block.runs.map((r) => r.text).join('');
      }
    })
    .join('\n');
}
