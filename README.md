# Thoughtful Design System

HTML, CSS and JS design system, plus (later) an editor in `editor/`.

```
tds/
  foundations/  tokens · styles · layout · base
  components/   parts · blocks · sections
  templates/ · screens/ · modes/
  tds.css       declares @layer order and imports everything
preview/        plain page for eyeballing the system
```

Layer order: `tokens, base, styles, layout, parts, blocks, sections, templates, screens, modes`.
A layer may only use layers before it. Components consume **roles** (not primitives), so
`data-fidelity="wireframe"` (color + imagery out) and `data-surface="inverse"` work without per-component code.
The system is dark-only for now; roles have a `base` and an `inverse` value.

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
python3 editor/server.py      # http://localhost:5173/editor/   (preview page at /preview/)
```

## Adding a component

1. Create `tds/components/<tier>/<name>/` with `<name>.css` and `<name>.meta.json` (copy the button's as a template).
2. Import the CSS in `tds/tds.css` under its tier layer (`parts`, `blocks` or `sections`).
3. Add `"<tier>/<name>"` to `tds/components/index.json`.

It then appears in the editor nav under components; the canvas renders it from its `meta.json`
(markup, attributes, states, variables).

## Libraries

Shared assets live in `tds/libraries/`: `icons/`, `images/<group>/` (e.g. `images/therapists/`),
`graphics/`, `videos/`. The editor's **libraries** nav browses them.

After adding or removing files, regenerate the manifest and icon classes (static hosting can't scan folders):

```
python3 tools/build_libraries.py     # writes libraries/index.json and libraries/icons.css
```

Icons are used as `<i class="icon icon-check"></i>` (name = file name, lowercased, without `Name=`).
They're drawn as masks, so they take the current text color — roles, inverse surfaces and
wireframe mode all apply. Images are plain `<img>`; wireframe mode flattens them.

## Deploys and caching

GitHub Pages lets browsers and its CDN cache files for ~10 minutes, so right after a deploy a page could
load with a stylesheet from the previous version. To prevent that, `editor/index.html` is a tiny loader that
reads `version.json` (fetched with a unique URL) and loads the editor's files with that version in their URLs.

- `.github/workflows/pages.yml` deploys on every push to `main` and writes `version.json` (the commit) and
  stamps the preview pages' stylesheet URLs. Setup, once: **Settings → Pages → Source: GitHub Actions**.
- Locally there is no `version.json`, so the loader falls back to a fresh timestamp each load.
- Keep `editor/index.html` small and stable; everything it loads is versioned.
