import type { JSX } from 'preact';
import { Icon } from '../components/Icon';
import { TOOLS } from '../tools/catalog';
import { useSeo } from '../seo';

/** 404. Offers the tool list rather than a dead end. */
export function NotFound(): JSX.Element {
  useSeo({
    title: 'Page not found',
    description: 'That page does not exist. Browse the Convert2Any tool catalog instead.',
  });

  return (
    <section class="section">
      <div class="page center stack" style="gap:var(--s-5);align-items:center">
        <span class="icon-badge">
          <Icon name="close" size={22} />
        </span>
        <h1 style="font-size:var(--t-4xl)">Page not found</h1>
        <p class="lead" style="margin-inline:auto">
          That address does not match anything on Convert2Any. The tool you want is probably one of
          these {TOOLS.length}.
        </p>
        <div class="row" style="justify-content:center">
          <a class="btn btn-primary" href="/tools">
            Browse all tools
          </a>
          <a class="btn" href="/">
            Back to home
          </a>
        </div>
      </div>
    </section>
  );
}
