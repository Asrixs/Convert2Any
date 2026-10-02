# Convert2Any

**Convert, edit and secure files entirely in your browser.** Merge, split, compress and convert
PDFs, Office documents and images — with no uploads, no accounts, and no server behind it.

Convert2Any is a static site. Every conversion runs on the visitor's own machine using Web
Workers and WebAssembly, so files never leave the device.

---

## What it does

**Edit & Optimize** — merge, split, compress, reorder, rotate, delete pages
**Convert** — PDF ⇄ Word, PDF ⇄ Excel, PDF ⇄ JPG/PNG, HTML → PDF, and JPEG/PNG/WebP/HEIC images
**Security & Extras** — AES-256 password protection, password removal, watermarks, page numbers

19 tools in total. Each one states its fidelity before you pick a file — see
[docs/FEATURES.md](docs/FEATURES.md) for the full list and the limits of each.

### Fidelity, stated plainly

A browser-only converter has real limits, and the UI names them rather than hiding them:

| Tier | Meaning | Tools |
| --- | --- | --- |
| **Exact** | Lossless — page content is copied, never re-rendered | merge, split, rotate, reorder, delete, watermark, page numbers, protect, unlock, JPG→PDF |
| **Text-fidelity** | Text, headings, lists and tables survive; exact visual layout does not | PDF→Word, Word→PDF, PDF→Excel, Excel→PDF, HTML→PDF |
| **Lossy** | Re-encoded as images, so some detail is lost | compress, PDF→JPG, image converter (JPG/WebP output) |
| **Not available** | Cannot be done in a browser without a server | PowerPoint |

PowerPoint is deliberately absent. PPTX is a slide-canvas format whose layout needs a real
rendering engine; approximating it would produce slides that look plausible and are quietly
wrong.

---

## Why there is no server

Conversion sites ask you to upload a file and then trust a retention policy you cannot verify.
Photos carry GPS coordinates, documents carry revision history, and "deleted after an hour" is a
promise, not a guarantee.

Convert2Any removes the trust problem by removing the upload. There is no backend to compromise,
subpoena, or misconfigure.

**You can verify this in about thirty seconds:**

1. Open devtools → Network, convert a file. Every request is for the app's own code
   (scripts, WebAssembly, fonts); none carries your data.
2. Read the source. There is no endpoint to find.

Metadata stripping is structural rather than a setting: images are decoded to raw pixels and
re-encoded from those pixels, so EXIF and GPS cannot travel from input to output.

---

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit + integration tests
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, zero warnings tolerated
npm run build      # production build + sitemap + 404 fallback
npm run zip        # build, then pack dist/ into convert2any-site.zip
```

CI runs typecheck → lint → tests → build on every push and PR.

---

## Architecture

```
src/
  App.tsx              route table (preact-iso)
  main.tsx             client entry + build-time prerender hook
  seo.ts               per-route <title>/meta, for both runtime and prerender
  components/          Layout, Converter, Dropzone, ToolForm, Icon, ui primitives
  pages/               Home, Tools, ToolPage, Pricing, Security, Static, NotFound
  tools/
    catalog.ts         SINGLE SOURCE OF TRUTH for the toolset
    options.ts         form values -> typed pipeline options
  pipeline/            the conversion engine (see below)
  state/queue.ts       pure queue reducer with an enforced state machine
  engine/pool.ts       Web Worker pool
  styles/              tokens, base, components
```

**The catalog drives everything.** `src/tools/catalog.ts` feeds the tool grid, all 19 tool pages,
the router's prerender list, the format chips and the sitemap. Adding a tool is one catalog entry
plus one pipeline function.

**Conversion is a pipeline.** Jobs run in Web Workers so the UI never blocks. Every image path
ends at `encodeStripped()` in `pipeline/exif.ts`, the single choke point that guarantees metadata
removal. Heavy libraries (pdf-lib, pdf.js, SheetJS, mammoth, docx, qpdf) are lazy-imported per
tool, so the landing page never downloads a PDF engine it may not need.

**Routes are prerendered.** `vite-prerender-plugin` emits real static HTML for all 27 routes at
build time, each with its own title, description and canonical URL — so the output is
crawlable and deep-linkable while remaining a plain folder of files.

Further reading: [docs/COMPONENTS.md](docs/COMPONENTS.md) ·
[docs/FEATURES.md](docs/FEATURES.md) · [docs/DEPLOY.md](docs/DEPLOY.md)

---

## Design system

Minimal, following the [TypeUI **Minimal** design skill](https://github.com/bergside/awesome-design-skills/tree/main/skills/minimal)
(MIT) and the TypeUI fundamentals for spacing, hierarchy and accessibility. The intent: a quiet,
near-monochrome tool where the file and the Convert button are the only things asking for
attention. Light and dark mode follow the visitor's system setting. Tokens live in
`src/styles/tokens.css`.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--bg` | `#F4F4F1` | `#0C0C09` | page |
| `--surface` | `#FFFFFF` | `#161613` | panels and cards |
| `--text` | `#0C0C09` | `#F4F4F1` | text (never pure black) |
| `--text-muted` | `#5E5E57` | `#A3A39A` | secondary text |
| `--border-strong` | `#8A8A82` | `#6E6E66` | control boundaries (≥ 3:1) |
| `--accent` | `#E00000` | `#E00000` | the brand red: primary button, focus ring, brand mark only |

The brand red is darkened from `#FF0000` to `#E00000` so white button text measures 5.0:1 and
passes AA at normal size (pure red gave 4.0:1, which forced an oversized 20px label). In dark mode,
red *text* and the focus ring use `#FF5C5C` (6.5:1 on the page).

Type: **Inter** for headings, **Open Sans** for body text, **Inconsolata** for labels and format
tags — all self-hosted via `@fontsource-variable`, so the site makes no third-party requests.
Spacing sits on a 4-point grid (4/8/12/16/24/32, then 48/64/96 for page rhythm); radii are 4px for
controls and 8px for panels. Depth comes from surface colour and hairlines, not shadows.

---

## Accessibility

Checked in a real browser across every route (home, tools, tool pages, pricing, security, about,
privacy, terms, contact, 404), in light and dark mode:

- Every page has exactly one `<h1>` and no skipped heading levels
- Every button, link and form control has an accessible name
- Every text/background token pair meets WCAG AA (the ratios are listed in `tokens.css`);
  control boundaries meet the 3:1 non-text minimum
- A 2px focus ring, 2px clear of the element, on every interactive element
- Controls are 44px tall; on touch screens icon buttons grow to 44 × 44
- Status is never colour alone: every state dot has a text label next to it
- Form errors appear once a field has been edited, not on page load
- No horizontal overflow at 375px
- Skip-to-content link; the dropzone is a real `<button>`; queue progress is announced via
  `aria-live`; `prefers-reduced-motion` is honoured

---

## Known limits

- **Tab memory.** Very large files are bounded by per-tab memory. There is no server fallback,
  by design.
- **Office fidelity.** Word and Excel conversions are text-fidelity; see the table above.
- **Scanned PDFs.** These have no text layer, so PDF→Word and PDF→Excel cannot recover text from
  them. That needs OCR, which is not included.
- **HEIC is input-only.** Browsers can decode HEIC but not encode it.
- **Password recovery is impossible.** Passwords are used in the tab and never stored. A
  forgotten password on a protected file cannot be recovered by anyone.

## License

MIT — see [LICENSE](LICENSE).
