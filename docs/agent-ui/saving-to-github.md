# How the editor saves to GitHub

The editor is a static web page. It has no server of its own on the web, and it still saves: it turns what you changed into files and commits them to the repo with the GitHub API from the browser. Locally it writes the same files to disk through a tiny Python server. The deployed site then updates itself from the repo.

## The pieces

| Piece | File | What it does |
| --- | --- | --- |
| The loader | `editor/index.html` | Reads `version.json` (the deploy's commit), then loads the shell, CSS and every module with `?v=<version>` in the URL, so a browser never mixes old and new files after a deploy |
| The UI | `editor/shell.html`, `editor.css`, `editor.js` | The editor itself |
| GitHub client | `editor/github.js` | Saves a set of files as one commit (below), keeps the token and repo settings in the browser |
| Local server | `editor/server.py` | Serves the repo and writes files to disk. No dependencies: `python3 editor/server.py` |
| Generators in the browser | `tools/build-tokens.js`, `build-type.js`, `build-defaults.js` | Turn the edited data into the generated CSS files, in the page, so the web editor needs no build step |
| Deploy | `.github/workflows/pages.yml` | On every push to `main`: check, bundle, stamp the version, publish to GitHub Pages |

## Two modes, chosen automatically

At startup the editor asks `HEAD ../api/tokens`. If the Python server answers, it is in **local** mode; otherwise **github** mode.

- **Local:** autosaves. Token edits go to `PUT /api/tokens` after a 300 ms pause (writes `tokens.json` and the generated `tokens.css`). Component defaults and type styles go with **Save** to `PUT /api/files`, a batch of `{path: text}`. The server only accepts paths under `tds/` that end in `.json` or `.css`, so the editor can't write anywhere else.
- **GitHub:** nothing is written until you press **Commit changes**. The status bar says "Unsaved changes". With no token it is read-only ("Read-only: sign in to commit changes") and shows the published files.

## What a save writes

`changedFiles()` in `editor.js` collects everything that changed as `{path: text}`:

- Tokens changed: `tds/foundations/tokens/tokens.json` and the regenerated `tokens.css` (built in the browser by `buildCss`). `tokens.css` is generated; nobody edits it.
- Type styles changed: `tds/foundations/styles/type.json` and `type.css`.
- Component defaults changed: each component's `meta.json`, plus the regenerated `tds/defaults.css`.

A "dirty" flag tracks each group (`dirtyTokens`, `dirtyType`, `dirtyComps`), and the Commit button is enabled when any is set. After a successful save the flags clear (`markSaved`).

## The commit (`github.js`)

One commit for all the files, using the Git Data API, so a save is a single clean entry in history and the deploy runs once:

1. `GET /repos/{repo}/git/ref/heads/{branch}`: the current head commit.
2. `GET /repos/{repo}/git/commits/{head}`: its tree.
3. For each file, `POST /git/blobs` with the text.
4. `POST /git/trees` with those blobs on top of the base tree.
5. `POST /git/commits` with the message ("Update design tokens and component defaults (...) via editor"), the new tree and the old head as parent.
6. `PATCH /git/refs/heads/{branch}` to move the branch to the new commit.

Reading uses `GET /contents/{path}` with the raw media type, so a signed-in editor loads the latest tokens and type styles from the repo and not the published copy (if that fails, for example with a bad token, it falls back to the published files and says so, so the editor never goes empty).

## Signing in

Press **Sign in**. A fine-grained personal access token for this one repository with **Contents: Read and write** is pasted into a dialog. It is stored only in that browser (`localStorage.tdsGithub`: `{repo, branch, token}`), never in the repo or on a server. The repo is guessed from the Pages URL (`owner.github.io/repo` means `owner/repo`) and the branch defaults to `main`; both can be changed in the dialog.

## From commit to the live site

Pushing to `main` runs `pages.yml`:

1. `python3 tools/check_layers.py` (fails the deploy if a component uses a higher tier).
2. `python3 tools/build_bundle.py --in-place .` compiles the 40-odd stylesheets into one `tds/tds.css` and every component's data into `tds/bundle.json` (in the deploy copy only; the repo keeps the sources). `tools/data.js` uses the bundle when it exists and fetches the separate files when it doesn't, so local editing is unchanged.
3. Stamps `version.json` with the commit and adds `?v=<version>` to the stylesheets.
4. Uploads the repo as the Pages artifact and deploys.

It takes about a minute. One-time setup: repo Settings, Pages, Source: **GitHub Actions**.

## Things that went wrong, and the fixes

- **"I merged it and don't see any updates."** The site was live; the browser (and GitHub's CDN) served cached files for about ten minutes. That is why the loader reads `version.json` with a unique URL and versions every file URL. A hard reload also works. Repos that were moved to another organization are separate sites: check which repo's Pages the URL belongs to.
- **Old CSS in the browser while editing locally.** `server.py` sends `Cache-Control: no-store`; if a page still looks stale, reload with `fetch(url, {cache: 'reload'})`.
- **Editing generated files.** `tokens.css` and `defaults.css` are regenerated on every save; hand edits are overwritten. In the Python code (and any Dart or other consumer) read `tokens.json`.
- **Two generators must agree.** The CSS is generated in the browser by `build-tokens.js`; if you add a token kind, update that file, the editor's `KINDS` and, when working outside the editor, regenerate `tokens.css` to match, or the next editor save will show a diff.
- **Protected branches.** The commit goes straight to the branch. If `main` requires pull requests, the final `PATCH` is rejected: either sign in with a token allowed to push, or point the branch field at a working branch.
- **Rate limits and size.** A commit is a handful of API calls per file; large batches of files are fine but not thousands.
- **The token is the account's.** Use a fine-grained token limited to the one repo and rotate it if it is exposed; it sits in the browser's local storage.

## For the agent's UI

The same approach works for anything the agent's UI needs to persist (comments, chosen directions, generated files): collect the changes as `{path: text}`, show them as unsaved, and commit them in one go with `github.js`'s `commit(files, message)`. Keep a local-server mode for development with the same shape (`PUT /api/files`) and let the page detect which mode it is in. The decisions that remain are what the agent writes, where in the repo, and who may commit.
