import type { ImageOutputFormat, OutputKind, ToolOptions } from '../pipeline/formats';
import type { SupportedExtension } from '../pipeline/registry';

/**
 * THE single source of truth for Convert2Any's toolset.
 *
 * The tool grid, every /tools/:slug page, the router's prerender list, the
 * sitemap and the format chips all read from this array. Adding a tool means
 * one entry here plus one pipeline function — nothing else to keep in sync.
 */

/**
 * How faithful a tool's output is to its input. This is surfaced on every
 * card and tool page: a browser-only converter has real limits, and stating
 * them up front is the difference between a considered trade-off and a
 * broken promise.
 */
export type Fidelity = 'exact' | 'text' | 'lossy' | 'unavailable';

export const FIDELITY_COPY: Record<Fidelity, { label: string; note: string }> = {
  exact: {
    label: 'Exact',
    note: 'Lossless. Page content is copied, never re-rendered.',
  },
  text: {
    label: 'Text-fidelity',
    note: 'Text, headings, lists and tables carry over. Exact visual layout does not.',
  },
  lossy: {
    label: 'Lossy',
    note: 'The result is re-encoded as images, so some detail is lost.',
  },
  unavailable: {
    label: 'Not available',
    note: 'This format cannot be converted in a browser without a server.',
  },
};

export type ToolCategory = 'edit' | 'convert' | 'security';

export const CATEGORIES: Record<ToolCategory, { title: string; blurb: string }> = {
  edit: {
    title: 'Edit & Optimize',
    blurb: 'Reshape a PDF: merge, split, compress, reorder and rotate.',
  },
  convert: {
    title: 'Convert',
    blurb: 'Move between PDF, Office documents, images and HTML.',
  },
  security: {
    title: 'Security & Extras',
    blurb: 'Passwords, watermarks, page numbers and metadata.',
  },
};

export type FieldType = 'text' | 'textarea' | 'password' | 'number' | 'range' | 'select';

export interface ToolField {
  /** Key written into ToolOptions and handed to the pipeline. */
  name: keyof ToolOptions;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  choices?: { value: string; label: string }[];
  /** Initial value; numbers stay numbers so the pipeline gets real types. */
  initial?: string | number;
}

export interface Tool {
  slug: string;
  title: string;
  /** One line for the card. */
  short: string;
  /** Two or three sentences for the tool page. */
  description: string;
  category: ToolCategory;
  icon: string;
  /** Extensions the dropzone accepts for this tool. */
  accepts: SupportedExtension[];
  /** Whether the tool consumes several files as one job. */
  multiple: boolean;
  /** Label for the output format chip. */
  produces: string;
  fidelity: Fidelity;
  /** Extra caveat shown under the fidelity badge. */
  caveat?: string;
  fields: ToolField[];
  /** Build the job kind from the collected form options. */
  toKind: (options: ToolOptions) => OutputKind;
  faq?: { q: string; a: string }[];
}

const IMAGE_INPUTS: SupportedExtension[] = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

const PAGE_SIZE_CHOICES = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'US Letter' },
];

export const TOOLS: Tool[] = [
  // ---------------------------------------------------------------- edit
  {
    slug: 'merge-pdf',
    title: 'Merge PDF',
    short: 'Combine several PDFs into one document, in the order you choose.',
    description:
      'Select two or more PDFs and Convert2Any joins them into a single file. Pages are copied across untouched, so text stays selectable and quality is identical to the originals.',
    category: 'edit',
    icon: 'merge',
    accepts: ['pdf'],
    multiple: true,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [],
    toKind: () => ({ type: 'pdf-tool', tool: 'pdf-merge' }),
    faq: [
      {
        q: 'What order are the files merged in?',
        a: 'The order shown in the file list. Use the arrows next to each file to move it up or down before you merge.',
      },
      {
        q: 'Is there a file limit?',
        a: 'No fixed limit. The practical ceiling is your device memory, since the whole job runs in this tab.',
      },
    ],
  },
  {
    slug: 'split-pdf',
    title: 'Split PDF',
    short: 'Break a PDF into single pages, or pull out a specific range.',
    description:
      'Leave the range blank to get one PDF per page, delivered as a ZIP. Enter a range like 1-3,7 to extract just those pages into a single new document.',
    category: 'edit',
    icon: 'split',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'ranges',
        label: 'Pages to extract',
        type: 'text',
        placeholder: 'e.g. 1-3,7,10-',
        help: 'Leave empty to split every page into its own file.',
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-split', options }),
    faq: [
      {
        q: 'How do I get everything from page 5 onward?',
        a: 'Write 5- with nothing after the dash. Likewise -5 means pages 1 to 5.',
      },
    ],
  },
  {
    slug: 'compress-pdf',
    title: 'Compress PDF',
    short: 'Shrink a large PDF by re-rendering its pages at a lower quality.',
    description:
      'Best suited to scanned documents and image-heavy files, where it can cut size dramatically. Pages are rasterized, which means text in the output is no longer selectable. That is a real trade-off, so check the result before discarding the original.',
    category: 'edit',
    icon: 'compress',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'lossy',
    caveat: 'Text becomes part of the page image and stops being selectable or searchable.',
    fields: [
      {
        name: 'dpi',
        label: 'Resolution (DPI)',
        type: 'range',
        min: 72,
        max: 200,
        step: 1,
        initial: 120,
        help: 'Lower means smaller files. 120 suits on-screen reading; 150+ suits printing.',
      },
      {
        name: 'imageQuality',
        label: 'Image quality',
        type: 'range',
        min: 20,
        max: 95,
        step: 1,
        initial: 65,
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-compress', options }),
    faq: [
      {
        q: 'Why did my text-only PDF get bigger?',
        a: 'Text PDFs are already compact. Rasterizing them adds data. This tool is for scans and image-heavy documents.',
      },
    ],
  },
  {
    slug: 'reorder-pdf',
    title: 'Reorder pages',
    short: 'Rearrange a PDF by listing the page order you want.',
    description:
      'Enter the page numbers in their new order, for example 3,1,2. Any pages you leave out keep their existing relative order and follow on at the end.',
    category: 'edit',
    icon: 'reorder',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'order',
        label: 'New page order',
        type: 'text',
        placeholder: 'e.g. 3, 1, 2 or 10-1',
        required: true,
        help: 'Page numbers and ranges. A range like 10-1 counts down. Unlisted pages follow in their current order.',
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-reorder', options }),
  },
  {
    slug: 'rotate-pdf',
    title: 'Rotate PDF',
    short: 'Turn every page 90, 180 or 270 degrees.',
    description:
      'Rotation is applied on top of each page existing orientation, so a page already turned 90 degrees and rotated another 90 ends up upside down. Nothing is re-rendered.',
    category: 'edit',
    icon: 'rotate',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'rotation',
        label: 'Rotation',
        type: 'select',
        initial: '90',
        choices: [
          { value: '90', label: '90° clockwise' },
          { value: '180', label: '180°' },
          { value: '270', label: '270° (90° counter-clockwise)' },
        ],
      },
    ],
    toKind: (options) => ({
      type: 'pdf-tool',
      tool: 'pdf-rotate',
      degrees: (options.rotation as 90 | 180 | 270) ?? 90,
      options,
    }),
  },
  {
    slug: 'delete-pages',
    title: 'Delete pages',
    short: 'Remove pages from a PDF and keep the rest untouched.',
    description:
      'List the pages to drop. Everything else is copied across exactly as it was. Convert2Any refuses the job if it would empty the document.',
    category: 'edit',
    icon: 'trash',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'pages',
        label: 'Pages to delete',
        type: 'text',
        placeholder: 'e.g. 2, 5-7, 9',
        required: true,
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-delete', options }),
  },

  // ------------------------------------------------------------- convert
  {
    slug: 'pdf-to-word',
    title: 'PDF to Word',
    short: 'Pull the text out of a PDF into an editable .docx document.',
    description:
      'Text is recovered page by page and written as Word paragraphs with page breaks in between. This gets you editable content, not a visual replica: fonts, columns, images and precise positioning are not reconstructed.',
    category: 'convert',
    icon: 'word',
    accepts: ['pdf'],
    multiple: false,
    produces: 'DOCX',
    fidelity: 'text',
    caveat: 'Scanned PDFs contain no text layer. Those need OCR, which Convert2Any does not do.',
    fields: [
      {
        name: 'password',
        label: 'PDF password',
        type: 'password',
        placeholder: 'Only if the PDF is protected',
      },
    ],
    toKind: (options) => ({ type: 'doc-tool', tool: 'pdf-to-docx', options }),
    faq: [
      {
        q: 'Why is my layout different?',
        a: 'A PDF stores positioned glyphs, not paragraphs. Rebuilding a Word layout from that is inference: we recover reading order and text, and leave the styling to you.',
      },
    ],
  },
  {
    slug: 'word-to-pdf',
    title: 'Word to PDF',
    short: 'Turn a .docx document into a clean, shareable PDF.',
    description:
      'Headings, paragraphs, lists, bold and italic runs and tables are laid out onto A4 or Letter pages. The output keeps real, selectable text rather than being a picture of your document.',
    category: 'convert',
    icon: 'pdf',
    accepts: ['docx'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'text',
    caveat: 'Fonts, colours, headers/footers and embedded images are not carried over.',
    fields: [
      { name: 'pageSize', label: 'Page size', type: 'select', initial: 'a4', choices: PAGE_SIZE_CHOICES },
      { name: 'fontSize', label: 'Base text size', type: 'number', min: 8, max: 16, initial: 11 },
    ],
    toKind: (options) => ({ type: 'doc-tool', tool: 'docx-to-pdf', options }),
  },
  {
    slug: 'pdf-to-excel',
    title: 'PDF to Excel',
    short: 'Recover tabular data from a PDF into a .xlsx workbook.',
    description:
      'Convert2Any groups text into lines, then infers column boundaries from the x positions that repeat across those lines. Each PDF page becomes a worksheet. Clean, grid-like tables convert well; free-form layouts give one cell per line.',
    category: 'convert',
    icon: 'excel',
    accepts: ['pdf'],
    multiple: false,
    produces: 'XLSX',
    fidelity: 'text',
    caveat: 'Column detection is inference, not a guarantee. Always check the result against the source.',
    fields: [
      {
        name: 'password',
        label: 'PDF password',
        type: 'password',
        placeholder: 'Only if the PDF is protected',
      },
    ],
    toKind: (options) => ({ type: 'doc-tool', tool: 'pdf-to-xlsx', options }),
  },
  {
    slug: 'excel-to-pdf',
    title: 'Excel to PDF',
    short: 'Render a spreadsheet or CSV as a paginated PDF table.',
    description:
      'Every sheet becomes a titled table, drawn with real borders and wrapped cell text that flows across pages. Cell values are used as displayed, and formulas are read as their computed results.',
    category: 'convert',
    icon: 'pdf',
    accepts: ['xlsx', 'csv'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'text',
    caveat: 'Cell formatting, colours, merged cells and charts are not reproduced.',
    fields: [
      { name: 'pageSize', label: 'Page size', type: 'select', initial: 'a4', choices: PAGE_SIZE_CHOICES },
    ],
    toKind: (options) => ({ type: 'doc-tool', tool: 'xlsx-to-pdf', options }),
  },
  {
    slug: 'pdf-to-jpg',
    title: 'PDF to JPG',
    short: 'Render every page of a PDF as a separate image.',
    description:
      'Each page is rendered at high resolution and saved as its own image file, delivered together as a ZIP. Choose JPG for photos and scans, or PNG when you need crisp text edges.',
    category: 'convert',
    icon: 'image',
    accepts: ['pdf'],
    multiple: false,
    produces: 'JPG / PNG',
    fidelity: 'lossy',
    caveat:
      'Pages become pictures, so their text cannot be selected or searched. JPG and WebP also compress the image slightly; PNG does not.',
    fields: [
      {
        name: 'imageFormat',
        label: 'Image format',
        type: 'select',
        initial: 'jpeg',
        choices: [
          { value: 'jpeg', label: 'JPG' },
          { value: 'png', label: 'PNG' },
          { value: 'webp', label: 'WebP' },
        ],
      },
    ],
    toKind: (options) => ({
      type: 'image',
      format: (options.imageFormat as ImageOutputFormat) ?? 'jpeg',
    }),
  },
  {
    slug: 'jpg-to-pdf',
    title: 'JPG to PDF',
    short: 'Place images into a single PDF, one per page.',
    description:
      'Drop as many images as you like and they are combined into one PDF in order. Fit each page to its image, or standardise everything to A4 or Letter with a margin.',
    category: 'convert',
    icon: 'pdf',
    accepts: IMAGE_INPUTS,
    multiple: true,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'pageSize',
        label: 'Page size',
        type: 'select',
        initial: 'fit',
        choices: [{ value: 'fit', label: 'Fit to image' }, ...PAGE_SIZE_CHOICES],
      },
      {
        name: 'orientation',
        label: 'Orientation',
        type: 'select',
        initial: 'portrait',
        choices: [
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ],
      },
      { name: 'margin', label: 'Margin (pt)', type: 'number', min: 0, max: 120, initial: 0 },
    ],
    toKind: (options) => ({ type: 'doc-tool', tool: 'images-to-pdf', options }),
  },
  {
    slug: 'html-to-pdf',
    title: 'HTML to PDF',
    short: 'Turn pasted HTML or an .html file into a typeset PDF.',
    description:
      'Paste markup straight into the editor, or upload an .html file. Headings, paragraphs, lists, tables, rules and code blocks are laid out as real text you can select and search in the finished PDF.',
    category: 'convert',
    icon: 'code',
    accepts: ['html', 'htm'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'text',
    caveat:
      'CSS is not applied and external resources are never fetched. The document structure is what converts.',
    fields: [
      {
        name: 'html',
        label: 'HTML source',
        type: 'textarea',
        placeholder: '<h1>Quarterly report</h1>\n<p>Revenue grew <strong>18%</strong>.</p>',
        help: 'Leave blank if you are uploading an .html file instead.',
      },
      { name: 'pageSize', label: 'Page size', type: 'select', initial: 'a4', choices: PAGE_SIZE_CHOICES },
    ],
    toKind: (options) => ({ type: 'doc-tool', tool: 'html-to-pdf', options }),
  },
  {
    slug: 'image-converter',
    title: 'Image converter',
    short: 'Convert between JPG, PNG, WebP and HEIC.',
    description:
      'Images are decoded to raw pixels and re-encoded in the target format. Because the output is built from pixels alone, EXIF and GPS metadata cannot survive the trip. Stripping is structural, not a checkbox.',
    category: 'convert',
    icon: 'image',
    accepts: IMAGE_INPUTS,
    multiple: true,
    produces: 'JPG / PNG / WebP',
    fidelity: 'lossy',
    caveat: 'JPG and WebP re-compress the image and lose a little detail. Choose PNG to keep every pixel.',
    fields: [
      {
        name: 'imageFormat',
        label: 'Convert to',
        type: 'select',
        initial: 'png',
        choices: [
          { value: 'png', label: 'PNG' },
          { value: 'jpeg', label: 'JPG' },
          { value: 'webp', label: 'WebP' },
        ],
      },
    ],
    toKind: (options) => ({
      type: 'image',
      format: (options.imageFormat as ImageOutputFormat) ?? 'png',
    }),
    faq: [
      {
        q: 'Why can I not convert to HEIC?',
        a: 'Browsers can decode HEIC but not encode it. Convert2Any reads HEIC happily; it just cannot write it.',
      },
    ],
  },
  {
    slug: 'powerpoint-to-pdf',
    title: 'PowerPoint to PDF',
    short: 'Not available in the browser. Here is why, and what to use instead.',
    description:
      'PPTX is a slide-canvas format: every element is absolutely positioned against a theme, master layout and embedded media. Reproducing that faithfully needs a real rendering engine such as LibreOffice running on a server. Approximating it in a browser would produce slides that look plausible and are quietly wrong, so Convert2Any does not offer it rather than shipping something misleading.',
    category: 'convert',
    icon: 'slides',
    accepts: [],
    multiple: false,
    produces: 'None',
    fidelity: 'unavailable',
    caveat:
      'Use PowerPoint or Keynote "Export to PDF", or LibreOffice Impress, which all render slides properly.',
    fields: [],
    toKind: () => ({ type: 'doc-tool', tool: 'docx-to-pdf' }),
  },

  // ------------------------------------------------------------ security
  {
    slug: 'protect-pdf',
    title: 'Protect PDF',
    short: 'Lock a PDF with a password using real AES encryption.',
    description:
      'Convert2Any encrypts the document with AES-256 so it cannot be opened without the password. The encryption is performed by qpdf compiled to WebAssembly, running here in your browser, so the password is never transmitted anywhere.',
    category: 'security',
    icon: 'lock',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    caveat: 'There is no recovery. If you forget this password, the document cannot be opened.',
    fields: [
      {
        name: 'password',
        label: 'Password to open the document',
        type: 'password',
        required: true,
        placeholder: 'Choose a strong password',
      },
      {
        name: 'ownerPassword',
        label: 'Owner password (optional)',
        type: 'password',
        help: 'A second password with full rights over the file. Defaults to the open password.',
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-protect', options }),
    faq: [
      {
        q: 'Does my password leave my device?',
        a: 'No. Encryption runs in a Web Worker in this tab. There is no server to send it to.',
      },
      {
        q: 'Why is there no weaker, more compatible option?',
        a: 'The older 40- and 128-bit PDF encryption modes use RC4, which is broken. Every PDF reader from the last fifteen years opens AES-256 files.',
      },
    ],
  },
  {
    slug: 'unlock-pdf',
    title: 'Unlock PDF',
    short: 'Remove password protection from a PDF you can already open.',
    description:
      'Supply the password that opens the document and Convert2Any writes out a decrypted copy, keeping the text layer fully intact. This removes protection you hold the password for. It does not break encryption you do not.',
    category: 'security',
    icon: 'unlock',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'password',
        label: 'Current password',
        type: 'password',
        required: true,
        placeholder: 'The password that opens this PDF',
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-unlock', options }),
  },
  {
    slug: 'watermark-pdf',
    title: 'Watermark PDF',
    short: 'Stamp text across every page at the angle and opacity you pick.',
    description:
      'Adds a text watermark to all pages: DRAFT, CONFIDENTIAL, a client name, anything you like. The mark is drawn as real PDF content, so it scales cleanly and prints sharp.',
    category: 'security',
    icon: 'stamp',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'text',
        label: 'Watermark text',
        type: 'text',
        required: true,
        placeholder: 'CONFIDENTIAL',
        initial: 'CONFIDENTIAL',
      },
      { name: 'fontSize', label: 'Size', type: 'range', min: 12, max: 120, step: 1, initial: 48 },
      { name: 'opacity', label: 'Opacity (%)', type: 'range', min: 5, max: 100, step: 1, initial: 20 },
      { name: 'rotation', label: 'Angle (°)', type: 'range', min: -90, max: 90, step: 5, initial: 45 },
      {
        name: 'position',
        label: 'Position',
        type: 'select',
        initial: 'center',
        choices: [
          { value: 'center', label: 'Centre' },
          { value: 'top-left', label: 'Top left' },
          { value: 'top-right', label: 'Top right' },
          { value: 'bottom-left', label: 'Bottom left' },
          { value: 'bottom-right', label: 'Bottom right' },
        ],
      },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-watermark', options }),
  },
  {
    slug: 'page-numbers',
    title: 'Add page numbers',
    short: 'Number the pages, with full control over format and position.',
    description:
      'Use a template to shape the label: {n} is the current page and {total} is the count, so "Page {n} of {total}" reads exactly as you would expect. Numbering can start at any value for documents that continue from another.',
    category: 'security',
    icon: 'hash',
    accepts: ['pdf'],
    multiple: false,
    produces: 'PDF',
    fidelity: 'exact',
    fields: [
      {
        name: 'template',
        label: 'Label format',
        type: 'text',
        initial: '{n}',
        placeholder: 'Page {n} of {total}',
        help: 'Use {n} for the page number and {total} for the total.',
      },
      {
        name: 'numberPosition',
        label: 'Position',
        type: 'select',
        initial: 'bottom-center',
        choices: [
          { value: 'bottom-center', label: 'Bottom centre' },
          { value: 'bottom-right', label: 'Bottom right' },
          { value: 'bottom-left', label: 'Bottom left' },
          { value: 'top-center', label: 'Top centre' },
          { value: 'top-right', label: 'Top right' },
          { value: 'top-left', label: 'Top left' },
        ],
      },
      { name: 'startAt', label: 'Start at', type: 'number', min: 0, max: 9999, initial: 1 },
      { name: 'fontSize', label: 'Text size', type: 'number', min: 6, max: 24, initial: 11 },
      { name: 'margin', label: 'Margin (pt)', type: 'number', min: 8, max: 80, initial: 28 },
    ],
    toKind: (options) => ({ type: 'pdf-tool', tool: 'pdf-numbers', options }),
  },
];

/** Look up one tool by its URL slug. */
export function toolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

/** Tools in one category, in catalog order. */
export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((tool) => tool.category === category);
}

/** Every tool that can actually run — excludes the documented gaps. */
export function runnableTools(): Tool[] {
  return TOOLS.filter((tool) => tool.fidelity !== 'unavailable');
}

/** Route paths for the router and the generated sitemap. */
export function toolPaths(): string[] {
  return TOOLS.map((tool) => `/tools/${tool.slug}`);
}

/** Defaults for a tool's form, typed as the pipeline expects them. */
export function initialOptions(tool: Tool): ToolOptions {
  const options: Record<string, unknown> = {};
  for (const field of tool.fields) {
    if (field.initial === undefined) continue;
    options[field.name] = field.initial;
  }
  return options as ToolOptions;
}
