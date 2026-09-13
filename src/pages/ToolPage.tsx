import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { useRoute } from 'preact-iso';
import { Converter } from '../components/Converter';
import { ToolForm } from '../components/ToolForm';
import { Icon } from '../components/Icon';
import { Accordion, Card, FidelityBadge, Notice } from '../components/ui';
import { FIDELITY_COPY, toolBySlug, toolsByCategory, type Tool } from '../tools/catalog';
import { buildOptions, initialValues, validate } from '../tools/options';
import { NotFound } from './NotFound';
import { useSeo } from '../seo';

/**
 * One page per tool, rendered from the catalog entry.
 *
 * Form state is raw strings (what the DOM gives us); it is coerced to typed
 * options in one place via buildOptions, so the pipeline never receives a
 * numeric field as a string.
 */
export function ToolPage(): JSX.Element {
  const { params } = useRoute();
  const tool = toolBySlug(params.slug ?? '');

  if (!tool) return <NotFound />;
  // Keyed so switching between tool routes resets form state rather than
  // carrying one tool's values into another.
  return <ToolView key={tool.slug} tool={tool} />;
}

function ToolView({ tool }: { tool: Tool }): JSX.Element {
  useSeo({
    title: `${tool.title} — free, in your browser`,
    description: tool.short,
    path: `/tools/${tool.slug}`,
  });

  const [values, setValues] = useState(() => initialValues(tool));
  const errors = useMemo(() => validate(tool, values), [tool, values]);
  const options = useMemo(() => buildOptions(tool, values), [tool, values]);
  const hasErrors = Object.keys(errors).length > 0;

  const unavailable = tool.fidelity === 'unavailable';
  // The HTML tool can run from pasted markup with no file selected at all.
  const allowEmpty = tool.slug === 'html-to-pdf' && (values.html ?? '').trim() !== '';
  const related = toolsByCategory(tool.category)
    .filter((t) => t.slug !== tool.slug)
    .slice(0, 3);

  return (
    <section class="section">
      <div class="page stack" style="gap:var(--s-6)">
        <nav aria-label="Breadcrumb">
          <ol class="breadcrumb">
            <li>
              <a href="/">Home</a>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <a href="/tools">Tools</a>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" style="color:var(--text-strong)">
              {tool.title}
            </li>
          </ol>
        </nav>

        <header class="stack" style="gap:var(--s-4);max-width:70ch">
          <span class="icon-badge">
            <Icon name={tool.icon as never} size={22} />
          </span>
          <div class="row" style="gap:var(--s-3)">
            <h1 style="font-size:var(--t-4xl)">{tool.title}</h1>
            <FidelityBadge level={tool.fidelity} />
          </div>
          <p class="lead">{tool.description}</p>
          <div class="chip-list">
            {tool.accepts.map((ext) => (
              <span key={ext} class="chip">
                {ext}
              </span>
            ))}
            {tool.accepts.length > 0 && (
              <>
                <span class="small muted" aria-hidden="true">
                  →
                </span>
                <span class="chip chip-accent">{tool.produces}</span>
              </>
            )}
          </div>
        </header>

        {/* Fidelity note and caveat, stated before any file is chosen. */}
        {(tool.fidelity !== 'exact' || tool.caveat) && (
          <Notice
            tone={unavailable ? 'error' : 'accent'}
            icon={unavailable ? 'close' : 'shield'}
          >
            <strong style="color:var(--text-strong)">{FIDELITY_COPY[tool.fidelity].label}.</strong>{' '}
            {FIDELITY_COPY[tool.fidelity].note}
            {tool.caveat && <div style="margin-top:var(--s-2)">{tool.caveat}</div>}
          </Notice>
        )}

        {unavailable ? (
          <Card variant="float">
            <div class="stack center" style="gap:var(--s-3);align-items:center">
              <Icon name="slides" size={32} />
              <span class="card-title">This conversion needs a server</span>
              <p class="small muted" style="max-width:52ch">
                Rather than ship a converter that produces plausible-looking but wrong slides,
                Convert2Any leaves this one out. The tools below all run properly in your browser.
              </p>
              <a class="btn" href="/tools">
                Browse working tools
              </a>
            </div>
          </Card>
        ) : (
          <Card variant="float">
            <div class="stack" style="gap:var(--s-5)">
              {tool.fields.length > 0 && (
                <ToolForm
                  tool={tool}
                  values={values}
                  errors={errors}
                  onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
                />
              )}
              <Converter
                tool={tool}
                options={options}
                disabled={hasErrors}
                allowEmpty={allowEmpty}
              />
            </div>
          </Card>
        )}

        {tool.faq && tool.faq.length > 0 && (
          <div class="stack" style="gap:var(--s-4);max-width:70ch">
            <h2 style="font-size:var(--t-xl)">Questions</h2>
            <div>
              {tool.faq.map((item) => (
                <Accordion key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div class="stack" style="gap:var(--s-4)">
            <h2 style="font-size:var(--t-xl)">Related tools</h2>
            <div class="grid grid-3">
              {related.map((other) => (
                <a key={other.slug} class="card card-link" href={`/tools/${other.slug}`}>
                  <span class="card-title">{other.title}</span>
                  <span class="small muted">{other.short}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
