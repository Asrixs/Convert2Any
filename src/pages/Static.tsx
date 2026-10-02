import type { JSX } from 'preact';
import { SOURCE_URL } from '../components/Layout';
import { FeatureItem, SectionHead } from '../components/ui';
import { TOOLS } from '../tools/catalog';
import { useSeo } from '../seo';

/**
 * The narrative pages — About, Privacy, Terms, Contact.
 *
 * Grouped in one module because they share a prose layout and differ only in
 * content; splitting them into four near-identical files would add structure
 * without adding clarity.
 */

function Prose({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: JSX.Element | JSX.Element[];
}): JSX.Element {
  return (
    <section class="section">
      <div class="page page-narrow stack" style="gap:var(--s-7)">
        <SectionHead title={title} lead={lead} level={1} />
        <div class="prose">{children}</div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- About */

export function About(): JSX.Element {
  useSeo({
    title: 'About',
    description:
      'Why Convert2Any runs every conversion in your browser instead of on a server, and what that choice costs as well as what it buys.',
    path: '/about',
  });

  return (
    <section class="section">
      <div class="page stack" style="gap:var(--s-8)">
        <SectionHead
          title="Built the awkward way, on purpose"
          level={1}
          lead="Convert2Any is a file converter with no backend. That decision makes some things impossible and everything else private."
        />

        <div class="page-narrow prose" style="padding:0">
          <h2>The problem with uploading</h2>
          <p>
            Conversion sites ask for a lot of trust. You hand over a contract, a passport scan or a
            set of holiday photos, and in return you get a promise: we delete files after an hour.
            That promise cannot be verified from outside. Photos carry GPS coordinates, documents
            carry revision history and author names, and once bytes reach someone else's disk you
            have no way to confirm what happened next.
          </p>
          <p>
            Convert2Any takes the other route. Browsers have been able to decode images, parse PDFs
            and run WebAssembly for years. If the conversion can happen on your machine, there is
            no reason to move the file at all — and then the retention policy stops mattering,
            because there is nothing to retain.
          </p>

          <h2>What that costs</h2>
          <p>
            This is a real trade-off, not a free win, and it is worth being direct about the bill.
            Large files are limited by the memory of a single browser tab. Office conversions are
            text-fidelity: words, headings, lists and tables survive, but exact page layout does
            not, because reproducing it properly needs a rendering engine like LibreOffice running
            on a server. PowerPoint is missing entirely for that reason, and scanned PDFs need OCR
            that is too large to ship to a tab.
          </p>
          <p>
            Every one of those limits is labelled on the tool itself, before you choose a file.
            A converter that quietly produces a mangled document is worse than one that tells you
            what it cannot do.
          </p>

          <h2>How it works</h2>
          <p>
            The site is a static bundle. Conversions run in Web Workers so the interface never
            freezes, using pdf-lib and pdf.js for PDFs, WebAssembly codecs for images, SheetJS for
            spreadsheets, mammoth for Word documents, and qpdf for encryption. Heavy libraries are
            loaded only when a tool that needs them is used, so opening the home page does not
            download a PDF engine.
          </p>
        </div>

        <div class="grid grid-3" style="gap:var(--s-6)">
          <FeatureItem icon="shield" title="No accounts">
            Nothing to sign up for, so there is no profile, no history and no password to leak.
          </FeatureItem>
          <FeatureItem icon="check" title="No telemetry">
            No analytics scripts and no error reporting. We do not know which tools you use.
          </FeatureItem>
          <FeatureItem icon="layers" title={`${TOOLS.length} tools`}>
            Documents, images, spreadsheets, markup and security — all from the same static bundle.
          </FeatureItem>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Privacy */

export function Privacy(): JSX.Element {
  useSeo({
    title: 'Privacy',
    description:
      'Convert2Any collects nothing. No accounts, no analytics, no cookies, and no file ever leaves your device.',
    path: '/privacy',
  });

  return (
    <Prose
      title="We collect nothing"
      lead="This is a short page because there is very little to describe."
    >
      <h2>Files</h2>
      <p>
        Your files are never transmitted. They are read in your browser, processed in a Web Worker
        on your device, and written back to a download. No copy is created anywhere outside your
        computer, and we could not access one if we wanted to.
      </p>

      <h2>Personal data</h2>
      <p>
        Convert2Any has no accounts, no sign-up and no login. It never asks for your name or email
        address, and there is no server that could receive them.
      </p>

      <h2>Analytics and cookies</h2>
      <p>
        There are none. No analytics provider, no tag manager, no advertising network, no session
        cookie, no fingerprinting. The site sets no cookies at all.
      </p>

      <h2>Third parties</h2>
      <p>
        The site makes no third-party requests. Fonts, code and WebAssembly modules are served from
        the same origin as the page, so no external company learns that you visited or what you
        converted.
      </p>

      <h2>What your browser stores</h2>
      <p>
        Only the browser's ordinary cache of the site's own code and fonts, which clearing site
        data removes.
      </p>

      <h2>Changes</h2>
      <p>
        If this ever changes — for instance if an optional server-side Pro tier ships — it will be
        opt-in, clearly labelled at the point of use, and described here before it launches.
      </p>
    </Prose>
  );
}

/* ---------------------------------------------------------------- Terms */

export function Terms(): JSX.Element {
  useSeo({
    title: 'Terms',
    description: 'The terms of use for Convert2Any: provided as-is, free, with no warranty.',
    path: '/terms',
  });

  return (
    <Prose
      title="Terms of use"
      lead="Plain language, because these should be readable."
    >
      <h2>The service</h2>
      <p>
        Convert2Any is provided free of charge and as-is. It runs in your browser; we do not host,
        process or store your files at any point.
      </p>

      <h2>No warranty</h2>
      <p>
        Conversion is provided without warranty of any kind. Several tools are explicitly
        text-fidelity or lossy, and those limits are stated on each tool page. Always keep your
        original file and check the output before relying on it. We are not liable for data loss,
        corrupted output, or decisions made on the basis of a converted document.
      </p>

      <h2>Your responsibilities</h2>
      <p>
        You are responsible for having the right to process the files you convert, and for
        complying with the laws that apply to you. The password tools are for documents you own or
        are authorised to access: Unlock PDF removes protection when you supply the correct
        password — it is not a means of defeating encryption you do not hold the password for.
      </p>

      <h2>Passwords</h2>
      <p>
        Passwords you enter are used in your browser and never transmitted or recorded. That also
        means they cannot be recovered. If you forget the password on a file you protected, the
        document cannot be opened by us or by anyone else.
      </p>

      <h2>Availability</h2>
      <p>
        The site is static and may be taken offline, moved or changed at any time without notice.
        Because it is a folder of static files under the MIT licence, you can also host your own
        copy.
      </p>
    </Prose>
  );
}

/* -------------------------------------------------------------- Contact */

export function Contact(): JSX.Element {
  useSeo({
    title: 'Contact',
    description: 'How to report a bug, a security issue, or request a format in Convert2Any.',
    path: '/contact',
  });

  const issues = `${SOURCE_URL}/issues`;

  return (
    <section class="section">
      <div class="page page-narrow stack" style="gap:var(--s-8)">
        <SectionHead
          title="Get in touch"
          level={1}
          lead="There is no contact form here, for the same reason there is no upload: a form with no server behind it would only pretend to send. Everything goes through GitHub instead."
        />

        <div class="grid grid-2" style="gap:var(--s-6)">
          <FeatureItem level={2} icon="bolt" title="Bugs and formats">
            A conversion that produced something wrong is worth reporting — especially if you can
            describe the source document. Format requests are welcome too, though anything that
            needs a server will be declined for the reasons on the about page.{' '}
            <a href={issues} rel="noopener">
              Open an issue
            </a>
            .
          </FeatureItem>
          <FeatureItem level={2} icon="shield" title="Security issues">
            Found a way for a file to leave the browser, or a flaw in how encryption is applied?
            Please do not post the details publicly.{' '}
            <a href={issues} rel="noopener">
              Open an issue
            </a>{' '}
            saying you have a security report, and a private channel will be arranged.
          </FeatureItem>
        </div>

        <p class="muted" style="max-width:68ch">
          Before you write, please check the tool's own page. Most surprises are the documented
          fidelity limits — a Word file losing its fonts, or a scanned PDF yielding no text — and
          each of those is explained where it happens.
        </p>
      </div>
    </section>
  );
}
