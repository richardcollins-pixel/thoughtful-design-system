# Using the design system's CSS on the web

The design system is plain HTML, CSS and a little JS. The web (the provider portal and the internal tools) uses it directly. Nothing needs translating.

## Loading it

- `tds/tds.css` is the entry point. It declares the layer order and imports everything: `@layer tokens, base, styles, layout, device, atoms, molecules, organisms, patterns, screens, modes;`. The deployed copy is one compiled file with every component's CSS in it. Ask the engineer where the web app gets it (a published URL, or a vendored copy of `tds/`), and use the same one everywhere.
- The `device` and `screens` layers are for the mobile app's chrome and screens. A web page does not use them.
- Fonts: `tds/foundations/fonts.css` loads Inter and defines PP Editorial New (a licensed font; the file is in `tds/assets/fonts/`).
- Behaviors (JS): `tds/behaviors/blob.js` finds every `.blob` and `.glow` on the page and animates them; include it once and only on pages that have a blob. `tds/behaviors/carousel.js` is for carousels (`data-carousel`).
- `data-fidelity="wireframe"` on `<html>` is the Charcoal mode (accent colors and pictures out). It is a design tool, not for production.

## Layers: where your own CSS goes

Design system CSS is in layers. Unlayered CSS beats every layer, so your own rules would win over the design system by accident, including over its tokens. Put the app's own CSS in a layer that comes after: `@layer app { ... }`. It then wins over the design system on purpose, and only where you meant it.

Do not write `main { display:flex }`-style element rules outside a layer on a page that uses design system screens or sections. They override layered rules and break them.

## Markup

- Each atom and molecule's `meta.json` has a `markup` (or `template` with `{{props}}`). Copy the markup. Variants are `data-*` attributes: `<button class="button" data-variant="filled" data-size="lg">`.
- Icons: `<i class="icon icon-chevron-right"></i>`. The color is the text color (or `--icon-color`).
- Organisms and patterns are composed from templates: read the state's `template`, replace each `{{item:id}}` with the item (a text element, or the other component's markup) and keep the `data-slot` wrappers.
- Surfaces: `data-surface="inverse"` on a container flips the roles for everything inside it.
- Full-bleed things cancel the page gutter with `margin-inline: calc(var(--page-gutter) * -1)`.

## Tokens in your CSS

Use the CSS variables, never the numbers:

- Color: roles (`var(--text-primary)`, `var(--bg-elevation-10)`, `var(--border-secondary)`), not primitives.
- Size: `--space-*`, `--padding-*`, `--radius-*`, `--blur-*`, `--shadow-*`.
- Type: the classes `.text-headline-1`, `.text-body-md` and so on, or `font: var(--text-body-md); letter-spacing: var(--text-body-md-ls)`.
- Styles: `.elevation-1` to `.elevation-3` and `.elevation-glass`; `.background-page`, `.background-backdrop`; `--container-page-x` and the other container variables; `--glow-screen-size` and the other glow variables.
- Motion: `data-motion="enter"` (also `fade-in`, `pop`, `scale-in`, `draw`, `travel`); chain with `--motion-delay`; `--duration-*` and `--ease-*` for your own transitions.
- Opacity and stacking: `--opacity-*` and `--layer-*` instead of numbers.

## What the design system does not have for the web yet

The design system was built from the mobile app's designs. For the provider portal and internal tools it has the foundations (tokens, type, color, motion) and the atoms, molecules and organisms, but **no desktop layouts, tables, filters, dense forms, navigation shells or breakpoints**. When a page needs one, do not invent a style. Build it from the tokens and the closest components, keep it small, and flag it (the gap format in SKILL.md) so design can decide whether it becomes part of the system.
