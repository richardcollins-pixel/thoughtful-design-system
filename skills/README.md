# Skills for applying the design system

Two skills that tell an engineer's agent how to use the Thoughtful Design System (`tds`) without drifting from it. They are written to the same shape as the product team's other skills (system-doc-update, update-spec-sheet-post-release): a short description that says when to use it, who the user is, the steps with a checkpoint where the user corrects you before anything is built, rules, and the formats to answer in.

| Skill | For | Folder |
| --- | --- | --- |
| `tds-app-dart` | the mobile app (Flutter, Dart) | `skills/tds-app-dart/` |
| `tds-web` | the provider portal and internal tools | `skills/tds-web/` |

Each has `SKILL.md`, and `references/` with `design-system.md` (how the design system is organized) and `component-catalog.md` (every component, props and states). The app skill also has `scripts/tokens_to_dart.py`, which turns the tokens into a Dart file.

## Keeping them current

After the design system changes, run:

```
python3 skills/build_catalog.py
```

It rewrites `component-catalog.md` in both skills from every component's `meta.json`. The Dart tokens file is regenerated in the app with `tokens_to_dart.py`; `tokens.json` is the only place token values live.

## Installing

A skill is a folder with a `SKILL.md`. Give the folder to the agent the engineer uses (for Claude Code, copy it into the project's or the user's `.claude/skills/`), and it triggers from the description. Start a task with the Figma link and the path to `tds/`.
