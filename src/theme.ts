/**
 * Light / dark theme.
 *
 * The theme lives on <html data-theme>. An inline script in index.html sets
 * it before first paint — from the saved choice, else the system setting — so
 * a dark-mode visitor never sees a flash of the light page. This module only
 * handles changes after that: the header toggle, and the system setting
 * changing while no choice has been saved.
 */

export type Theme = 'light' | 'dark';

/** Must match the key the inline script in index.html reads. */
const STORAGE_KEY = 'convert2any:theme';

/** Page background per theme, for the browser's own UI (address bar on mobile). */
const CHROME_COLOR: Record<Theme, string> = { light: '#f4f4f1', dark: '#0c0c09' };

const systemDark = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)');

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Storage blocked (private mode, strict settings): just follow the system.
    return null;
  }
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = CHROME_COLOR[theme];
  }
}

/** Switch theme and remember the choice for the next visit. */
export function setTheme(theme: Theme): void {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not saved, but the switch still applies for this visit.
  }
}

/**
 * Follow the system setting while the visitor has not chosen a theme.
 * Returns an unsubscribe function.
 */
export function followSystemTheme(onChange: (theme: Theme) => void): () => void {
  const query = systemDark();
  const listener = (event: MediaQueryListEvent): void => {
    if (savedTheme()) return;
    const theme: Theme = event.matches ? 'dark' : 'light';
    apply(theme);
    onChange(theme);
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
