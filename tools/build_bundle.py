#!/usr/bin/env python3
"""Compile the design system into two files so a page loads in a handful of requests instead of ~100.

  tds/tds.css      the 40-odd stylesheets that tds.css imports, joined into one (each file keeps its @layer, and the
                   url(...)s inside them are re-pointed so fonts, icons and images still resolve)
  tds/bundle.json  every component's meta plus the personas, environments, sample data and icon list the pages fetch

It rewrites those files IN PLACE, so run it on a copy of the site: the deploy workflow does this just before it publishes
(the repo keeps the separate source files, which is what you edit).

  python3 tools/build_bundle.py --in-place [site_dir]      site_dir defaults to the repo root
"""
import json, os, re, sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if "--in-place" not in sys.argv:
    sys.exit(__doc__)
ROOT = os.path.abspath(args[0] if args else os.path.join(os.path.dirname(__file__), ".."))
TDS = os.path.join(ROOT, "tds")

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

# ---------------------------------------------------------------- css
URL = re.compile(r"url\(\s*(['\"]?)([^)'\"]+)\1\s*\)")
IMPORT = re.compile(r'@import\s+url\(\s*["\']?([^"\')]+)["\']?\s*\)\s*(?:layer\(([\w.-]+)\))?\s*;')

def rebase(css, file_dir):
    """url(x) is relative to the file it is in; in the bundle everything sits in tds/, so point it there instead."""
    def fix(m):
        quote, target = m.group(1), m.group(2).strip()
        if re.match(r"(data:|https?:|//|/|#)", target):
            return m.group(0)
        resolved = os.path.normpath(os.path.join(file_dir, target.split("?")[0]))
        return f"url({quote}{os.path.relpath(resolved, TDS).replace(os.sep, '/')}{quote})"
    return URL.sub(fix, css)

externals, seen = [], set()

def inline(path, layer=None):
    """A stylesheet with its own @imports followed, wrapped in its layer."""
    css = read(path)
    d = os.path.dirname(path)
    def sub(m):
        target, lyr = m.group(1), m.group(2)
        if re.match(r"https?:|//", target):             # e.g. Google Fonts: must stay an @import, and a first one
            if target not in externals: externals.append(target)
            return ""
        return inline(os.path.normpath(os.path.join(d, target.split("?")[0])), lyr)
    css = IMPORT.sub(sub, css)
    css = rebase(css, d)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)       # comments
    css = re.sub(r"\n\s*\n+", "\n", css).strip()
    seen.add(path)
    return f"@layer {layer} {{\n{css}\n}}" if layer else css

top = read(os.path.join(TDS, "tds.css"))
order = re.findall(r"^@layer [^;{]+;", top, flags=re.M)         # the layer-order statement
body = IMPORT.sub(lambda m: "\n" + inline(os.path.normpath(os.path.join(TDS, m.group(1).split("?")[0])), m.group(2)) + "\n", top)
body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
body = re.sub(r"^@layer [^;{]+;\s*", "", body, flags=re.M)      # (re-added first, below)
bundle = "".join(f'@import url("{u}");\n' for u in externals) + "\n".join(order) + "\n" + re.sub(r"\n\s*\n+", "\n", body).strip() + "\n"
with open(os.path.join(TDS, "tds.css"), "w", encoding="utf-8") as f:
    f.write("/* BUNDLE built by tools/build_bundle.py at deploy time. The sources are the separate files in the repo. */\n" + bundle)
print(f"tds.css: {len(seen)} files -> 1 ({len(bundle) // 1024} KB)")

# ---------------------------------------------------------------- data
def load(rel, default=None):
    p = os.path.join(TDS, rel)
    return json.loads(read(p)) if os.path.exists(p) else default

paths = load("index.json")["components"]
metas = {p: load(f"{p}/{p.split('/')[-1]}.meta.json") for p in paths}
glyphs = load("atoms/icon/glyphs.json", {"items": []})
data = {
    "index": paths,
    "metas": metas,
    "personas": load("assets/personas.json", {}),
    "environments": load("environments.json", {}),
    "sample": load("sample-data.json", {"variables": {}}),
    "glyphs": glyphs,
}
with open(os.path.join(TDS, "bundle.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
print(f"bundle.json: {len(paths)} components + personas, environments, sample data, glyphs -> 1 ({os.path.getsize(os.path.join(TDS, 'bundle.json')) // 1024} KB)")
