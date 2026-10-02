import type { JSX } from 'preact';
import { FidelityBadge, SectionHead, ToolCard } from '../components/ui';
import { CATEGORIES, FIDELITY_COPY, toolsByCategory, TOOLS, type ToolCategory } from '../tools/catalog';
import { useSeo } from '../seo';

/** Full tool catalog, grouped by the three categories from the brief. */
export function Tools(): JSX.Element {
  useSeo({
    title: 'All tools',
    description:
      'Every Convert2Any tool: merge, split, compress, reorder and rotate PDFs; convert between PDF, Word, Excel, images and HTML; add passwords, watermarks and page numbers.',
    path: '/tools',
  });

  return (
    <section class="section">
      <div class="page stack" style="gap:var(--s-8)">
        <div class="stack" style="gap:var(--s-6)">
          <SectionHead
            title="All tools"
            level={1}
            lead={`${TOOLS.length} tools, each running entirely in your browser. Every one states how faithful its result is.`}
          />

          {/* The fidelity legend: a definition list, not a decorated card. */}
          <dl class="grid grid-2" style="gap:var(--s-3) var(--s-6);margin:0">
            {(Object.keys(FIDELITY_COPY) as (keyof typeof FIDELITY_COPY)[]).map((level) => (
              <div key={level} class="row" style="gap:var(--s-3);align-items:baseline;flex-wrap:nowrap">
                <dt style="flex-shrink:0">
                  <FidelityBadge level={level} />
                </dt>
                <dd class="small muted" style="margin:0">
                  {FIDELITY_COPY[level].note}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {(Object.keys(CATEGORIES) as ToolCategory[]).map((category) => (
          <div key={category} class="stack" style="gap:var(--s-5)">
            <SectionHead title={CATEGORIES[category].title} lead={CATEGORIES[category].blurb} />
            <div class="grid grid-3">
              {toolsByCategory(category).map((tool) => (
                <ToolCard key={tool.slug} tool={tool} showFormats />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
