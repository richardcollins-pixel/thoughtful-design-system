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
a state with none (the provider CTA, where no provider is chosen yet) hides that picker.

Slots are real elements: a state's `template` wraps each slot's items in `data-slot="<slot id>"` (the validator checks every
listed slot has one), and rendered items carry `data-item="<id>"`. The canvas outlines items in blue and slots in pink.
Click an item to select it, click anywhere else inside a slot (the gaps) to select the slot, or Option-click an item to
select its slot. The panel shows the path (`Appointment card › Header slot › Headline`) so you can step back up; a
selected slot lists its content fields and the items inside it. The row layout is a CSS grid with the header slot as a
sub-grid, which keeps the avatar-beside-text arrangement while the slots stay whole elements.

In the organism's own panel each slot is a row (`Header slot · 3 fields ›`) that drills in: hovering it previews the slot on the
canvas, clicking it selects the slot (same as clicking it on the canvas), and the panel narrows to just that slot.

**Prompts.** The icon beside a text field connects it to a prompt. A prompt produces a *group* of fields together
(a Recent Topic card's headline and body), so it lists `outputs` (item ids) and `inputs` (e.g. `provider`, `state`), and
may be limited to some `states`. A prompt set on the organism is the design-system default; `tds/environments.json`
(`production`, `dev`, `sandbox`) holds per-environment overrides. Nothing runs prompts yet; this is the structure.

Double-click text on the canvas to edit it in place; the panel's field follows as you type (and the canvas follows the panel). While editing, `{{variables}}` are shown raw; Enter or clicking away finishes, Escape cancels. Each slot's section in the panel lists its components (avatar, button, date…) as rows that open their own variables.

The **provider bio card** (`organisms/provider-bio-card`, from the Figma Provider Card) is the second composed organism: photo, name, quote and bio, in Focused and Unfocused (dimmed) states for a carousel. Providers now carry a `quote` and `bio` (`assets/personas.json`), available as `{{provider-quote}}` and `{{provider-bio}}`. It uses the new **photo** atom (rectangular, crops to a height; the avatar is the round one).

The **session cards** (Figma "Session Cards"): `organisms/session-card` has three states (Medium, Large, New topic) and ends in the **chat input** molecule (the "Start session" pill); `patterns/topics-section` is the first pattern: the homepage section (subhead, copy, then cards) with states Start, 1 recent topic and 2+ recent topics. Patterns are composed like organisms, and can place whole organisms as items (an organism item exposes its state and its text).

**Carousels** are one shared piece: mark a row `data-carousel` and it bleeds to the screen edges (cancelling `--page-gutter`), locks onto one item per swipe (scroll snap), and fades the items continuously as you scroll: the one in focus is fully opaque, the others `--carousel-min-opacity` (50%). The look is `foundations/styles/carousel.css`; `behaviors/carousel.js` (include once) sets each item's `--carousel-focus` and finds carousels added later.

The **header cards** (Figma "Header Cards"): `organisms/header-card` (Default and Provider states) opens a screen: it runs to the screen edges, bottom corners rounded, content centered at the bottom. A component can set `"align": "top"` in its meta so the canvas pins it to the top of the frame instead of centering it. The header card has the **header** molecule (`molecules/header`: status bar, back/close button, title, step dots, action; six variants) in a Top slot over its padding, built from the new **status bar** and **dots** atoms. `organisms/header-inset-card` is the inset one (Figma's Profile and Secondary types are identical, so one card).

More cards from Figma: `session-history-card` (Default, With image), `cta-card`, `end-of-session-card` and `resource-card`. They follow the same shape as the other organisms (slots, skeletons, nested component rows).

The provider set: `patterns/provider-carousel` (five provider bio cards in the shared carousel, each with its own provider, and progress dots under it that follow the card in focus: put a `[data-carousel-dots]` after a carousel and its `.dots` is kept in step). Figma's Provider Card loading and Post-Appointment Skeleton are covered by the skeleton system rather than separate cards: every organism has a loading state that holds its loaded height.

The Background property depends on the state: gradient states offer the gradients, and a state that is flat in the real UI (`"flatStates": [...]` on the property: the Error state, the Provider header, the provider bio card, the resource card) shows just its flat fill. A property can also be limited to some states with `"states": [...]`.

The appointment card also has an **Error** state (Couldn't load, with Retry) for when it fails to load; it is not a separate card.

## The bite size support section (home screen)

`atoms/face` (one of ten faces on an orange tile; the SVGs are in `assets/images/faces`), `molecules/tile` (a face, a title, a duration and a round arrow; the whole row is one button), `organisms/bite-size-columns` (two columns of five tiles in the shared carousel, a little narrower than the row so the next column peeks in at the edge) and `patterns/bite-size-support-section` (the subhead, the line of copy and the columns). The other home sections (your topics, deep dives, your therapist) will each be their own pattern. A nested card exposes its own text, including the text of the components inside it (a button's label, a duration) as "item.prop".

## Sticker sheets

Atoms and molecules are one page each in the editor: click `atoms` or `molecules` in the nav and every element of that level is listed on a single full-width sheet (`preview/sheet.html`), each with all of its variants. They sit on the page itself, not in a phone. The panel lists the elements; click one (or its title on the sheet) to open it on its own, with its properties and edit mode, and `‹ atoms` takes you back. Organisms and patterns still show one instance in a device frame.

## Blob and glow

`atoms/blob` is the animated gradient shape that is T, and `atoms/glow` is its blurred copy. `behaviors/blob.js` draws both (it finds `.blob` and `.glow` on the page, now or later, and keeps them in sync with their attributes; one animation loop drives every instance and pauses the ones off screen). The blob bounces slowly, its outline morphs slowly, its colors travel round the edge, and the theme shifts every 5 seconds (`data-theme` is the theme it starts on: cool, warm, rose, ember or bloom; `data-cycle="off"` stops the shifting). `data-loop="pencil"` (or `envelope`, `bubble`, `chat`) runs a looping morph with the prototypes' timings; `data-loop-delay="2500"` (milliseconds) holds the first morph back, so several can start one after another. In special cases it morphs into another shape: `data-shape` is `blob` (the default), `pencil`, `bubble`, `envelope` or `chat`; change the attribute and it morphs (shapes reach each other through the plain blob). Ported from the loading and intro prototypes: the blob, pencil and bubble are drawn one way (with the small bloblets that break off during a morph) and the envelope and chat another (traced outlines with a flap and dot that detach); one blob hands over between the two. The glow is usually alone near the bottom of a screen (`data-placement="bottom"`, its own color cycle); with `data-for="<blob id>"` and `data-placement="behind"` it is that blob's own blurred copy. Charcoal makes both gray, and reduced motion draws a still frame. The engine loads only on pages that contain a blob or glow.

## Text color on gradients, and inverse

Every gradient token says which text color is compliant over it (`foreground`: light or dark; set in the editor under styles > color, the "Text on it" field). Today only orange-to-light-rose takes dark text. When a gradient is picked as a card's background, the card gets `data-foreground="dark"` where needed, which flips only the text, icon and border colors to their inverse values (fills such as a filled button's white, and pieces like the chat input, stay as they are) (Charcoal flattens every fill to a dark one, so it keeps light text). The background picker shows each gradient with an "Aa" in its text color, so a non-compliant pairing (dark text on purple-to-blue) can't be chosen. "Inverse" is not a light mode: the sticker sheets show the "on inverse surface" row only for components that set `"inverse": true` in their meta (coachmarks, when they exist; no component sets it yet).

## Fast loading

A page used to make about 95 requests (42 stylesheets, 30 component files, images, fonts), and every state thumbnail repeated them. So the deploy compiles up front: `.github/workflows/pages.yml` runs `tools/build_bundle.py`, which joins the stylesheets into one `tds/tds.css` (each file keeps its layer, and its `url(...)`s are re-pointed) and every component's meta plus the personas, environments, sample data and icon list into one `tds/bundle.json`, in the deployed copy only. A page is then about 20 requests and the editor about 18. The pages read data through `tools/data.js`: it uses the bundle when there is one and falls back to the separate files, so running `editor/server.py` locally is unchanged and edits show immediately. After editing, the published site shows the change once the next deploy has built the bundle. To try the bundle locally, copy the repo somewhere, run `python3 tools/build_bundle.py --in-place <copy>` and serve the copy.

## Type styles

`tds/foundations/styles/type.json` is the list of text styles (from the Figma text styles): Headline 1, Headline 2, Subhead, Body Large / Medium / Small / XS, with semibold variants and Body Medium Italic. Each one bundles five tokens (font, weight, size, line height, letter spacing). `type.css` is generated from it (`tools/build-type.js`, in the editor under styles > type) into `--text-<style>` and `--text-<style>-ls` custom properties plus a `.text-<style>` class. **Components never spell out their own font values**: they use `font: var(--text-body-md); letter-spacing: var(--text-body-md-ls);`, so editing a style in the editor changes it everywhere it is used. The only exceptions are device chrome (the status bar's time and the editor's selection labels).

## Loading states

One shimmer serves the whole system: `tds/foundations/styles/skeleton.css`; the **skeleton atom** (`atoms/skeleton`: a line, dot or pill, always fully rounded) draws it, and the **skeleton-text molecule** (`molecules/skeleton-text`) is a multi-line placeholder whose lines take the height of the surrounding text and follow `--skeleton-align` (speed is the `duration-shimmer` token; it stops under reduced motion and follows the surface color, so Charcoal needs nothing extra).

- **Atoms** that can load have a `loading` state (`data-state="loading"`): avatar and icon button shimmer in place of their content.
- **Components** declare a `skeleton` template in their meta (what they look like inside a loading slot).
- **Slots** opt in with `"skeleton": true`. While loading, each text item becomes shimmering lines (as many as its copy is expected to need) and each component item uses its skeleton, so the card keeps its size and nothing jumps when content arrives. Slots without it (e.g. the CTA) stay as they are.
- Skeleton lines are pills. An item can say `"skeleton": { "lines": n }` or `"skeleton": false` (left out while loading), so a skeleton stays simple: in the appointment card an avatar, a one-line headline and two lines of copy. The canvas measures the loaded card and gives each skeleton slot the same height (content centered in it), so nothing shifts when it loads.
- The State section of the organism panel has a reload button (left of its chevron) that plays the loading state, then shows the content (`tdsComponent.setLoading(on)` / `.reload()` on the canvas page).

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


Sticker sheets follow the Figma "Mockups" layout: each component is a `/name` heading with its description, then rounded tiles (a subheading above each group, a caption under each tile). A component with `"gallery": "examples"` designs its own tiles in its meta (`.st-tile`, `.st-tiles`, `.st-hero`, `.st-phones`, `.st-cap` (prefixed so they never collide with components such as the tile molecule); `data-controls` marks where its controls go, and a control can name its own `target` and `col`umn). Spelling is American throughout (color, center, behavior).

The **home header** (Figma "home header"): `organisms/home-header` is the top of the home screen: the header molecule's new Home variant (status bar and a Feedback action), T with a rose glow behind it, a headline and copy, and the chat input's new Large variant (the tall "Say anything..." box). It runs to the screen edges and opens at the top of the canvas.

The **chat** (Figma "chat-text"): `screens/chat` is a whole chat screen (a screen, built from organisms) with these states: Recommendations (the conversation, two options to choose from, OR, Save for later) Typing (the conversation, the input and the keyboard up), Session and Session typing (with the timer) and End of session (the last message and the end of session card). It opens scrolled to the newest message. The header is the new **chat header** molecule (T and the session name, a progress bar under the name when the timer is on, an optional person-check icon for when the therapist can see a recap, and a check to finish; the icons are at half strength until the timer is on. Session and Session, typing are the states with the timer). The rest are new molecules: **chat message** (T in plain text, you in a bubble), **fork option card** (5 or 10 min square, title, reason; one button) and **keyboard** (a picture of the dark phone keyboard); the chat input gained an Empty variant (prompt at half strength) and the icon set a person-check glyph.

## Structure: tiers and device UI

Tokens and styles at the bottom, then **atoms → molecules → organisms → patterns → screens**: each tier is built only from tiers below it (`tools/check_layers.py` enforces it, and the CSS layers follow the same order). Organisms are one thing with a job (a card, the chat thread, the chat composer, the home header); **patterns** are sections that arrange organisms (topics, providers, bite size support); **screens** are whole screens (chat) made of a header, patterns and organisms. The **device** tier (status bar, keyboard) is the phone's own chrome, drawn so screens look right; it sits under everything. The **Device UI** switch at the top right of the canvas (next to Charcoal; the device tier has no nav entry), or `<html data-device-ui="off">`, hides it, for prototypes opened on a real phone; components that leave room for the status bar give it back.
