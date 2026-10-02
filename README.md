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

Strict dark mode built on four brand colours, used exactly as specified:

| Token | Hex | Role |
| --- | --- | --- |
| `--c-black` | `#000000` | page background |
| `--c-maroon` | `#3D0000` | elevated surfaces, floating cards, secondary sections |
| `--c-red-deep` | `#950101` | secondary buttons, borders, subtle highlights, hover |
| `--c-red` | `#FF0000` | primary CTA, active icons, badges |

Headings are `#FFFFFF`, body text `#E0E0E0`. Typeface is **Inter**, self-hosted via
`@fontsource-variable/inter` so the site makes no third-party requests.

Two derived tints exist purely for accessibility, and are documented where they are defined in
`src/styles/tokens.css`:

- `--accent-text: #FF4D4D` — accent text on maroon. `#FF0000` measures 4.38:1 there (4.41:1 on a
  washed chip), under the 4.5:1 AA bar; this measures 4.90:1.
- `--border-input: #B81A1A` — form-control boundaries. `#950101` against a field background is
  2.23:1, under the 3:1 that WCAG 1.4.11 asks of a control's visible boundary.

Primary CTA labels are 20px/700 on purpose: white on `#FF0000` is 4.0:1, which passes AA for
*large* text, and WCAG counts bold text as large only from 18.66px.

---

## Accessibility

Verified in a real browser across `/`, `/tools`, tool pages, `/pricing`, `/security` and
`/privacy`:

- Every page has exactly one `<h1>` and no skipped heading levels
- All form controls are labelled; every icon-only button has an accessible name
- Skip-to-content link; the dropzone is a real `<button>`, so it is focusable and works with
  Enter/Space
- Queue progress is announced via `aria-live` without stealing focus
- No horizontal overflow at 375px, 768px or 1440px
- 91 measured text styles all meet their WCAG AA threshold
- `prefers-reduced-motion` is honoured

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
