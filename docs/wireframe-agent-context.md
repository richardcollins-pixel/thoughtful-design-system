# Context for the wireframe prototyping agent session

Written at the end of the design system build session, for a new session that will build a wireframe/prototyping agent. It records what we learned and what exists. **It makes no decisions about the agent.** The brief below is the user's own, quoted; everything else is background.

## The brief (from the user, as given)

> I want to start a new session to build a wireframe prototyping agent that takes several context inputs including the design system to create wireframes/prototypes that the user can comment and iterate on. It creates 3 directions and then narrows it down.

Nothing else about the agent has been decided: its inputs, its output format, how comments work, how it narrows down, where it runs, and what it is built with are all open for the new session to work out with the user.

## Who the user is and how they work

- The user works at Thoughtful (Spring Health) on the design system and the product's design. They work from Figma links, one component or screen at a time, and review in the browser editor.
- They give short, direct corrections ("it should touch 3 sides of the viewport", "the dialog should be vertically centered"). They notice small visual differences against Figma. Verify visually, not just by reading code.
- They prefer the structure to be simple and consistent. Corrections they made that became rules:
  - Keep the model simple: states are the top level of a component, variables (toggles, dropdowns) hold the options, slots are rows with an eye (show/hide) and a link to open the component. No drill-in, no back link.
  - Sections are patterns, patterns go into screens. Text sections are molecules. Bottom sheets are an organism with patterns on top.
  - Device chrome (status bar, keyboard, home indicator, alert) is a separate "device" group, not part of the component tiers, and can be switched off.
  - No scrollbars on screens. The bottom nav clings to the bottom edge with padding.
  - Numbers belong in tokens (layers, opacity, glow, blur, containers), not in components.
  - US spelling everywhere.
- They want to be asked before anything is pushed. All work in the session was committed locally, never pushed, until they say so. Commit messages end with the Co-Authored-By line.
- They share skills in claude.ai (Elizabeth's skills: `system-doc-update`, `update-spec-sheet-post-release`, `elizabeths-voice`, `bug-boss`). Those set the house style for agent instructions: a description that says when to use it; who the user is; numbered steps with a checkpoint where the user corrects the agent before anything is written; "explain back" before acting, with all questions asked at once; rules; exact formats for proposals and close-outs; plain, short language. Read them (ListSkills in claude.ai, or `~/Library/Application Support/Claude/local-agent-mode-sessions/.../skills/`) before designing the agent's instructions.

## The design system

Repo: `/Users/richardcollins/Projects/thoughtful-design-system` (GitHub `richardcollins-pixel/thoughtful-design-system`, deployed from `main` to GitHub Pages; the editor is at `/thoughtful-design-system/editor/`). Plain HTML, CSS and JS. Read `README.md` at the repo root for the detail, and `skills/tds-app-dart/references/design-system.md` for the short version. The component catalog (`skills/*/references/component-catalog.md`) lists every component with props and states.

### What is in it

- **Foundations**: tokens (`tds/foundations/tokens/tokens.json`, generated to `tokens.css`; never hand-edit the CSS), type styles, layout, fonts (Inter variable; PP Editorial New for serif headings), motion presets.
- **Tiers**: atoms, molecules, organisms, patterns, screens, plus a `device` group (the phone's chrome). A component is only built from lower tiers; `python3 tools/check_layers.py` enforces it.
- **Styles** (editor: styles): color (named mesh gradients), type, elevation (fill + blur + radius + shadow), glow, background (page, chat, gradient, backdrop), container (padding and gap of page, card, inset, sheet), motion. Token pages: primitives, roles (base and inverse), padding, spacing, radius, opacity, layer (z-index), type scale, duration, easing.
- **Screens built** (states): splash (2), value prop (10: BLEND and AI only), sign up (14), screener (7), booking (9), tour (6), home (6), chat (8), summary (2, with Close/Back header variable), history (2 incl. empty), profile (6 incl. About, Support, Share feedback, What is Thoughtful?), message (6 incl. not-a-fit). All at 402×874 (iPhone 17, matching the Figma frames).
- **Modes**: Charcoal (`data-fidelity="wireframe"`): accent colors and imagery drop out, gradients flatten to dark; structure, type, radius, spacing and motion stay as designed. **This already exists and is directly relevant to wireframes.** Device UI off hides the phone chrome. Both are switches in the editor toolbar.
- **Personas and sample data**: `tds/assets/personas.json` (providers: Kristina, Marco, Elena, Priya, Daniel, Grace, Naomi, with photo, quote and bio), `tds/sample-data.json`, `tds/environments.json` (per-environment prompt overrides; nothing runs prompts yet).

### How a composed component works (the part an agent would need to read or write)

An organism, pattern or screen is data. Its `meta.json` has:
- `states[]`: each with an HTML `template` containing `{{item:id}}` placeholders, `slots` (id, label, item ids; slots are real `data-slot` elements), and `overrides` (what differs in that state).
- `items{}`: `{type: "text", tag, class, value}` or `{type: "component", component, props, bind, expose, required}`. Dotted props (`row1.text`, `header.title`) configure parts of a nested organism. `props.show: "off"` hides an item.
- `inputs[]`: variables. A `toggle` shows/hides an item; a `select` has options, each with `set: [[item, prop, value], ...]`.
- `personas[]`, `properties[]`, `prompts[]`, `align` ("top" or "bottom" pins it in the preview).

`tools/compose.js` renders it (`renderItem`, `getModel`). `preview/component.html?c=<tier>/<name>` renders one component in a phone-sized page; it exposes `window.tdsComponent` (`setVariant`, `setInput`, `setItem`, `setPersona`, `getModel`, `select`, `setSurface`, `reload`, ...). The editor (`python3 editor/server.py`, then `http://localhost:5173/editor/`) reads and writes the same files, with live editing of text on the canvas (double-click).

## Things we learned the hard way

- CSS layers: `@layer tokens, base, styles, layout, device, atoms, molecules, organisms, patterns, screens, modes`. **Unlayered CSS beats every layer.** The preview page has an unlayered `.single main { ... }` that overrides layered rules on a `<main>`; full-bleed screens use `<section>` instead.
- Gradient tokens already end in a solid color, so `background: var(--gradient-x), var(--y)` is invalid.
- Full-bleed screens cancel the page gutter with `margin: calc(var(--page-gutter) * -1)` and use `min-height: 100dvh`. Sticky bottom navs use `bottom: 0`.
- Browsers cache `tds.css`: reload with `fetch(url, {cache: 'reload'})` when checking changes.
- The preview animation clock only advances when the page draws a frame (screenshots). To inspect an animation moment, pause `document.getAnimations()` and set `currentTime`.
- The blob and its glow: a glow made for a blob must not also be started as an independent glow (it fought the blob over the same canvas and the colors drifted; fixed in `behaviors/blob.js`).
- Text items escape HTML, so inline bold needs split items.
- A molecule cannot use another molecule (copy the markup instead).
- The Figma MCP: `get_metadata` fails on very large canvases (list children with `use_figma` instead); `use_figma` needs the figma-use skill read first; screenshots return a temporary URL to download.
- Figma file keys: Thoughtful Design System `pdq8KcTCIJAtXwcgReiwlC` (pages: Cover, Logos & App Icons, Foundations, Components, Templates, Screens), Session Sharing `2dd93uRGMkAzwfaUu9CcSi`, In-App Feedback `qGPykdv2u1DdzaycmLLaK0`.
- Animation styles exist now: `data-motion` presets (fade-in, enter, pop, scale-in, draw, travel), chained with `--motion-delay`. The cycle art molecule is the worked example of a sequenced animation.

## What exists around it

- `skills/` in the repo: `tds-app-dart` and `tds-web`, skills for engineers applying the design system (app in Flutter/Dart; web for the provider portal and internal tools), plus `skills/build_catalog.py`. A `scripts/tokens_to_dart.py` turns the tokens into a Dart file.
- Known gaps in the design system: no desktop or web layouts, tables, dense forms or breakpoints (it was built from the mobile app's designs); no Dart blob implementation; the tour dots always show five; Instrument Sans (the brand wordmark font) is replaced by the logotype SVG.

## Not decided (for the new session and the user)

The agent's context inputs beyond the design system; the form of the output (HTML, Figma, something else) and where it runs; how a person comments and how the agent reads those comments; what "3 directions" differ by; how directions are narrowed; whether it reuses the design system's components, Charcoal mode or the editor; and how it fits with the existing skills. Ask the user rather than assume.
