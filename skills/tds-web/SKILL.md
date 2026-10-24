---
name: "tds-web"
description: Build or update a web page, component or style in Thoughtful's web products (the provider portal and internal tools) so it matches the Thoughtful Design System (tds), by reading the design system's tokens, CSS and component meta, explaining the plan back, and building from tokens and design system markup only. Use this skill whenever an engineer is implementing or changing web UI for Thoughtful: a Figma link or page to build, "apply the design system", "use the tokens in CSS", "which component should I use", "style this like the app", "add the new style or animation", or when the design system changed and a web page needs to follow, even if they don't say "design system".
---

# Apply the design system on the web (provider portal, internal tools)

Thoughtful has one design system, `tds`. It is plain HTML, CSS and a little JS, so the web uses it directly: the same tokens and the same components as the app. This skill is how to apply it on the web so every page looks and moves like Thoughtful, and so the web and the app never drift.

The user is an engineer. They know the web app's code; you don't yet. The workflow below checks what the web app already has before building, and gives them a chance to correct you before anything is written.

Read `references/design-system.md` first (how the design system is organized, the tiers, the token rules). Read `references/using-the-css.md` before step 4. `references/component-catalog.md` lists every component with its props and states.

## Workflow

### 1. Confirm inputs

Ask for what you don't have yet:

- **What to build or change:** a Figma link, a page or component name, or a design system change the web should follow. Required.
- **Where the design system is:** the path to the `tds/` folder, or where its CSS is published. Required.
- **Which product:** the provider portal or which internal tool, and the repo path.

Don't start reading until you have these.

### 2. Read both sides

- **The design system:** the `meta.json` and CSS of each component the page needs, the tokens involved, and the Figma node. Start in `references/component-catalog.md` to find what exists.
- **The web app:** how it loads styles today, its framework and component conventions, what UI it already has for the pieces involved, and where its CSS lives.

Note where the design and the app disagree, what the app already has that is close, and anything the design needs that the design system doesn't have. The design system came from the mobile app: for web-specific needs (tables, dense forms, desktop layouts, navigation shells, breakpoints) it often has nothing. Don't resolve this yourself. Collect it for step 3.

### 3. Explain back

Send one message with three short parts:

1. **What you'll build,** in a few lines: the page or component, its states, how it behaves.
2. **How it maps.** Which design system components and markup you'll use (with their tier), which tokens and styles for anything custom, which of the web app's existing pieces you'll keep or replace, and where the files go.
3. **Questions, all at once.** Every gap and disagreement from step 2, using the gap format below.

Wait for the engineer's answers. Their corrections here are the most valuable input in the whole process.

### 4. Set up, once per project

If the web app doesn't load the design system yet, load it as `references/using-the-css.md` says: the CSS entry point, the fonts, the behaviors it needs, and the app's own CSS in a layer after the design system's. Show the engineer the change before moving on.

### 5. Build, lowest tier first

Use the design system's components before writing CSS. For each piece:

1. Use an existing component's markup if one fits. Variants are `data-*` attributes; don't restyle it.
2. For anything custom, write CSS in the app's layer using tokens only.
3. Build every state the component's meta lists, plus loading, empty and error where the page needs them. The design system has skeleton loading built in.
4. Keep the markup semantic and accessible: real buttons and links, labels on form fields, focus states, reduced motion respected.

### 6. Check against the design

Open the component in the design system editor (`python3 editor/server.py`, then the editor in a browser) and compare it to the page: spacing, type, color, corner radius, animation, each state. Fix differences. If you can't tell, say what you compared and what is left.

### 7. Close out

Summarize in one message: what was built (a table of pieces and where each comes from), the tokens or styles used, anything flagged to design, and anything still open. Then stop.

## Rules

These come from how the design system is made. They apply to everything you build.

- **Tokens only.** No hex color, no pixel number for spacing, radius or blur, no duration, no z-index number, no opacity number. If the token you need doesn't exist, that is a gap, not a license to invent one.
- **Roles, not primitives.** `var(--text-secondary)`, not `var(--purple-300)`.
- **Components before CSS.** If a component exists for it, use it. Don't copy its CSS into a new class.
- **Your CSS goes in your own layer, after the design system's.** Never unlayered.
- **Don't use the mobile-only parts.** `device/` (status bar, keyboard, home indicator, system alert) and `screens/` are for the app and the editor, not for web pages.
- **The design system wins.** If the Figma and the design system disagree, ask. Don't pick one.
- **Never edit the design system from the web app.** If a token or component is wrong or missing, flag it. Design changes it in the editor.
- **Don't invent web patterns.** Tables, filters, dense forms, navigation shells and breakpoints aren't in the system yet. Build the smallest thing from tokens and flag it.
- **US spelling** in code, copy and comments (color, center, behavior).

## Gap format

Use this whenever the design needs something the design system or the web app doesn't have.

```
**Gap: <short name>**
Where: <page or component, state>
Needs: <the value or behavior the design wants>
Closest in the design system: <token or component, or "nothing">
Suggestion: <what you would do, in one line>
```

## Close-out format

```
| Piece | From | Result |
| --- | --- | --- |
| Primary button | atoms/button | Used as is |
| Filter bar | custom (tokens only) | Built, flagged |
| ... | | |

**Tokens and styles used:** <list>
**Flagged to design:** <gaps, with where they came up>
**Still open:** <anything not confirmed>
```
