# From a component to a Flutter widget

How to read a component's `meta.json` and turn it into a widget. The full list is in `component-catalog.md`.

## Read the meta

- **Atoms and molecules** have `props` (typed: `text`, `enum` with `values`, `person`, `icon`), a `template` (the markup with `{{prop}}` placeholders) and the CSS next to it. The CSS is the exact look: sizes, paddings, radii, states (`:hover`, `[data-state="disabled"]`...). Translate every value to a token (the CSS already uses `var(--space-4)` and so on).
- **Organisms, patterns and screens** have `states[]`, each with a `template` where `{{item:id}}` marks where an item goes, `slots` (named areas), `items` (the content: text, or another component and its props) and `overrides` (what changes in that state).

## Mapping

| In the design system | In Flutter |
| --- | --- |
| `props` enum (`variant`, `size`...) | an enum and a constructor parameter, same names and value names |
| `props` text / icon / person | a `String` / an icon asset / a provider model |
| `states` (for a button: hover, pressed, focus, disabled, loading) | the widget state handled by the platform where it exists (pressed, focused, disabled); `loading` as a parameter |
| an organism's `states[]` (Step, Choice, Single CTA...) | an enum parameter on the organism, one build per state |
| `slots` | named `Widget` parameters (`header`, `content`, `action`), not a child list |
| `items` with `type: component` | a field of the type that component maps to |
| `items` with `show: off` or `inputs` toggles | a nullable parameter or a `bool` |
| `data-*` attributes in the CSS | parameters, not widget-tree hacks |
| a component that `uses` others | build the lower component first and compose it. Keep the same tier folders so the dependency rule stays visible |

## What not to build

- Anything in `device/` (status bar, keyboard, numeric keyboard, home indicator, system alert) or the Device UI mode. The operating system draws them.
- Charcoal (`wireframe`) mode.
- The `screens/` are references for how components combine, not widgets to copy. Build the screen the way the app builds screens, using the components.

## The blob and the glow

`atoms/blob` and `atoms/glow` are drawn on a canvas by `tds/behaviors/blob.js` (a bouncing, morphing gradient shape; the glow is its blurred copy). There is no Dart version in the design system yet. Port the drawing as a `CustomPainter` (or a shader), using `blob.js` as the reference for the shape paths, the color cycle and the timing. Ask the engineer whether the app already has a blob implementation before you start. A blob with `data-glow` has a linked glow in the same colors behind it: it must be the same painter state, not a second animation, or the colors drift apart.

## Animation

- Use `TdsMotion` for the preset's duration, curve and delay. Chain with delays, as the cycle art does.
- `draw` is a line drawing itself (path trimmed from 0 to 1), `travel` is move and scale from another place, `scale-in` grows from nothing with a little overshoot.
- Respect reduced motion (`MediaQuery.disableAnimations`): jump to the end state, no delays.

## Icons and images

- Icons are SVGs (`tds/atoms/icon/glyphs/`), drawn in the current text color. Use one color per use, from a role.
- Photos are the therapist images in `tds/assets/images/therapists/`; the faces are in `tds/assets/images/faces/`. Real data replaces both.

## Check your work

Open the component in the editor (`python3 editor/server.py`), put the phone frame next to the app, and compare each state. The Figma link is in the meta.
