import type { JSX } from 'preact';
import { Icon } from '../components/Icon';
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
      <div class="page stack" style="gap:var(--s-7)">
        <SectionHead
          eyebrow="Security"
          title="There is no server to trust"
          level={1}
          lead="Most converters ask you to upload a file and then trust a retention policy. Convert2Any removes that trade entirely — the conversion runs on your machine, so there is no copy of your file anywhere else."
        />

        <div class="grid grid-3">
          <FeatureItem level={2} icon="offline" title="No network path for your data">
            Files are read with the File API and processed in a Web Worker. No fetch, no XHR, no
            WebSocket ever receives your file contents. Disconnect your network and everything
            still works.
          </FeatureItem>
          <FeatureItem level={2} icon="shield" title="No third-party requests">
            Fonts, WebAssembly modules and scripts are all served from this origin. There is no
            CDN call, no analytics script, and no tracking pixel to leak what you converted.
          </FeatureItem>
          <FeatureItem level={2} icon="lock" title="Real cryptography">
            PDF password protection is AES-256 performed by qpdf compiled to WebAssembly. Your
            password is used in this tab and never transmitted.
          </FeatureItem>
        </div>

        <Card variant="float">
          <div class="stack" style="gap:var(--s-4)">
            <h2 style="font-size:var(--t-2xl)">Verify it in three steps</h2>
            <p class="muted">
              You should not take a security claim on faith. This one takes about thirty seconds to
              check.
            </p>
            <ol class="stack" style="gap:var(--s-4);padding-left:var(--s-5)">
              <li>
                <strong style="color:var(--text-strong)">Watch the network.</strong>{' '}
                <span class="muted">
                  Open devtools, switch to the Network tab, then convert a file. You will see the
                  app's own assets load and nothing carrying your file.
                </span>
              </li>
              <li>
                <strong style="color:var(--text-strong)">Pull the plug.</strong>{' '}
                <span class="muted">
                  Load the page, disconnect from Wi-Fi entirely, and convert something. It works,
                  because the conversion never needed a network.
                </span>
              </li>
              <li>
                <strong style="color:var(--text-strong)">Read the source.</strong>{' '}
                <span class="muted">
                  The build is static and unminified sources are mapped. There is no backend
                  endpoint to find, because none exists.
                </span>
              </li>
            </ol>
          </div>
        </Card>

        <div class="grid grid-2">
          <Card>
            <div class="stack" style="gap:var(--s-3)">
              <h2 class="row card-title" style="gap:var(--s-2)">
                <Icon name="image" size={18} /> Metadata is removed structurally
              </h2>
              <p class="small muted">
                Image conversion decodes to raw pixels and re-encodes from those pixels. EXIF, GPS
                coordinates and camera details are not stripped by a filter that could be
                misconfigured — there is simply no code path that carries them from input to
                output. Orientation is baked into the pixels first, so photos stay upright.
              </p>
            </div>
          </Card>
          <Card>
            <div class="stack" style="gap:var(--s-3)">
              <h2 class="row card-title" style="gap:var(--s-2)">
                <Icon name="bolt" size={18} /> Limits worth knowing
              </h2>
              <ul class="feature-list">
                <li>
                  <Icon name="check" size={16} />
                  <span>
                    Very large files are bound by tab memory. There is no server fallback, by
                    design.
                  </span>
                </li>
                <li>
                  <Icon name="check" size={16} />
                  <span>
                    Office conversions are text-fidelity. Each tool says so before you pick a file.
                  </span>
                </li>
                <li>
                  <Icon name="check" size={16} />
                  <span>
                    Scanned PDFs have no text layer to recover; that needs OCR, which is not
                    included.
                  </span>
                </li>
              </ul>
            </div>
          </Card>
        </div>

        <Card variant="soft">
          <div class="stack" style="gap:var(--s-3)">
            <h2 class="card-title">Reporting a vulnerability</h2>
            <p class="small muted">
              If you find a way for a file to leave the browser, or a flaw in how encryption is
              applied, please report it before disclosing it publicly. Include the browser, the
              steps, and the file type involved. See the{' '}
              <a href="/contact">contact page</a> for how to get in touch.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
