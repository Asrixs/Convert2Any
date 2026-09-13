import type { JSX } from 'preact';
import { Icon } from '../components/Icon';
import { FidelityBadge, SectionHead } from '../components/ui';
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
      <div class="page stack" style="gap:var(--s-7)">
        <SectionHead
          eyebrow="Toolset"
          title="All tools"
          level={1}
          lead={`${TOOLS.length} tools, each running entirely in your browser. Every card states how faithful its conversion is.`}
        />

        <div class="card card-soft">
          <div class="stack" style="gap:var(--s-3)">
            <span class="card-title">What the fidelity labels mean</span>
            <div class="grid grid-2" style="gap:var(--s-3)">
              {(Object.keys(FIDELITY_COPY) as (keyof typeof FIDELITY_COPY)[]).map((level) => (
                <div key={level} class="row" style="gap:var(--s-3);align-items:flex-start">
                  <FidelityBadge level={level} />
                  <span class="small muted" style="flex:1;min-width:180px">
                    {FIDELITY_COPY[level].note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(Object.keys(CATEGORIES) as ToolCategory[]).map((category) => (
          <div key={category} class="stack" style="gap:var(--s-5)">
            <div class="stack" style="gap:var(--s-2)">
              <h2 style="font-size:var(--t-2xl)">{CATEGORIES[category].title}</h2>
              <p class="muted">{CATEGORIES[category].blurb}</p>
            </div>
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
                  <span class="chip-list" style="margin-top:var(--s-2)">
                    {tool.accepts.slice(0, 4).map((ext) => (
                      <span key={ext} class="chip">
                        {ext}
                      </span>
                    ))}
                    {tool.accepts.length > 0 && <span class="chip chip-accent">→ {tool.produces}</span>}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
