#!/usr/bin/env python3
"""Dev server: serves the repo and saves tokens. No dependencies.  python3 editor/server.py"""
import json, os, sys, mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import build_tokens as bt

mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")


def valid(data):
    toks = data.get("tokens") if isinstance(data, dict) else None
    if not isinstance(toks, list):
        return "tokens must be a list"
    names = set()
    for t in toks:
        if not isinstance(t, dict) or not isinstance(t.get("kind"), str) or not isinstance(t.get("name"), str):
            return "every token needs kind and name"
        if t["name"] in names:
            return "duplicate name: " + t["name"]
        names.add(t["name"])
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/tokens":
            with open(bt.TOKENS_PATH) as f:
                return self._json(200, json.load(f))
        if path == "/api/schema":
            return self._json(200, bt.load_schema())
        if path == "/":
            self.send_response(302); self.send_header("Location", "/editor/"); self.end_headers(); return
        return super().do_GET()

    def do_PUT(self):
        if self.path.split("?")[0] != "/api/tokens":
            return self._json(404, {"error": "not found"})
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            err = valid(data)
            if err:
                return self._json(400, {"error": err})
            bt.write_all(data)
        except Exception as e:  # noqa
            return self._json(400, {"error": str(e)})
        self._json(200, {"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5173))
    print("editor: http://localhost:%d/editor/" % port)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
