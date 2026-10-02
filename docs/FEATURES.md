# Features

Every tool, what it actually does, and where it stops. The fidelity tier shown here is the same
one displayed on the tool's own page.

---

## Edit & Optimize

### Merge PDF — `/tools/merge-pdf` · **Exact**
Joins two or more PDFs in the order shown in the file list, which the arrows next to each file
change. Files added in several goes join the same merge. Pages are copied with `pdf-lib`'s
`copyPages`, so text stays selectable and quality is identical to the originals. No file-count
limit; the practical ceiling is tab memory.

> **Encrypted input:** pdf-lib cannot decrypt, and copying pages out of an encrypted file
> (including a "restricted" one that opens without a password) produces blank pages. Every
> pdf-lib tool therefore refuses encrypted PDFs and points to Unlock PDF instead.

### Split PDF — `/tools/split-pdf` · **Exact**
With an empty range, produces one single-page PDF per page, delivered as a ZIP. With a range
(`1-3,7,10-`) it produces a single document containing exactly those pages.

Range syntax is parsed by `parseRanges()` in `pipeline/pages.ts`: `5-` means page 5 onward, `-5`
means 1 to 5, reversed ranges are normalised, and out-of-range pages are clamped rather than
throwing — typing `1-999` on a 4-page PDF means "all of it", not an error.

### Compress PDF — `/tools/compress-pdf` · **Lossy**
Renders each page at a chosen DPI (72–200), JPEG-encodes it at a chosen quality, and rebuilds the
document. Pages keep their original physical size.

> **Trade-off:** this rasterizes. Text in the output is part of the page image and is no longer
> selectable or searchable. It shrinks scans and image-heavy files dramatically and will make a
> text-only PDF *larger* — the tool page says so.

### Reorder pages — `/tools/reorder-pdf` · **Exact**
Rebuilds the document in a given order (`3,1,2`). Partial orders are completed rather than
rejected: unlisted pages keep their relative order and follow at the end, so `3` on a 4-page
document means "move page 3 first".

### Rotate PDF — `/tools/rotate-pdf` · **Exact**
Rotates every page 90/180/270°, applied *on top of* each page's existing rotation and wrapped at
360. Nothing is re-rendered — only the page's rotation attribute changes.

### Delete pages — `/tools/delete-pages` · **Exact**
Removes the listed pages and copies the rest untouched. Refuses the job if it would empty the
document. Pages that do not exist are ignored rather than erroring.

---

## Convert

### PDF to Word — `/tools/pdf-to-word` · **Text-fidelity**
Extracts positioned text with pdf.js, groups fragments into visual lines by baseline, and emits
Word paragraphs with page breaks between pages.

Recovers: reading order and text content.
Does **not** recover: fonts, columns, images, tables as tables, or precise positioning.

> Scanned PDFs contain no text layer. Those need OCR, which Convert2Any does not do — the tool
> reports this instead of producing an empty document.

### Word to PDF — `/tools/word-to-pdf` · **Text-fidelity**
`mammoth` converts .docx to semantic HTML; the shared block renderer lays it onto A4 or Letter.
Headings, paragraphs, lists, bold/italic runs, rules and tables are carried over.

Output keeps **real, selectable text** — the renderer draws text with pdf-lib rather than
screenshotting a rendered page. That is a deliberate trade: no CSS reproduction, but a small,
searchable PDF instead of a picture of a document.

Does not carry over: fonts, colours, headers/footers, embedded images.

### PDF to Excel — `/tools/pdf-to-excel` · **Text-fidelity**
Groups text into lines, then infers column boundaries from x positions that repeat across those
lines — a gap shared by most rows is a column edge; a gap unique to one row is a wide word space.
Each page becomes a worksheet.

Clean grid-like tables convert well. Free-form layouts yield one cell per line rather than a
fabricated grid. Column detection is inference, not a guarantee; always check against the source.

### Excel to PDF — `/tools/excel-to-pdf` · **Text-fidelity**
SheetJS reads .xlsx/.csv; each sheet becomes a titled table with real borders and wrapped cell
text that flows across pages. Formulas are read as their computed values. Cell formatting,
colours, merged cells and charts are not reproduced.

### PDF to JPG — `/tools/pdf-to-jpg` · **Lossy**
Renders every page at ~144 dpi via pdf.js into an `OffscreenCanvas`, then encodes as JPG, PNG or
WebP. Multiple pages arrive as a ZIP. Pages are rendered and encoded one at a time, so a long
PDF never holds more than one page of pixels in memory. The text in the images is not
selectable.

### JPG to PDF — `/tools/jpg-to-pdf` · **Exact**
Places images into one PDF, one per page. Either fits each page to its image, or standardises to
A4/Letter with contain-fit and a margin. JPEG and PNG embed directly; WebP and HEIC are decoded
and re-encoded to PNG first, so they work too.

### HTML to PDF — `/tools/html-to-pdf` · **Text-fidelity**
Paste markup or upload an `.html` file. Supports headings, paragraphs, lists, tables, rules,
`<pre>`, and bold/italic runs. Output is selectable text.

The HTML parser is hand-rolled and dependency-free (`pipeline/blocks.ts`) because this runs inside
a Web Worker, where `DOMParser` does not exist. Keeping it pure also makes it unit-testable in
Node.

CSS is not applied and external resources are **never fetched** — document structure is what
converts. `<script>` and `<style>` content is discarded.

### Image converter — `/tools/image-converter` · **Lossy** (PNG output is lossless)
Converts between JPEG, PNG, WebP and HEIC (HEIC in only — browsers cannot encode it). Images are
decoded to raw pixels and re-encoded, so **EXIF and GPS metadata cannot survive** — stripping is
structural, not a checkbox. Orientation is baked into the pixels first, so photos stay upright.

Encoding prefers the native canvas encoder and falls back to WASM codecs (`@jsquash`) where a
browser cannot encode a format. Such a browser does not throw — it quietly returns a PNG (Safari
does this for WebP) — so the result's type is checked before it is accepted. JPG output gets a
white background, since transparent pixels would otherwise turn black.

### PowerPoint to PDF — `/tools/powerpoint-to-pdf` · **Not available**
PPTX is a slide-canvas format: every element is absolutely positioned against a theme, master
layout and embedded media. Faithful conversion needs a rendering engine such as LibreOffice on a
server. The page explains this and points to PowerPoint/Keynote "Export to PDF" or LibreOffice
Impress rather than shipping an approximation that looks plausible and is quietly wrong.

---

## Security & Extras

### Protect PDF — `/tools/protect-pdf` · **Exact**
Real **AES-256** encryption via qpdf compiled to WebAssembly. Takes a user (open) password and an
optional owner password, which defaults to the user password. Passwords are used exactly as
typed. There is no weaker option: the RC4-based 40- and 128-bit modes are broken, and the
bundled qpdf refuses to write them.

Covered by tests that run the real qpdf WASM in Node: the output carries an AES-256 `/Encrypt`
dictionary, the plaintext no longer appears in the bytes, a wrong password is rejected, and
unlocking returns the original text.

> The password is used in the tab and never transmitted or stored. That also means it cannot be
> recovered — a forgotten password on a protected file is unrecoverable by anyone.

### Unlock PDF — `/tools/unlock-pdf` · **Exact**
Removes encryption from a file you can already open, given its password, keeping the text layer
fully intact. Verified as a round trip: protect → unlock returns a valid document with no
`/Encrypt` remaining.

This removes protection you hold the password for. It does not break encryption you do not.

A wrong password is reported clearly. qpdf writes "invalid password" to its own stderr rather
than through the captured handler *and exits 0 even on failure*, so a missing output file is the
only reliable signal — the message names the likely cause without ruling out a damaged file or an
unsupported scheme.

### Watermark PDF — `/tools/watermark-pdf` · **Exact**
Stamps text across every page with configurable size, opacity, angle and position. Drawn as real
PDF content, so it scales cleanly and prints sharp.

### Add page numbers — `/tools/page-numbers` · **Exact**
Numbers pages using a template where `{n}` is the current page and `{total}` the count, so
`Page {n} of {total}` reads as expected. Position, starting number, text size and margin are all
configurable — numbering can start at any value for documents continuing from another.

---

## Cross-cutting behaviour

**Batch queue.** Any tool accepts multiple files. Tools that combine files (merge, JPG to PDF)
collect them into one job; every other tool converts each file separately. On the home page,
queuing several PDFs or images offers a one-click "merge into one" instead of guessing. One
output downloads directly; several are
bundled into a single ZIP with `fflate`, and duplicate names are de-duplicated (`photo.jpg`
becomes `photo (2).jpg`).

**Workers.** Conversions run in a Web Worker pool sized to half the hardware concurrency (max 4),
so the UI never blocks. A failed job rejects *and* retires its worker, so a poisoned WASM module
never serves a second job. Idle workers are terminated after 45s.

**Lazy loading.** pdf-lib, pdf.js, SheetJS, mammoth, docx and qpdf are imported only when a tool
needs them. Opening the home page downloads none of them.

**Queue state machine.** `pending → converting → done | error`, enforced in a pure reducer.
Invalid transitions are no-ops, so a stray engine event cannot corrupt the queue.

---

## Testing

152 tests, all runnable in Node with no browser:

- **Pure logic** — range parsing, page reordering, HTML block parsing, PDF text clustering,
  output naming, option coercion, queue transitions
- **Catalog integrity** — unique slugs, known categories, supported extensions, a caveat on every
  non-exact tool, select initials that exist among their choices
- **Real conversions** — merge/split/rotate/reorder/delete/watermark/numbers/images-to-PDF and
  HTML/spreadsheet-to-PDF run against real documents, and assertions read the drawn text back out
  of the generated PDF (inflating content streams and decoding pdf-lib's hex operands) rather than
  just checking that nothing threw
- **Encryption** — protect/unlock round trips through the real qpdf WASM, and encrypted input to
  the pdf-lib tools is refused rather than turned into blank pages

Browser-only paths — canvas encoding, pdf.js rasterization and text extraction — were verified
by driving the built site in a browser.
