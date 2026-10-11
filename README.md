# Thoughtful Design System

HTML, CSS and JS design system, plus (later) an editor in `editor/`.

```
tds/
  foundations/  tokens · styles · layout utilities · base
  atoms/        single elements: button, icon (+ its glyphs), icon button
  molecules/    a few atoms with one job: form field, list row, toast, search field
  organisms/    self-contained sections: therapist card, app header, tab bar, chat thread
  patterns/     page layouts with slots
  assets/       images, graphics, videos
  modes/        wireframe
  tds.css       declares @layer order and imports everything
  index.json    lists every component for the editor
preview/        the page the editor's canvas renders each component on
```

Screens are not part of this system; they use all of it.

Layer order: `tokens, base, styles, layout, atoms, molecules, organisms, patterns, modes`.
A layer may only use layers before it, so an atom never uses a molecule. Components consume **roles**
(not primitives), so `data-fidelity="wireframe"` (accent colors and imagery out, gradients flatten, the base surfaces stay) and
`data-surface="inverse"` work
without per-component code. The system is dark-only for now; roles have a `base` and an `inverse` value.

## Editor

The canvas is full-screen; the nav, toolbar and properties panels float on top. **⌘\\** (Ctrl+\\) hides or shows them.

Two ways to run it. Both read/write `tds/foundations/tokens/tokens.json` and generate `tokens.css`
in the browser (`tools/build-tokens.js`) — don't hand-edit `tokens.css`.

**On the web (GitHub Pages)** — `https://richardcollins-pixel.github.io/thoughtful-design-system/editor/`
Open it read-only, or click *Sign in* and paste a fine-grained GitHub token with *Contents: read & write*
on this repo (stored only in your browser). *Commit changes* saves everything as one commit; Pages
redeploys in about a minute. The canvas updates live before you commit.

**Locally** — autosaves to disk, no token needed (Python 3, no dependencies):

```
python3 editor/server.py      # http://localhost:5173/editor/   
```

## Editing a component

Select a component to see it on the canvas. Atoms and molecules show every variant at once; organisms and
patterns show a single instance, and the panel on the right switches its variant, properties and surface
(variable changes there are previews). **Edit Component** switches the panel to edit mode: the variable
values you set become that component's **defaults**, saved in its `meta.json` (`"defaults"`) and in the
generated `tds/defaults.css` (`tools/build-defaults.js`). Locally *Save* writes the files; on the web *Commit
changes* commits them. Token pages keep the same save bar at the bottom of the panel.

## Adding a component

1. Create `tds/<level>/<name>/` (level = `atoms`, `molecules`, `organisms` or `patterns`) with
   `<name>.css` and `<name>.meta.json` (copy the button's as a template; set `"tier"` to the level).
2. Import the CSS in `tds/tds.css` under the same layer name.
3. Add `"<level>/<name>"` to `tds/index.json`.

4. List what it's built from in `"uses"` in its meta, then run `python3 tools/check_layers.py`: a component may only
   use components from lower levels (atoms < molecules < organisms < patterns).

The editor's right panel is driven by optional fields in the meta:
`description` (how to use it), `examples` (named variants whose content differs; otherwise the first enum
attribute's values are the variants), `content` (text fields the panel can edit: label + CSS selector),
`backgroundVar` / `backgroundDefault` (the variable the gradient chips set) and `selector` (the CSS class
that saved defaults attach to, if it isn't the first class in `markup`).

It then appears in the editor nav under that level; the canvas renders it from its `meta.json`
(markup, attributes, states, variables).

## Composed organisms

An organism is data, not hand-written markup. Its `meta.json` holds:

- `states[]` — the states it can be in (e.g. Booked, No appointment, Provider CTA). Each has an HTML `template` with
  `{{item:id}}` placeholders, its `slots` (id, label, item ids — the card uses Header, Content and CTA) and optional
  `overrides` (copy specific to that state). Atoms use `states` for hover/pressed/…; an organism is recognised by `items`.
- `items{}` — what fills the slots: `{ "type": "text", tag, class, value }` (text may use `{{variables}}`) or
  `{ "type": "component", component, props, bind, expose }`. `bind` ties a prop to a persona.
- `personas[]` — roles the organism uses, e.g. `["provider"]`. People live in `tds/assets/personas.json` (providers now,
  users later); the chosen one fills the avatar and `{{provider-name}}`, `{{provider-specialty}}`.
- `properties[]` — token-bound controls: `gradients` (chips) or `scale` (a radius/padding token scale). `"edit": true`
  keeps one out of the everyday panel.
- `prompts[]` — see below.

An atom or molecule opts in by declaring `props` (type `text`, `enum`, `person` or `icon`) and a `template` with
`{{prop}}` placeholders. `tools/compose.js` renders the HTML for the canvas and the model the right panel is built from.

**Everyday panel vs edit mode.** The everyday panel shows only content: Provider, State, Background and each slot's text.
Structure (icons, elevation, sizes, radius, padding, adding components or slots) is reserved for edit mode. A component
can opt into a Surface (normal/inverse) option with `"surface": true`; cards don't, coachmarks will.

**Selecting elements.** On the canvas, every item inside an organism can be hovered and selected, Figma-style: a blue
outline on hover, handles, a name tag and a size pill on select. Selecting opens that element's own controls (its
content and every prop) in the right panel. Clicking the card itself, the page, the empty canvas, the "back" link or
pressing Escape returns to the organism's panel. A state can list the persona roles it uses (`states[].personas`);
a state with none (the provider CTA, where no provider is chosen yet) hides that picker. Rendered items carry
`data-item="<id>"`, which is what the canvas selects.

**Prompts.** The icon beside a text field connects it to a prompt. A prompt produces a *group* of fields together
(a Recent Topic card's headline and body), so it lists `outputs` (item ids) and `inputs` (e.g. `provider`, `state`), and
may be limited to some `states`. A prompt set on the organism is the design-system default; `tds/environments.json`
(`production`, `dev`, `sandbox`) holds per-environment overrides. Nothing runs prompts yet; this is the structure.

## Assets and icons

- **Images, graphics, videos** live in `tds/assets/` (`images/<group>/`, `graphics/`, `videos/`); the editor's
  **assets** nav browses them. Images are plain `<img>`; wireframe mode flattens them.
- **Icons** are an atom: the glyph SVGs live in `tds/atoms/icon/glyphs/` and the icon's canvas page shows them all.
  Use `<i class="icon icon-check"></i>` (name = file name, lowercased, without `Name=`). They're drawn as masks,
  so they take the current text color — roles, inverse surfaces and wireframe mode all apply.

After adding or removing files in either place, regenerate the manifests and icon classes (static hosting
can't scan folders):

```
python3 tools/build_assets.py   # writes assets/index.json, atoms/icon/glyphs.json and atoms/icon/icons.css
```

## Deploys and caching

GitHub Pages lets browsers and its CDN cache files for ~10 minutes, so right after a deploy a page could
load with a stylesheet from the previous version. To prevent that, `editor/index.html` is a tiny loader that
reads `version.json` (fetched with a unique URL) and loads the editor's files with that version in their URLs.

- `.github/workflows/pages.yml` deploys on every push to `main` and writes `version.json` (the commit) and
  stamps the preview pages' stylesheet URLs. Setup, once: **Settings → Pages → Source: GitHub Actions**.
- Locally there is no `version.json`, so the loader falls back to a fresh timestamp each load.
- Keep `editor/index.html` small and stable; everything it loads is versioned.
