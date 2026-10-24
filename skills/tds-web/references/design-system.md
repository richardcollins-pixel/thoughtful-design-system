# The Thoughtful Design System (tds): how it is organized

Read this first. It is the same for the app and the web.

## Where things live

Everything is in `tds/` in the design system repo. The files below are the source of truth. Never copy values out of a screenshot when a file has them.

| What | Where |
| --- | --- |
| Tokens (colors, spacing, radius, blur, shadow, opacity, layers, glow, containers, elevation, motion, type scale) | `tds/foundations/tokens/tokens.json`. `tokens.css` is generated from it; do not hand-edit |
| Text styles (Headline 1 to Body XS) | `tds/foundations/styles/type.json` |
| Each component | `tds/<tier>/<name>/<name>.meta.json` (what it is, props, states, markup or template, items and slots) and `<name>.css` |
| The list of components | `tds/index.json`, and `references/component-catalog.md` in this skill |
| Icons | `tds/atoms/icon/glyphs/*.svg` |
| Images, faces, therapist photos | `tds/assets/` |
| Fonts | Inter (variable) and PP Editorial New (`tds/assets/fonts/`, licensed) |
| The blob (T) and glow | `tds/behaviors/blob.js` is the reference drawing code |
| Everything else, and why | `README.md` at the repo root |

The design system also has an editor and a preview (`editor/`, `preview/`): `python3 editor/server.py` then open `http://localhost:5173/editor/` to see every component, state and token. Use it to look at what you are building.

## Tiers

A component may only be built from components in tiers above it:

1. **atoms**: one element (button, icon button, text field, checkbox, blob, glow, dots...)
2. **molecules**: a few atoms with one job (header, bottom nav, toast, option tile...)
3. **organisms**: a self-contained section (coachmark, bottom sheet, header card, chat thread...)
4. **patterns**: a section made of organisms (provider carousel, topics section, session sharing sheet...)
5. **screens**: whole mobile app screens (home, chat, profile...). For reference when building the app; not for the web
6. **device**: the phone's own chrome (status bar, keyboard, home indicator, system alert). Drawn so screens look right in the preview. **Never build these.** The operating system draws them

Organisms, patterns and screens are data, not hand-written markup: `meta.json` has `states` (each with a `template`, `slots` and optional `overrides`), `items` (text, or other components with `props`), and sometimes `inputs` (variables such as a toggle that shows or hides an item). Read the `template` to see the layout and the `items` to see what fills it.

## Tokens: the rules

- Use **roles**, never primitives. Roles are named for the job (`bg-base`, `text-secondary`, `border-primary`, `status-error-primary`); primitives are raw colors (`purple-900`).
- Every role has a base value and an inverse value. The app is dark. A white card on it (the coachmark) uses the inverse surface.
- The styles built from tokens: **type**, **gradient** (named mesh gradients), **elevation** (fill + background blur + corner radius + shadow), **glow**, **background** (page, chat, gradient, backdrop), **container** (padding and gap of the page, a card, an inset card, a sheet), **motion** (duration + easing + delay per animation).
- Opacity, stacking order (layers) and blur are tokens too. Do not type a number where a token exists.
- Spelling is US English everywhere (color, center, behavior).

## Modes

- **Charcoal** (`data-fidelity="wireframe"`): the accent colors and pictures drop out and gradients flatten to dark. It is a design tool, not an app feature.
- **Device UI** off hides the phone chrome in the preview. Not an app feature.

## Animation

Named presets (fade in, enter, pop, scale in, draw, travel), each a duration, an easing and a delay from the motion tokens. They can be chained with delays. The cycle art molecule is the example: T starts large in the middle and travels left, the top arrow draws, the person circle and then its photo or icon and then its badge pop in, the lower arrow draws back to T. With reduced motion everything jumps to its end state.

## Figma

The file is "Thoughtful Design System" (`pdq8KcTCIJAtXwcgReiwlC`). Each component's meta has a `figma` link to its node. Foundations, Components, Templates and Screens are pages in it.
