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

It then appears in the editor nav under that level; the canvas renders it from its `meta.json`
(markup, attributes, states, variables).

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
