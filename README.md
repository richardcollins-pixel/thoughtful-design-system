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

```
python3 editor/server.py      # http://localhost:5173/editor/   (preview page at /preview/)
```

Tokens live in `tds/foundations/tokens/tokens.json`. The editor saves to it and regenerates
`tokens.css` (via `tools/build_tokens.py`). Don't hand-edit `tokens.css`. No dependencies beyond Python 3.
