---
name: "tds-app-dart"
description: Build or update a screen, component or style in Thoughtful's Flutter (Dart) app so it matches the Thoughtful Design System (tds), by reading the design system's tokens and the component's meta, explaining the plan back, and then building it from tokens only. Use this skill whenever an engineer is implementing or changing UI in the mobile app: a Figma link or screen name to build, "apply the design system", "use the tokens in Dart", "build the <component> widget", "add the new style/animation", or when the design system changed and the app needs to follow, even if they don't say "design system".
---

# Apply the design system in the app (Flutter)

Thoughtful has one design system, `tds`. It is the source of truth for how the app looks and moves. This skill is how to apply it in the Flutter app so the app matches the design, and so the app and the web never drift: every color, size and animation comes from a token, not from a screenshot.

The user is an engineer. They know the app's code; you don't yet. The workflow below checks what the app already has before building, and gives them a chance to correct you before anything is written.

Read `references/design-system.md` first (how the design system is organized, the tiers, the token rules). Read `references/tokens-to-dart.md` before step 4 and `references/components-to-widgets.md` before step 5. `references/component-catalog.md` lists every component with its props and states.

## Workflow

### 1. Confirm inputs

Ask for what you don't have yet:

- **What to build or change:** a Figma link, a screen or component name, or a design system change the app should follow. Required.
- **Where the design system is:** the path to the `tds/` folder (or a checkout of the design system repo). Required.
- **Where the app is:** the repo path. If you are already in it, say so.

Don't start reading until you have these.

### 2. Read both sides

- **The design system:** the `meta.json` of the component or screen (its `props`, `states`, `template`, `items`, `slots`), its CSS, and the tokens it uses. For a screen, read the states and which organisms and patterns it is made of.
- **The app:** how it does theme and tokens today, where widgets live, how screens are built, which widgets already exist for the pieces involved, and how it handles fonts, icons and animation. Search before assuming something is missing.

Note where the design and the app disagree, where the app already has something close, and anything the design needs that the design system doesn't have. Don't resolve these yourself. Collect them for step 3.

### 3. Explain back

Send one message with three short parts:

1. **What you'll build,** in a few lines: the screen or component, its states, how it behaves.
2. **How it maps.** Which tokens and styles it uses; which existing widgets it reuses; which new widgets it needs, by tier (atom, molecule, organism, pattern, screen); where the files go.
3. **Questions, all at once.** Every gap and disagreement from step 2, using the gap format below.

Wait for the engineer's answers. Their corrections here are the most valuable input in the whole process.

### 4. Tokens

If the app has no generated tokens file yet, or the design system's tokens changed, generate it as `references/tokens-to-dart.md` says and wire it into the app's existing theme layer. Do not duplicate values by hand. Show the engineer the diff before moving on.

### 5. Build, lowest tier first

Build atoms before molecules, molecules before organisms, and so on. For each piece:

1. Reuse an existing widget if one fits. Extend it only if the design needs a prop or state it lacks.
2. Name props and states the way the meta does, so the design and the code use the same words.
3. Take every color, size, radius, blur, opacity, text style and animation from the tokens.
4. Build every state the meta lists, and the loading state if the design has one.
5. Run `flutter analyze` and fix what it finds.

### 6. Check against the design

Open the component in the design system editor (`python3 editor/server.py`, then the editor in a browser) and compare each state to the app: spacing, type, color, corner radius, animation. Fix differences. If you still can't tell, say what you compared and what is left.

### 7. Close out

Summarize in one message: what was built (a table of pieces and their tier), the tokens added or changed, anything flagged to design, and anything still open. Then stop.

## Rules

These come from how the design system is made. They apply to everything you build.

- **Tokens only.** No hex color, no pixel number, no duration, no curve and no `TextStyle` written by hand. If the token you need doesn't exist, that is a gap, not a license to invent one.
- **Roles, not primitives.** Colors come from `TdsColors`, not from `TdsPalette`.
- **Mirror the tiers.** A widget uses only widgets from lower tiers. Keep the folders by tier so this stays visible.
- **Never build the device parts.** Status bar, keyboard, home indicator and system alerts belong to the operating system.
- **What the design system says wins.** If the Figma and the design system disagree, ask. Don't pick one.
- **Never edit the design system from the app.** If a token or component is wrong or missing, flag it. Design changes it in the editor and the app picks it up by regenerating the tokens file.
- **Don't copy a `screens/` entry.** Screens show how components combine. Build the screen the app's way.
- **Accessibility is part of the component.** Real tap targets, semantic labels on icon-only buttons, reduced motion respected, text that scales.
- **US spelling** in code, copy and comments (color, center, behavior).

## Gap format

Use this whenever the design needs something the design system or the app doesn't have.

```
**Gap: <short name>**
Where: <screen or component, state>
Needs: <the value or behavior the design wants>
Closest in the design system: <token or component, or "nothing">
Suggestion: <what you would do, in one line>
```

## Close-out format

```
| Piece | Tier | Result |
| --- | --- | --- |
| TdsButton | atom | Built (filled, outline, glass, flat; disabled, loading) |
| ... | | |

**Tokens:** <added or changed, or "none">
**Flagged to design:** <gaps, with where they came up>
**Still open:** <anything not confirmed>
```
