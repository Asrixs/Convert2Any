import type { JSX } from 'preact';
import { SOURCE_URL } from '../components/Layout';
import { Card, FeatureItem, SectionHead } from '../components/ui';
import { useSeo } from '../seo';

/** How the no-upload architecture works, and how to verify it yourself. */
export function Security(): JSX.Element {
  useSeo({
    title: 'Security',
    description:
      'Convert2Any processes files entirely in your browser using Web Workers and WebAssembly. No uploads, no telemetry, no third-party requests — and here is how to verify it.',
    path: '/security',
  });

  return (
    <section class="section">
      <div class="page stack" style="gap:var(--s-8)">
        <SectionHead
          title="There is no server to trust"
          level={1}
          lead="Most converters ask you to upload a file and then trust a retention policy. Convert2Any removes that trade entirely — the conversion runs on your machine, so there is no copy of your file anywhere else."
        />

        <div class="grid grid-3" style="gap:var(--s-6)">
          <FeatureItem level={2} icon="shield" title="No network path for your data">
            Files are read with the File API and processed in a Web Worker. No fetch, XHR or
            WebSocket ever receives your file contents — the only downloads are the app's own code.
          </FeatureItem>
          <FeatureItem level={2} icon="layers" title="No third-party requests">
            Fonts, WebAssembly modules and scripts are all served from this origin. There is no CDN
            call, no analytics script and no tracking pixel to leak what you converted.
          </FeatureItem>
          <FeatureItem level={2} icon="lock" title="Real cryptography">
            PDF password protection is AES-256, performed by qpdf compiled to WebAssembly. Your
            password is used in this tab and never transmitted.
          </FeatureItem>
        </div>

        <Card variant="float">
          <div class="heading-block" style="max-width:68ch;margin-bottom:var(--s-6)">
            <h2 style="font-size:var(--t-2xl)">Check it yourself</h2>
            <p class="muted">
              You should not take a security claim on faith. This one takes about thirty seconds to
              check.
            </p>
          </div>
          <ol class="stack" style="gap:var(--s-5);padding-left:var(--s-5);max-width:68ch">
            <li>
              <strong>Watch the network.</strong>{' '}
              <span class="muted">
                Open your browser's developer tools, switch to the Network tab, then convert a file.
                You will see the app load its own scripts, WebAssembly and fonts — and no request
                that carries your file.
              </span>
            </li>
            <li>
              <strong>Read the source.</strong>{' '}
              <span class="muted">
                Every line is public on <a href={SOURCE_URL}>GitHub</a>. The build is a folder of
                static files; there is no backend endpoint to find, because none exists.
              </span>
            </li>
          </ol>
        </Card>

        <div class="grid grid-2" style="gap:var(--s-7)">
          <div class="heading-block">
            <h2 style="font-size:var(--t-xl)">Metadata is removed structurally</h2>
            <p class="muted">
              Image conversion decodes to raw pixels and re-encodes from those pixels. EXIF, GPS
              coordinates and camera details are not stripped by a filter that could be
              misconfigured — there is simply no code path that carries them from input to output.
              Orientation is baked into the pixels first, so photos stay upright.
            </p>
          </div>
          <div>
            <h2 style="font-size:var(--t-xl);margin-bottom:var(--s-5)">Limits worth knowing</h2>
            <ul class="stack" style="gap:var(--s-3);padding-left:var(--s-5)">
              <li class="muted">
                Very large files are bound by tab memory. There is no server fallback, by design.
              </li>
              <li class="muted">
                Office conversions are text-fidelity. Each tool says so before you pick a file.
              </li>
              <li class="muted">
                Scanned PDFs have no text layer to recover; that needs OCR, which is not included.
              </li>
              <li class="muted">
                Encrypted PDFs must be unlocked (with their password) before they can be edited.
              </li>
            </ul>
          </div>
        </div>

        <div class="heading-block" style="max-width:68ch">
          <h2 style="font-size:var(--t-xl)">Reporting a vulnerability</h2>
          <p class="muted">
            If you find a way for a file to leave the browser, or a flaw in how encryption is
            applied, please report it before disclosing it publicly. Include the browser, the
            steps, and the file type involved. See the <a href="/contact">contact page</a> for how
            to get in touch.
          </p>
        </div>
      </div>
    </section>
  );
}
