import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Icon } from '../components/Icon';
import { Accordion, Button, Card, SectionHead } from '../components/ui';
import { TOOLS } from '../tools/catalog';
import { useSeo } from '../seo';

/**
 * Pricing.
 *
 * Everything on the Free plan genuinely works today and needs no account,
 * because the site has no server to meter. The Pro column is an honest
 * waitlist rather than a checkout that cannot complete: the email is stored
 * in this browser only, and the UI says exactly that.
 */

const FREE_FEATURES = [
  `All ${TOOLS.length} tools, unlocked`,
  'Unlimited files and conversions',
  'No account, no email required',
  'Batch queue with ZIP download',
  'AES-256 PDF password protection',
  'Works completely offline',
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
      'Convert2Any is free and needs no account — every tool runs in your browser. A Pro tier for server-side, full-fidelity Office conversion is in development.',
    path: '/pricing',
  });

  return (
    <section class="section">
      <div class="page stack" style="gap:var(--s-7)">
        <SectionHead
          center
          eyebrow="Pricing"
          title="Free, because there is nothing to meter"
          level={1}
          lead="Conversions run on your device, not on our servers, so there are no per-file costs to pass on. There is no paid plan to upsell you to today."
        />

        <div class="grid grid-2" style="max-width:900px;margin-inline:auto;width:100%">
          <Card variant="float" class="plan-featured">
            <div class="stack" style="gap:var(--s-4)">
              <div class="row" style="justify-content:space-between">
                <span class="card-title">Free</span>
                <span class="badge badge-exact">Available now</span>
              </div>
              <div class="row" style="gap:var(--s-2);align-items:baseline">
                <span class="price">€0</span>
                <span class="price-period">forever</span>
              </div>
              <p class="small muted">Every tool on this site, with no limits and no sign-up.</p>
              <ul class="feature-list">
                {FREE_FEATURES.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a class="btn btn-primary btn-block" href="/#convert" style="margin-top:var(--s-2)">
                Start converting
              </a>
            </div>
          </Card>

          <Card>
            <div class="stack" style="gap:var(--s-4)">
              <div class="row" style="justify-content:space-between">
                <span class="card-title">Pro</span>
                <span class="badge badge-unavailable">In development</span>
              </div>
              <div class="row" style="gap:var(--s-2);align-items:baseline">
                <span class="price muted">—</span>
                <span class="price-period">not yet priced</span>
              </div>
              <p class="small muted">
                For the conversions a browser genuinely cannot do well: exact Office layout, OCR,
                and files too large for a single tab.
              </p>
              <ul class="feature-list">
                {PRO_FEATURES.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Waitlist />
            </div>
          </Card>
        </div>

        <div class="stack" style="gap:var(--s-4);max-width:70ch;margin-inline:auto;width:100%">
          <h2 style="font-size:var(--t-xl)">Questions</h2>
          <div>
            <Accordion
              q="Is it really free, with no catch?"
              a="Yes. Your files are processed by your own CPU, so serving you costs us nothing beyond static hosting. There is no account, no quota and no advertising."
            />
            <Accordion
              q="Why would Pro need a server if the point is not uploading?"
              a="Because some conversions are genuinely impossible in a browser. Exact Word and PowerPoint layout needs a real rendering engine, and OCR needs models too large to ship to a tab. Pro would be opt-in and clearly marked — the free tools would keep running locally."
            />
            <Accordion
              q="What happens to my email on the waitlist?"
              a="Nothing leaves your browser. This site has no backend, so the address is saved in this browser's local storage only. It is a signal of interest for you to keep, not a list we hold."
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

const STORAGE_KEY = 'convert2any:waitlist';

/**
 * Waitlist capture with no backend.
 *
 * Storing the address locally and saying so is the only honest option for a
 * static site: a form that appeared to submit somewhere would be a lie, and
 * a disabled input would waste the visitor's intent.
 */
function Waitlist(): JSX.Element {
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function submit(event: JSX.TargetedEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = email.trim();
    // Deliberately permissive: the goal is catching typos, not policing RFCs.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Private mode or blocked storage — the message below still holds.
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <div class="notice notice-accent" style="margin-top:var(--s-2)">
        <Icon name="check" size={18} />
        <div>
          Noted — kept in this browser only. Nothing was sent anywhere, because there is nowhere to
          send it.
        </div>
      </div>
    );
  }

  return (
    <form class="stack" style="gap:var(--s-2);margin-top:var(--s-2)" onSubmit={submit} noValidate>
      <label class="field-label" for="waitlist-email">
        Get told when Pro is ready
      </label>
      <input
        id="waitlist-email"
        class="input"
        type="email"
        value={email}
        placeholder="you@example.com"
        aria-describedby="waitlist-help"
        aria-invalid={error ? 'true' : undefined}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setEmail(e.currentTarget.value)}
      />
      {error && <p class="field-error">{error}</p>}
      <p class="field-help" id="waitlist-help">
        Saved in this browser only — this site has no server to send it to.
      </p>
      <Button type="submit">Join the waitlist</Button>
    </form>
  );
}
