import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { useRoute } from 'preact-iso';
import { Converter } from '../components/Converter';
import { ToolForm } from '../components/ToolForm';
import { Icon } from '../components/Icon';
import { Accordion, Card, FidelityBadge, Notice, ToolCard } from '../components/ui';
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
    title: `${tool.title}, free in your browser`,
    description: tool.short,
    path: `/tools/${tool.slug}`,
  });

  const [values, setValues] = useState(() => initialValues(tool));
  // Fields the user has edited. A field's error shows only after that, so a
  // fresh page does not open with "Password is required" in red.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const errors = useMemo(() => validate(tool, values), [tool, values]);
  const shownErrors = Object.fromEntries(
    Object.entries(errors).filter(([name]) => touched.has(name)),
  );
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
      <div class="page stack" style="gap:var(--s-7)">
        <div class="stack" style="gap:var(--s-5)">
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
              <li aria-current="page" style="color:var(--text)">
                {tool.title}
              </li>
            </ol>
          </nav>

          <header class="heading-block" style="max-width:68ch">
            <div class="row" style="gap:var(--s-3);margin-bottom:var(--s-2)">
              <FidelityBadge level={tool.fidelity} />
              {tool.accepts.length > 0 && (
                <span class="eyebrow">
                  {tool.accepts.map((e) => e.toUpperCase()).join(' · ')} → {tool.produces}
                </span>
              )}
            </div>
            <h1 style="font-size:var(--t-4xl)">{tool.title}</h1>
            <p class="lead">{tool.description}</p>
          </header>
        </div>

        <div class="stack" style="gap:var(--s-4);max-width:880px">
          {/* Fidelity note and caveat, stated before any file is chosen. */}
          {(tool.fidelity !== 'exact' || tool.caveat) && (
            <Notice tone={unavailable ? 'error' : 'accent'} icon={unavailable ? 'close' : 'shield'}>
              <strong>{FIDELITY_COPY[tool.fidelity].label}.</strong>{' '}
              {FIDELITY_COPY[tool.fidelity].note}
              {tool.caveat && <span> {tool.caveat}</span>}
            </Notice>
          )}

          {unavailable ? (
            <Card variant="float">
              <div class="stack center" style="gap:var(--s-4);align-items:center">
                <Icon name="slides" size={28} class="feature-icon" />
                <h2 style="font-size:var(--t-xl)">This conversion needs a server</h2>
                <p class="muted" style="max-width:52ch">
                  Rather than ship a converter that produces plausible-looking but wrong slides,
                  Convert2Any leaves this one out. The tools below all run properly in your
                  browser.
                </p>
                <a class="btn" href="/tools">
                  Browse working tools
                </a>
              </div>
            </Card>
          ) : (
            <Card variant="float">
              <div class="stack" style="gap:var(--s-6)">
                {tool.fields.length > 0 && (
                  <ToolForm
                    tool={tool}
                    values={values}
                    errors={shownErrors}
                    onChange={(name, value) => {
                      setValues((prev) => ({ ...prev, [name]: value }));
                      setTouched((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
                    }}
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
        </div>

        {tool.faq && tool.faq.length > 0 && (
          <div style="max-width:68ch">
            <h2 style="font-size:var(--t-xl);margin-bottom:var(--s-4)">Questions</h2>
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
                <ToolCard key={other.slug} tool={other} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
