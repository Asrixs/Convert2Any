import type { JSX } from 'preact';
import { Converter } from '../components/Converter';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, FeatureItem, FidelityBadge, SectionHead, Stat } from '../components/ui';
import { CATEGORIES, TOOLS, toolsByCategory, type ToolCategory } from '../tools/catalog';
import { useSeo } from '../seo';

/**
 * Landing page. Structure follows the reference layout: a centred hero with
 * the conversion card floating over it, then a multi-column grid of format
 * information, features, and the tool catalog.
 */

const FORMAT_GROUPS = [
  { label: 'Documents', items: ['PDF', 'DOCX', 'XLSX', 'CSV', 'HTML'] },
  { label: 'Images', items: ['JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF'] },
  { label: 'Output', items: ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'WEBP', 'ZIP'] },
];

export function Home(): JSX.Element {
  useSeo({
    title: 'Convert2Any — convert, edit and secure files in your browser',
    description:
      'Merge, split, compress and convert PDFs, Office documents and images. Everything runs locally in your browser — no uploads, no accounts, no waiting.',
    path: '/',
  });

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section class="section" id="convert">
        <div class="page">
          <div class="stack center" style="gap:var(--s-4);max-width:760px;margin-inline:auto">
            <p class="eyebrow">Convert anything, locally</p>
            <h1 style="font-size:var(--t-5xl)">
              Convert <span style="color:var(--accent)">any</span> file
            </h1>
            <p class="lead" style="margin-inline:auto">
              Drop a file and pick what to turn it into. Convert2Any handles documents, images and
              PDFs — and every conversion runs inside this tab, so your files never leave your
              device.
            </p>
          </div>

          <div class="card-float" style="margin-top:var(--s-7);max-width:820px;margin-inline:auto">
            <Converter />
          </div>

          <div
            class="row"
            style="justify-content:center;margin-top:var(--s-5);gap:var(--s-5)"
          >
            <span class="row small muted" style="gap:var(--s-2)">
              <Icon name="offline" size={16} /> Works offline
            </span>
            <span class="row small muted" style="gap:var(--s-2)">
              <Icon name="shield" size={16} /> No uploads
            </span>
            <span class="row small muted" style="gap:var(--s-2)">
              <Icon name="bolt" size={16} /> No queue, no limits
            </span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- formats + trust */}
      <section class="section-tight">
        <div class="page grid" style="grid-template-columns:1.4fr 1fr;align-items:start">
          <Card>
            <div class="stack">
              <h2 class="row card-title" style="gap:var(--s-2)">
                <Icon name="layers" size={18} /> Format catalog
              </h2>
              <p class="small muted">
                {TOOLS.length} tools across documents, images, spreadsheets and markup — with the
                fidelity of every conversion stated up front.
              </p>
              <div class="stack" style="gap:var(--s-4);margin-top:var(--s-2)">
                {FORMAT_GROUPS.map((group) => (
                  <div key={group.label} class="stack" style="gap:var(--s-2)">
                    <span class="small muted" style="letter-spacing:0.08em;text-transform:uppercase">
                      {group.label}
                    </span>
                    <div class="chip-list">
                      {group.items.map((item) => (
                        <Chip key={item}>{item}</Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div class="stack">
              <h2 class="row card-title" style="gap:var(--s-2)">
                <Icon name="shield" size={18} /> Data security
              </h2>
              <p class="small muted">
                There is no server to trust, because there is no server. The claim is verifiable in
                about thirty seconds.
              </p>
              <ul class="feature-list" style="margin-top:var(--s-2)">
                <li>
                  <Icon name="check" size={16} />
                  <span>
                    <strong style="color:var(--text-strong)">Nothing is uploaded.</strong> Open your
                    network tab and convert a file — no request carries your data.
                  </span>
                </li>
                <li>
                  <Icon name="check" size={16} />
                  <span>
                    <strong style="color:var(--text-strong)">Works offline.</strong> Load the page,
                    disconnect entirely, and conversion keeps working.
                  </span>
                </li>
                <li>
                  <Icon name="check" size={16} />
                  <span>
                    <strong style="color:var(--text-strong)">Metadata stripped.</strong> Images are
                    rebuilt from pixels, so EXIF and GPS cannot survive.
                  </span>
                </li>
              </ul>
              <a class="row small" href="/security" style="gap:var(--s-2);color:var(--accent-text);margin-top:var(--s-2)">
                Read the security overview <Icon name="arrow-right" size={15} />
              </a>
            </div>
          </Card>
        </div>
      </section>

      {/* -------------------------------------------------------- tool grid */}
      {(Object.keys(CATEGORIES) as ToolCategory[]).map((category) => (
        <section class="section-tight" key={category}>
          <div class="page stack" style="gap:var(--s-5)">
            <SectionHead
              eyebrow={category === 'edit' ? 'Toolset' : undefined}
              title={CATEGORIES[category].title}
              lead={CATEGORIES[category].blurb}
            />
            <div class="grid grid-3">
              {toolsByCategory(category).map((tool) => (
                <a key={tool.slug} class="card card-link" href={`/tools/${tool.slug}`}>
                  <span class="icon-badge">
                    <Icon name={tool.icon as never} size={20} />
                  </span>
                  <span class="row" style="gap:var(--s-2);justify-content:space-between">
                    <span class="card-title">{tool.title}</span>
                    <FidelityBadge level={tool.fidelity} />
                  </span>
                  <span class="small muted">{tool.short}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* --------------------------------------------------------- features */}
      <section class="section-tight">
        <div class="page stack" style="gap:var(--s-5)">
          <SectionHead
            eyebrow="Why it is built this way"
            title="A converter with no server behind it"
            lead="Most conversion sites ask you to upload first and trust them afterwards. Convert2Any removes the trust problem by removing the upload."
          />
          <div class="grid grid-3">
            <FeatureItem icon="offline" title="Runs in your tab">
              Conversion happens in Web Workers using WebAssembly codecs. The UI never blocks, and
              nothing is queued behind other people's jobs.
            </FeatureItem>
            <FeatureItem icon="shield" title="Private by construction">
              Privacy here is not a policy promise — there is simply no code path that transmits a
              file. You can verify that in devtools.
            </FeatureItem>
            <FeatureItem icon="bolt" title="No accounts, no limits">
              No sign-up, no per-file cap, no daily quota. The only real ceiling is your device's
              memory.
            </FeatureItem>
            <FeatureItem icon="check" title="Honest about fidelity">
              Every tool states whether it is exact, text-fidelity or lossy — before you pick a
              file, not after.
            </FeatureItem>
            <FeatureItem icon="lock" title="Real encryption">
              Password protection uses AES-256 via qpdf, so a protected file is genuinely
              unreadable without its password.
            </FeatureItem>
            <FeatureItem icon="layers" title="Batch by default">
              Queue as many files as you like, convert them together, and download the lot as a
              single ZIP.
            </FeatureItem>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section class="section-tight">
        <div class="page">
          <Card variant="soft">
            <div class="grid grid-4" style="gap:var(--s-6)">
              <Stat value={String(TOOLS.length)} label="Tools available" />
              <Stat value="0" label="Bytes uploaded" />
              <Stat value="0" label="Accounts required" />
              <Stat value="100%" label="Runs on your device" />
            </div>
          </Card>
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section class="section-tight">
        <div class="page center stack" style="gap:var(--s-5);align-items:center">
          <SectionHead
            center
            title="Convert your first file"
            lead="No sign-up, nothing to install. Pick a file and it starts immediately."
          />
          <div class="row" style="justify-content:center">
            <Button variant="primary" onClick={() => scrollToConverter()}>
              Start converting
            </Button>
            <a class="btn" href="/tools">
              Browse all tools
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function scrollToConverter(): void {
  document.getElementById('convert')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
