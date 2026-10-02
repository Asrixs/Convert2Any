import type { JSX } from 'preact';
import { Icon } from '../components/Icon';
import { SOURCE_URL } from '../components/Layout';
import { Accordion, Card, SectionHead } from '../components/ui';
import { TOOLS } from '../tools/catalog';
import { useSeo } from '../seo';

/**
 * Pricing.
 *
 * Everything on the Free plan genuinely works today and needs no account,
 * because the site has no server to meter. Pro is described as what it is —
 * not built yet — and progress lives in the public repository. (An earlier
 * "waitlist" kept addresses in the visitor's own browser, so nobody could
 * ever have been told anything; it is gone.)
 */

const FREE_FEATURES = [
  `All ${TOOLS.length} tools, unlocked`,
  'Unlimited files and conversions',
  'No account, no email required',
  'Batch queue with ZIP download',
  'AES-256 PDF password protection',
  'Files are processed on your device, never uploaded',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Server-side Office conversion for exact layout fidelity',
  'PowerPoint and legacy .doc/.xls support',
  'OCR for scanned PDFs',
  'Files larger than your device memory',
];

export function Pricing(): JSX.Element {
  useSeo({
    title: 'Pricing',
    description:
      'Convert2Any is free and needs no account — every tool runs in your browser. A Pro tier for server-side, full-fidelity Office conversion is being explored.',
    path: '/pricing',
  });

  return (
    <section class="section">
      <div class="page stack" style="gap:var(--s-8)">
        <SectionHead
          center
          title="Free, because there is nothing to meter"
          level={1}
          lead="Conversions run on your device, not on a server, so there are no per-file costs to pass on. There is no paid plan to upsell you to."
        />

        <div class="grid grid-2" style="max-width:880px;margin-inline:auto;width:100%">
          <Card variant="float" class="plan-featured">
            <div class="stack" style="gap:var(--s-5)">
              <div class="row" style="justify-content:space-between">
                <h2 class="card-title">Free</h2>
                <span class="badge badge-exact">Available now</span>
              </div>
              <div class="row" style="gap:var(--s-2);align-items:baseline">
                <span class="price">€0</span>
                <span class="price-period">forever</span>
              </div>
              <ul class="feature-list">
                {FREE_FEATURES.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a class="btn btn-primary btn-block" href="/#convert">
                Start converting
              </a>
            </div>
          </Card>

          <Card variant="float">
            <div class="stack" style="gap:var(--s-5)">
              <div class="row" style="justify-content:space-between">
                <h2 class="card-title">Pro</h2>
                <span class="badge badge-unavailable">Not built yet</span>
              </div>
              <div class="row" style="gap:var(--s-2);align-items:baseline">
                <span class="price muted">—</span>
                <span class="price-period">not priced</span>
              </div>
              <ul class="feature-list">
                {PRO_FEATURES.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a class="btn btn-block" href={SOURCE_URL} rel="noopener">
                Follow progress on GitHub
              </a>
            </div>
          </Card>
        </div>

        <div style="max-width:68ch;margin-inline:auto;width:100%">
          <h2 style="font-size:var(--t-xl);margin-bottom:var(--s-4)">Questions</h2>
          <div>
            <Accordion
              q="Is it really free, with no catch?"
              a="Yes. Your files are processed by your own device, so serving you costs nothing beyond static hosting. There is no account, no quota and no advertising."
            />
            <Accordion
              q="Why would Pro need a server if the point is not uploading?"
              a="Because some conversions are genuinely impossible in a browser. Exact Word and PowerPoint layout needs a real rendering engine, and OCR needs models too large to ship to a tab. Pro would be opt-in and clearly marked — the free tools would keep running locally."
            />
            <Accordion
              q="How will I hear about Pro?"
              a="Watch the GitHub repository for releases. This site has no backend, so it cannot keep a mailing list."
            />
            <Accordion
              q="Can I self-host Convert2Any?"
              a="Yes. The production build is a folder of static files — put it behind any web server or CDN and it works, including on an internal network with no internet access."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
