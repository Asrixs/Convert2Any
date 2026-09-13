import type { JSX } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Tools } from './pages/Tools';
import { ToolPage } from './pages/ToolPage';
import { Pricing } from './pages/Pricing';
import { Security } from './pages/Security';
import { About, Contact, Privacy, Terms } from './pages/Static';
import { NotFound } from './pages/NotFound';

/**
 * Route table.
 *
 * `/tools/:slug` is one component driven by the catalog, so the nineteen tool
 * pages stay in sync with the toolset by construction. Every route is
 * prerendered to static HTML at build time (see prerender in main.tsx), which
 * is why these are plain <a href> links rather than click-intercepting ones —
 * preact-iso upgrades same-origin navigation to client-side routing itself.
 */
export function App(): JSX.Element {
  return (
    <LocationProvider>
      <Layout>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/tools" component={Tools} />
          <Route path="/tools/:slug" component={ToolPage} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/security" component={Security} />
          <Route path="/about" component={About} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/contact" component={Contact} />
          <Route default component={NotFound} />
        </Router>
      </Layout>
    </LocationProvider>
  );
}
