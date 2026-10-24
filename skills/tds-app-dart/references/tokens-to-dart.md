# Tokens in Dart

The app gets its tokens from one generated file. This keeps the app and the web from drifting.

## Generate it

```
python3 skills/tds-app-dart/scripts/tokens_to_dart.py <path to tds/> <app>/lib/<where the app keeps its theme>/tds_tokens.dart
```

Run it again whenever `tokens.json` or `type.json` changes. Never edit the output. It analyzes clean with `flutter analyze`.

If the app already has a theme layer (a `ThemeData`, a `ThemeExtension`, a constants file), do not replace it. Generate the file, then wire the generated constants into the existing layer, and tell the engineer what you changed.

## What you get

| Class | What it is | Use it for |
| --- | --- | --- |
| `TdsPalette` | raw colors | only inside the generated file and gradients. Not in widgets |
| `TdsColors.normal` / `TdsColors.inverse` | every color role, for the dark app or for a white card on it. Each role has a `...Inverse` companion | all widget colors. `TdsColors.normal.textSecondary` |
| `TdsMeshGradient` | named mesh gradients (base + three corner glows) | gradient surfaces. Paint the base, then a `RadialGradient` per glow (top right, top left, bottom right). `lightText` says if text on it is white |
| `TdsSize` | padding, spacing, radius, blur (logical px) | every gap, padding, corner radius and blur sigma (CSS blur is twice Flutter's sigma) |
| `TdsOpacity` | dim 20, faint 30, disabled 40, muted 50, soft 60, scrim 70, strong 80 | dimmed, disabled and scrim states |
| `TdsShadow` | shadow 1 to 3 | elevation shadows |
| `TdsGlow` | size, blur, opacity | the soft light behind T or rising from a screen's bottom edge |
| `TdsContainer` | page, card, inset, sheet: padX, padY, gap | the padding of screens, cards and sheets. The page's padX is the 16px screen margin |
| `TdsElevation` | fill + blur + radius + shadow | frosted and raised surfaces (`glass`, `level1` to `level3`) |
| `TdsDuration`, `TdsEasing`, `TdsMotion` | durations, curves, and each preset's timing | every animation. Never type milliseconds or a curve |
| `TdsText` | the text styles (`headline1`, `bodyMd`, `bodyMdSemibold`...) | every piece of text. Do not build a `TextStyle` by hand |

## Rules

- Roles, not primitives. If you need a color that has no role, stop and flag it (see the gap format in SKILL.md). Do not reach for a primitive or a hex.
- The tokens are the only numbers. A padding of 16 is `TdsSize.space4` or `TdsContainer.page.padX`, whichever the design means.
- Fonts: bundle Inter (variable) and PP Editorial New (`tds/assets/fonts/PPEditorialNew-Regular.woff2` is the web file; ask design for the font files the app should ship if the app has none). `TdsText` sets the exact weight with a font variation, so Inter must be the variable font, not static weights. Body text is weight 420.
- Letter spacing in the file is already in logical pixels (the tokens are percentages of the size). Line height is a multiplier.
- The surface switch: wrap a white card's contents so they read `TdsColors.inverse`. Do not hand-pick dark text.
- There is no `layer` in Dart: stacking is widget order. The `layer` tokens (z-index) explain the intended order (sticky header and nav, then the dimmed backdrop, then dialogs, toasts, sheets) so you can match it with `Stack` order.
