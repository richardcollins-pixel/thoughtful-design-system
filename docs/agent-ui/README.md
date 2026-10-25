# The agent's UI: design system and saving

For the session that builds the wireframe prototyping agent. This folder replaces the earlier context note. It has two documents:

1. **`ui-system.md`**: a design system for the agent's own interface, taken from the editor we already built (the tool you use to look at and change the design system). It lists the tokens, the layout, the components and the interaction patterns, with where each one lives in the code, so the agent's UI looks and behaves like the editor and can reuse its CSS.
2. **`saving-to-github.md`**: how the editor saves to GitHub (and to disk when run locally), step by step, with the files and the things that went wrong along the way. The agent's UI needs the same thing: people change things and the changes land in the repo.

## The brief (from the user)

> I want to start a new session to build a wireframe prototyping agent that takes several context inputs including the design system to create wireframes/prototypes that the user can comment and iterate on. It creates 3 directions and then narrows it down.

Nothing else about the agent is decided here: its inputs, its output, how comments work, how it narrows down. The two documents describe what exists, not what the agent should be.

## Where the code is

The design system repo: `/Users/richardcollins/Projects/thoughtful-design-system` (GitHub `richardcollins-pixel/thoughtful-design-system`, deployed from `main` to GitHub Pages).

| What | Where |
| --- | --- |
| The editor (the UI to reuse) | `editor/` (`index.html` loader, `shell.html` layout, `editor.css`, `editor.js`, `github.js`, `server.py`) |
| The design system the canvas shows | `tds/` (`README.md` at the root explains it; `skills/*/references/design-system.md` is the short version) |
| The page that renders one component or screen | `preview/component.html` (and `preview/sheet.html` for the sticker sheets) |
| Reading and rendering the data | `tools/data.js`, `tools/compose.js`, `tools/build-*.js` |
| The deploy | `.github/workflows/pages.yml`, `tools/build_bundle.py` |

To run it: `python3 editor/server.py`, then `http://localhost:5173/editor/`. The published copy is at `https://richardcollins-pixel.github.io/thoughtful-design-system/editor/`.
