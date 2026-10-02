import type { JSX } from 'preact';
import { Converter } from '../components/Converter';
import { Icon } from '../components/Icon';
import { SOURCE_URL } from '../components/Layout';
import { FeatureItem, SectionHead, ToolCard } from '../components/ui';
import { CATEGORIES, toolsByCategory, type ToolCategory } from '../tools/catalog';
import { useSeo } from '../seo';

/**
 * Landing page. Minimal on purpose: the converter is the page. Below it sit
 * the tools by category and three reasons the site works the way it does —
 * nothing that competes with the file someone came here to convert.
 */
export function Home(): JSX.Element {
  useSeo({
    title: 'Convert2Any | Convert, edit and secure files in your browser',
    description:
      'Merge, split, compress and convert PDFs, Office documents and images. Everything runs locally in your browser: no uploads, no accounts, no waiting.',
    path: '/',
  });

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section class="section" id="convert">
        <div class="page">
          <div class="heading-block center" style="max-width:720px;margin-inline:auto">
            <p class="eyebrow" style="margin-bottom:var(--s-2)">
              Private file conversion
            </p>
            <h1 style="font-size:var(--t-5xl)">Convert any file</h1>
            <p class="lead" style="margin-inline:auto">
              Drop a document, image or PDF and choose what it should become. Everything runs in
              this tab, so your files never leave your device.
            </p>
          </div>

          <div class="card-float" style="margin-top:var(--s-7);max-width:760px;margin-inline:auto">
            <Converter />
          </div>

          <ul class="trust-row" style="margin-top:var(--s-5);list-style:none">
            <li>
              <Icon name="shield" size={16} /> No uploads
            </li>
            <li>
              <Icon name="check" size={16} /> No account
            </li>
            <li>
              <a href={SOURCE_URL} rel="noopener" style="display:inline-flex;gap:var(--s-2)">
                <Icon name="code" size={16} /> Open source
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- tool grid */}
      {(Object.keys(CATEGORIES) as ToolCategory[]).map((category) => (
        <section class="section-tight" key={category}>
          <div class="page stack" style="gap:var(--s-5)">
            <SectionHead title={CATEGORIES[category].title} lead={CATEGORIES[category].blurb} />
            <div class="grid grid-3">
              {toolsByCategory(category).map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ---------------------------------------------------------- why */}
      <section class="section">
        <div class="page stack" style="gap:var(--s-7)">
          <SectionHead
            eyebrow="Why there is no server"
            title="Nothing to upload, nothing to trust"
            lead="Most conversion sites ask you to upload first and trust them afterwards. Convert2Any removes the trust problem by removing the upload."
          />
          <div class="grid grid-3" style="gap:var(--s-6)">
            <FeatureItem icon="shield" title="Private by construction">
              No code path sends a file anywhere. Open your browser's Network panel while
              converting: every request is for the app's own code, never your data.
            </FeatureItem>
            <FeatureItem icon="image" title="Metadata stripped">
              Images are rebuilt from their pixels, so EXIF data and GPS locations cannot survive
              the conversion.
            </FeatureItem>
            <FeatureItem icon="check" title="Honest about fidelity">
              Every tool says whether it is exact, text-only or lossy before you choose a file,
              not after.
            </FeatureItem>
          </div>
          <a class="text-link" href="/security">
            How to check this yourself <Icon name="arrow-right" size={14} />
          </a>
        </div>
      </section>
    </>
  );
}
