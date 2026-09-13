# no-upload

**Zero-upload file conversion.** Every conversion runs locally in your browser tab — your files
never leave your device. No uploads, no accounts, no analytics, no third-party requests.

## Why

Conversion sites today ask you to trust them with your files. That is a bad trade: photos leak
GPS coordinates, documents carry revision history, and "we delete after 1 hour" is a promise you
cannot verify. `no-upload` removes the trust problem architecturally: there is no server to
trust, because no byte of your file is ever transmitted.

## What it does

- **Image conversion** — JPEG / PNG / WebP / HEIC, decoded and re-encoded entirely in the browser
  (WASM codecs, loaded on demand per format).
- **Metadata stripping (on by default)** — EXIF, GPS location, and camera metadata are removed on
  every conversion; orientation is baked into the pixels before the metadata is dropped.
- **Batch queue** — drop many files, watch per-file progress, download everything as one ZIP.
- **PDF tools** — merge, split, and rotate PDFs locally.

## Verifying the claim

You do not have to take our word for it:

1. Open the site, open your browser's network tab, convert a file — no requests carry file data.
2. Load the page, disconnect from the network entirely — conversion keeps working.
3. Read the source. There is no backend, no telemetry, no keylogger, no phoning home. What you
   see is what runs.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, zero warnings tolerated
npm run build      # production build
```

CI runs typecheck → lint → tests → build on every PR.

## Architecture

Single registry maps every supported extension to a lazy-loaded decoder/encoder. Conversion is a
pipeline: decode → strip metadata → encode, executed in Web Workers so the UI never blocks. The
UI (Preact) owns only queue state; all heavy work happens off the main thread.

## Known caveats

- **HEIC patents.** HEIC decoding is HEVC-based; shipping a decoder in some jurisdictions may
  implicate patent licensing. This project ships a HEIC decoder on the same basis as the open
  source libraries it builds on; commercial deployments should evaluate that question themselves.
- **Browser memory.** Very large images are bounded by per-tab memory (decoded bitmaps cost
  ~4 bytes per pixel per pipeline stage). There is no server fallback by design — huge jobs
  belong on a desktop tool, not on "trust me with your files" web apps.
- **First-use download.** WASM codec packs load on demand per format family; the first HEIC
  conversion downloads a few MB. After that it is cached.

## License

MIT — see [LICENSE](LICENSE).
