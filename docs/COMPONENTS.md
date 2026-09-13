# Components

Every component in `src/components/`, what it is for, its props, and the decisions worth knowing
before changing it.

---

## `Layout` — `components/Layout.tsx`

The site shell: skip link, sticky nav, page slot, footer. Wraps every route.

| Prop | Type | Notes |
| --- | --- | --- |
| `children` | `ComponentChildren` | The routed page |

- The mobile menu closes on navigation by comparing the current path against the last rendered
  one, so a tap that changes route never leaves the panel covering the page.
- The nav panel is toggled with an `.open` class, **not** the `hidden` attribute. `hidden` applies
  at every width and would hide the links on desktop too.
- Footer tool links are read from the catalog, so they cannot drift from the real toolset.

---

## `Converter` — `components/Converter.tsx`

The conversion surface. Owns the job queue, runs the worker engine, and renders results.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tool` | `Tool` | — | Omit for **quick mode** (home page); pass for **tool mode** |
| `options` | `ToolOptions` | `{}` | Collected by `ToolForm`; ignored in quick mode |
| `disabled` | `boolean` | `false` | Blocks running while the tool form is invalid |
| `allowEmpty` | `boolean` | `false` | Lets a tool run with no file (pasted HTML) |

**Two modes.** In quick mode each file gets its own output picker, and dropping several PDFs also
offers a single merge job. In tool mode the output kind and options come from the tool's form and
the picker disappears.

**Why refs, not state.** `File` handles and result `Blob`s live in refs: they are neither
serialisable nor comparable, and keeping them out of reducer state avoids pointless re-renders.
Queue state itself lives in the pure reducer in `state/queue.ts`.

**Same-frame correctness.** Preact batches events, so a user can change a picker and hit Convert
within one frame. Picker choices are therefore recorded synchronously into a ref, and `runAll`
reads the queue, quality and options through refs — render timing must never decide what bytes
are produced.

**Labels follow the form, not the queue.** In tool mode the run uses the *current* options, so the
displayed output label is derived from those too. Using the kind stored when the file was added
showed stale labels (e.g. "Rotate 90°" on a job that correctly produced a 180° file).

---

## `Dropzone` — `components/Dropzone.tsx`

File intake by click, keyboard or drag-and-drop.

| Prop | Type | Default |
| --- | --- | --- |
| `onFiles` | `(files: File[]) => void` | required |
| `accept` | `string` | required |
| `multiple` | `boolean` | `true` |
| `title` / `hint` | `string` | generic copy |
| `disabled` | `boolean` | `false` |

- It is a real `<button>`, not a div with a click handler — so it is focusable, announced as a
  control, and activated by Enter/Space with no hand-rolled key handling.
- Drag state uses a depth counter, because drag events fire per child element and a naive
  enter/leave toggle flickers.
- The hidden `<input>` is reset after every pick so selecting the same file twice still fires
  `change`.

---

## `ToolForm` — `components/ToolForm.tsx`

Renders a tool's option fields from its catalog definition.

| Prop | Type |
| --- | --- |
| `tool` | `Tool` |
| `values` | `Record<string, string>` |
| `errors` | `Record<string, string>` |
| `onChange` | `(name: string, value: string) => void` |

This is the only place that knows how a field *type* becomes a control, so adding an option to a
tool is a data change in the catalog, never a JSX change here.

Accessibility: every control has a `<label for>`; help text and error text are linked through
`aria-describedby`, and invalid fields carry `aria-invalid`. Textareas span the full grid width so
long markup is comfortable to edit.

---

## `Icon` — `components/Icon.tsx`

Flat, line-based icon set drawn as inline SVG on a 24×24 grid.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | `IconName` | required | Key into the path table |
| `size` | `number` | `20` | |
| `class` | `string` | — | |
| `label` | `string` | — | Omit for decorative icons |

Inline rather than an icon font or sprite: icons inherit `currentColor`, add no network request,
and there is no flash of unstyled glyphs. Without a `label` the icon is `aria-hidden`, so
decorative icons are not read out as noise.

---

## UI primitives — `components/ui.tsx`

Thin wrappers over the classes in `styles/components.css`. Deliberately thin: the CSS stays
readable in devtools while class names stop being retyped across twenty pages.

### `Button`
Extends the intrinsic `<button>` attribute set (**not** `JSX.HTMLAttributes`, which omits
element-specific props like `disabled` and `type`), minus `size` and `icon`, which the component
reuses for its own API.

`variant`: `primary | secondary | ghost` · `size`: `sm | md` · `icon`: `IconName` · `block`

`type="button"` is the default but is overridable, since `...rest` spreads after it.

### `Card`
`variant`: `default | soft | flat | float`. `float` is the elevated hero/tool card.

### `Chip` / `ChipList`
Small format tags. `accent` switches to the highlighted treatment.

### `FidelityBadge`
Takes `level: Fidelity` and renders the tier with its explanation as a tooltip. Shown on every
tool card and tool page so the trade-off is visible *before* a file is chosen.

### `SectionHead`
`eyebrow`, `title`, `lead`, `center`, and **`level: 1 | 2`** (default `2`).

`level` exists because every page needs exactly one `<h1>`; defaulting silently to `h2` had left
seven pages without one.

### `FeatureItem`
`icon`, `title`, `children`, and **`level: 2 | 3`** (default `3`).

Same reasoning: these cards sit under a section heading on most pages (so `h3` is right) but
directly under the page title on `/security`, where `h3` would skip a level.

### `Notice`, `Stat`, `Accordion`
`Notice` takes `tone: accent | error` and sets `role="alert"` when it is an error. `Accordion`
is a native `<details>`/`<summary>`, so it works without JavaScript.

---

## Pages — `src/pages/`

| Page | Route | Notes |
| --- | --- | --- |
| `Home` | `/` | Hero + floating dropzone, format catalog, tool grid, features, stats |
| `Tools` | `/tools` | Full catalog grouped by category, with a fidelity key |
| `ToolPage` | `/tools/:slug` | One component rendering all 19 tools from the catalog |
| `Pricing` | `/pricing` | Free tier + Pro waitlist (stored locally; the page says so) |
| `Security` | `/security` | How the no-upload architecture works and how to verify it |
| `Static` | `/about`, `/privacy`, `/terms`, `/contact` | Shared prose layout |
| `NotFound` | fallback | Offers the tool list rather than a dead end |

`ToolPage` keys its inner view on the slug so switching between tool routes resets form state
instead of carrying one tool's values into another. Form state is raw strings (what the DOM
gives us) and is coerced to typed options in exactly one place, `tools/options.ts`.

---

## Adding a tool

1. Add an entry to `TOOLS` in `src/tools/catalog.ts` — slug, copy, category, icon, accepted
   extensions, fidelity, fields, and `toKind()`.
2. Add the pipeline function it needs and wire the new `tool` value in `pipeline/convert.ts`.
3. Add naming for it in `pipeline/registry.ts` (`PDF_TOOL_SUFFIX` or `DOC_TOOL_EXT`).

The grid, the route, the page, the sitemap and the footer all pick it up automatically.
`catalog.test.ts` will fail if the entry is malformed — duplicate slug, unknown extension,
missing caveat on a non-exact tool, or a select whose initial value is not one of its choices.
