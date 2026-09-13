import { useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { Icon } from './Icon';
import { CATEGORIES, toolsByCategory } from '../tools/catalog';

/**
 * Site shell: skip link, sticky navigation, and the footer.
 *
 * The mobile menu closes on navigation by keying off the current path, so a
 * tap that changes route never leaves the panel covering the page.
 */

const NAV = [
  { href: '/tools', label: 'Tools' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About' },
];

export function Layout({ children }: { children: ComponentChildren }): JSX.Element {
  const { path } = useLocation();
  const [open, setOpen] = useState(false);

  // Collapse the mobile panel whenever the route changes.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    if (open) setOpen(false);
  }

  return (
    <>
      <a class="skip-link" href="#main">
        Skip to content
      </a>

      <header class="nav">
        <div class="page nav-inner">
          <a class="brand" href="/">
            <Icon name="layers" size={22} class="brand-mark" />
            Convert<span class="brand-mark">2</span>Any
          </a>

          <button
            type="button"
            class="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>

          <ul class={`nav-links${open ? ' open' : ''}`} id="primary-nav">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  class="nav-link"
                  href={item.href}
                  aria-current={path.startsWith(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <a class="btn btn-sm" href="/#convert" style="margin-left:var(--s-2)">
                Start converting
              </a>
            </li>
          </ul>
        </div>
      </header>

      <main id="main">{children}</main>

      <Footer />
    </>
  );
}

function Footer(): JSX.Element {
  const edit = toolsByCategory('edit').slice(0, 5);
  const convert = toolsByCategory('convert').slice(0, 5);

  return (
    <footer class="footer">
      <div class="page">
        <div class="footer-grid">
          <div class="stack" style="gap:var(--s-3)">
            <a class="brand" href="/">
              <Icon name="layers" size={20} class="brand-mark" />
              Convert<span class="brand-mark">2</span>Any
            </a>
            <p class="small muted" style="max-width:34ch">
              File conversion that runs entirely in your browser. No uploads, no accounts, no
              queue.
            </p>
          </div>

          <nav aria-labelledby="footer-edit">
            <h2 id="footer-edit">{CATEGORIES.edit.title}</h2>
            <ul>
              {edit.map((tool) => (
                <li key={tool.slug}>
                  <a href={`/tools/${tool.slug}`}>{tool.title}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-convert">
            <h2 id="footer-convert">{CATEGORIES.convert.title}</h2>
            <ul>
              {convert.map((tool) => (
                <li key={tool.slug}>
                  <a href={`/tools/${tool.slug}`}>{tool.title}</a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company">Company</h2>
            <ul>
              <li>
                <a href="/about">About</a>
              </li>
              <li>
                <a href="/pricing">Pricing</a>
              </li>
              <li>
                <a href="/security">Security</a>
              </li>
              <li>
                <a href="/privacy">Privacy</a>
              </li>
              <li>
                <a href="/terms">Terms</a>
              </li>
              <li>
                <a href="/contact">Contact</a>
              </li>
            </ul>
          </nav>
        </div>

        <div class="footer-bottom">
          <span>© {new Date().getFullYear()} Convert2Any</span>
          <span>Built as a static site — every conversion runs on your device.</span>
        </div>
      </div>
    </footer>
  );
}
