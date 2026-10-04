#!/usr/bin/env python3
"""tokens.json -> tokens.css. Run directly or imported by editor/server.py."""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TOKENS_PATH = os.path.join(ROOT, "tds/foundations/tokens/tokens.json")
CSS_PATH = os.path.join(ROOT, "tds/foundations/tokens/tokens.css")
SCHEMA_PATH = os.path.join(ROOT, "tools/token-schema.json")


def load_schema():
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def fmt(n):
    n = float(n)
    return str(int(n)) if n == int(n) else ("%.4f" % n).rstrip("0").rstrip(".")


def role_value(token, mode):
    v = token["values"][mode]
    ref = "var(--%s)" % v["ref"]
    op = float(v.get("opacity", 100))
    return ref if op >= 100 else "color-mix(in srgb, %s %s%%, transparent)" % (ref, fmt(op))


def build_css(data, schema=None):
    schema = schema or load_schema()
    stacks = {f["key"]: f["stack"] for f in schema["fontFamilies"]}
    toks = data["tokens"]
    of = lambda kind: [t for t in toks if t["kind"] == kind]
    out = ["/* GENERATED from tokens.json by tools/build_tokens.py — edit in the editor, not here. */\n"]

    def block(selector, lines):
        out.append("%s {\n%s\n}\n" % (selector, "\n".join("  " + l for l in lines)))

    block(":root", ["--%s: %s;" % (t["name"], t["hex"]) for t in of("primitive")])

    roles = of("role")
    pal = []
    for t in roles:
        l, d = role_value(t, "light"), role_value(t, "dark")
        pal.append("--t-%s: light-dark(%s, %s);" % (t["name"], l, d))
        pal.append("--t-%s-i: light-dark(%s, %s);" % (t["name"], d, l))
    block(":root", pal)

    block(':root, [data-surface="normal"]',
          sum([["--%s: var(--t-%s);" % (t["name"], t["name"]),
                "--%s-inverse: var(--t-%s-i);" % (t["name"], t["name"])] for t in roles], []))
    block('[data-surface="inverse"]',
          sum([["--%s: var(--t-%s-i);" % (t["name"], t["name"]),
                "--%s-inverse: var(--t-%s);" % (t["name"], t["name"])] for t in roles], []))
    out.append(':root, [data-theme="light"] { color-scheme: light; }\n[data-theme="dark"] { color-scheme: dark; }\n')

    lines = []
    for k in ("padding", "spacing", "radius"):
        lines += ["--%s: %spx;" % (t["name"], fmt(t["px"])) for t in of(k)]
    block(":root", lines)

    lines = ["--%s: %s;" % (t["name"], stacks.get(t["value"], t["value"])) for t in of("font-family")]
    lines += ["--%s: %s;" % (t["name"], fmt(t["value"])) for t in of("font-weight")]
    lines += ["--%s: %srem;" % (t["name"], fmt(float(t["px"]) / 16)) for t in of("font-size")]
    lines += ["--%s: %s;" % (t["name"], fmt(float(t["percent"]) / 100)) for t in of("line-height")]
    lines += ["--%s: %sem;" % (t["name"], fmt(float(t["percent"]) / 100)) for t in of("letter-spacing")]
    block(":root", lines)

    lines = ["--%s: %sms;" % (t["name"], fmt(t["ms"])) for t in of("duration")]
    lines += ["--%s: cubic-bezier(%s);" % (t["name"], ", ".join(fmt(x) for x in t["bezier"])) for t in of("easing")]
    block(":root", lines)
    out.append("@media (prefers-reduced-motion: reduce) {\n  :root { %s }\n}\n" %
               " ".join("--%s: 0.01ms;" % t["name"] for t in of("duration")))
    return "\n".join(out)


def write_all(data):
    css = build_css(data)
    with open(TOKENS_PATH, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    with open(CSS_PATH, "w") as f:
        f.write(css)


if __name__ == "__main__":
    with open(TOKENS_PATH) as f:
        write_all(json.load(f))
    print("wrote", CSS_PATH)
