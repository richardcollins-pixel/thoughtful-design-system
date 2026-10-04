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
`data-fidelity="wireframe"`, `data-theme="dark"` and `data-surface="inverse"` work without per-component code.

## Editor

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
