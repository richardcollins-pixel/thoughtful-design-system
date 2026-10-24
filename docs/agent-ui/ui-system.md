# The editor's UI system (to base the agent's UI on)

The editor has its own look, separate from the design system it edits. The design system (`tds`) is dark, rounded and branded; the editor's chrome is light, quiet and neutral so that the design on the canvas is the hero. The agent's UI can use the same system: a light chrome around a canvas that shows work built from `tds`.

All of this is in `editor/editor.css` (about 340 lines). The class names below are the real ones.

## Principles

- **The design is the hero.** The canvas fills the screen. Everything else floats on it, flush to the edges, translucent. ⌘\ hides all of it.
- **Quiet chrome.** 12px type, one accent color, hairline borders, no heavy shadows, almost no color outside the canvas.
- **One accent.** Purple `#7a4de8` means selected or focused. Blue `#0d99ff` means "this is what you are pointing at on the canvas" (hover and selection outlines), as in Figma.
- **Direct manipulation.** Hover and click things on the canvas; the panel follows. Double-click text to edit it where it is. The panel and the canvas stay in step in both directions.
- **Previews are real.** Thumbnails in the panel are live iframes of the real page, scaled down, not screenshots.

## Tokens

```css
:root {
  --ink: #111114;            /* text, dark buttons, active switch */
  --mute: #8a8a92;           /* secondary text, labels, icons */
  --line: rgb(0 0 0 / .08);  /* every hairline border */
  --chip: rgb(0 0 0 / .045); /* field and chip fill, hover fill */
  --accent: #7a4de8;         /* selected, focused */
  --glass: rgb(255 255 255 / .82);  /* floating surfaces */
  --nav-w: 208px; --panel-w: 288px; --bar-h: 40px;
  font-family: Inter, system-ui, sans-serif; font-size: 12px; line-height: 1.4;
}
```

| Token | Value | Used for |
| --- | --- | --- |
| Page | `#ececef` with a 22px dot grid (`radial-gradient(circle, rgb(0 0 0 / .1) 1px, transparent 1.2px)`) | the canvas background behind the device |
| Sheet fill | `rgb(250 250 252 / .86)` | the token and asset pages |
| Selected row | `rgb(122 77 232 / .1)` | nav and table row selection |
| Hover row | `rgb(0 0 0 / .03)` to `var(--chip)` | rows, nav items |
| Canvas selection | `#0d99ff` | hover and selected outlines, handles, name tag, size pill (drawn by `preview/component.html`) |
| Slot highlight | `#f0479b` (pink) | a slot on the canvas (items are blue, slots pink) |
| Error | `#c0392b` | status and field errors |
| Radius | 7px (nav items, steps), 8px (fields, buttons), 9-11px (tiles, thumbnails), 16px (dialog) | |
| Type | 11px labels and status (`--mute`), 12px body, 13px page title, 15px component title (600, -0.01em) | |
| Glass | `backdrop-filter: blur(24px) saturate(1.5)` | `.float` |
| Motion | 0.18s opacity, 0.22s transform, 0.22s section fold | all UI transitions; honors reduced motion |

## Layout shell (`editor/shell.html`)

```
.app (fixed, full screen, dot-grid page)
  .stage          the canvas: a device frame (#frame, 402x874 rounded 44px for phones) holding an iframe (#screen)
  nav.float       left, 208px: the tree (tokens, styles, atoms ... screens), levels and leaves
  .float.top      top bar, left-aligned over the canvas: the device picker and width x height
  .modes          Device UI and Charcoal switches, vertically centered at the canvas' right edge
  main.sheet      the middle, for token and asset pages (tables); hidden when a component is on the canvas
  aside.panel     right, 288px: the properties panel (#panel-body) and the save bar (.savebar)
  .hint           "⌘\ shows the interface"
  dialog#dlg      the GitHub sign-in dialog
```

Canvas behavior: the device frame is scaled to fit the free area between nav and panel (`#frame` transform), with a 0.24s ease when sizes change. Device presets (iPhone 17 402x874, iPhone 17 Pro Max 440x956, iPhone SE 375x667, Pixel 9 412x915, iPad mini 744x1133, Desktop 1280x800) are in `editor.js` (`const DEVICES`). Sticker sheets (atoms, molecules) fill the area with no device (`#frame.fill`).

## Components

| Component | Class | Notes |
| --- | --- | --- |
| Floating surface | `.float` | translucent, blurred, hides with ⌘\ (`.app[data-ui="off"]`) |
| Nav | `.nav`, `.row`, `.row.level`, `.row.leaf`, `.row.active` | one level open at a time; leaves are `/name` |
| Button | `.btn`, `.btn.dark`, `.btn.sm`, `.btn.wide`, `.link` | 24px tall; dark = primary |
| Switch | `.switch` (checkbox + `<i>`) | 26x16, dark when on |
| Field | `.field` (label above, input below) | 28px, `--chip` fill, accent border on focus |
| Step picker | `.steps` / `.step` / `.step.sel` | the chosen step shows its label; the others are dots |
| Dropdown with preview | `.dd`, `.dd-btn`, `.dd-menu`, `.dd-opt` | thumbnails inside (provider photos, icons) |
| Text field with a variable button | `.inwrap`, `.aibtn`, `.aimenu` | the small icon beside a text field opens a menu |
| Chip and swatch | `.chip`, `.sw`, `.chip-bg`, `.gradsw` | color chips with transparency checkerboard |
| Table | `table`, `tr.item`, `tr.group`, `td.name` | sticky header, selectable rows, specimen cells |
| Section bar | `.secbar` | a title and an "+ Add" button above a table |
| Thumbnail tile | `.thumbs`, `.thumb-tile`, `.thumb-frame` | live iframe scaled to the tile; selected = accent ring |
| Panel section | `.cp-sec`, `.cp-sec-head`, `.cp-sec-body` | folds like a blind (0fr to 1fr grid rows) |
| Panel row | `.prow`, `.plabel`, `.pctl` | label left, control right |
| Variable or slot row | `.irow`, `.irow-head`, `.irow-tools`, `.irow.off`, `.irow.sel` | label, an open-component button, an eye (show/hide); hidden rows dim to 40%; selected shows a blue bar |
| Breadcrumb | `.crumb-path` | path to what is selected |
| Status and save bar | `.savebar`, `.status`, `.status.err` | status text, GitHub, Commit changes or Save, Discard |
| Dialog | `dialog`, `.dlg`, `.dlg-actions` | 400px, 16px radius, blurred backdrop |
| Hint | `.hint` | a dark pill that fades in and out |
| Specimens | `.blurbg`, `.elspec`, `.glowbg`, `.bgspec`, `.ctnspec`, `.layerbar`, `.dot-track` | tiny live previews for each kind of token |

Canvas overlay (in `preview/component.html`, not the editor CSS): `#sel-layer` draws the hover and selected boxes (1px `#0d99ff`), 7px white corner handles, a name tag above the box and a size pill below it.

## Interaction patterns

- **Hover and select on the canvas.** Items outline in blue, slots in pink. Click selects; the panel shows that thing's own controls with a breadcrumb back up. Option-click selects the item's slot. Esc clears.
- **The panel drives the canvas and the canvas drives the panel.** Hovering a panel row previews the thing on the canvas. Editing in place on the canvas (double-click) updates the panel field live, and Enter or clicking away finishes, Esc cancels.
- **States as thumbnails.** A component's states are a grid of live thumbnails; the selected one has an accent ring. Variables (toggles, dropdowns, steps) sit under it.
- **Preview versus save.** Changes in the panel are previews until saved as defaults (edit mode). Token pages autosave locally and commit explicitly on the web.
- **Modes as switches.** Device UI and Charcoal are page-level switches that restyle the canvas without touching the work.
- **Postmessage between panel and canvas.** The canvas page (`preview/component.html`) exposes `window.tdsComponent` (`setVariant`, `setInput`, `setItem`, `select`, `hover`, `getModel`, `reload`, ...) and posts `tds-edit` messages back to the editor.

## What the editor does not have (and the agent UI will need to decide)

Comments or annotations on the canvas, multiple options shown side by side, a history of versions, narrowing from many to few, a chat or prompt area, sharing, and multi-user state. None of these exist in the editor's UI today; they are new components for the agent's UI. Build them from the tokens and patterns above so they match.

## Reusing it

- Copy `editor/editor.css` and `shell.html` as the starting point; the CSS has no dependencies except Inter (loaded from `tds/foundations/fonts.css`).
- Keep the canvas content in an iframe so the work being shown is isolated from the chrome (the editor's iframe loads `preview/component.html`; the agent's would load whatever it generates, with `tds/tds.css`).
- Keep the two worlds separate on purpose: the chrome uses the editor's tokens above; anything inside the canvas uses the design system's tokens.
