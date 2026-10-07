#!/usr/bin/env python3
"""Enforce the layer rule: a component may only use components from LOWER levels.
atoms < molecules < organisms < patterns.   Run:  python3 tools/check_layers.py"""
import json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ORDER = ["atoms", "molecules", "organisms", "patterns"]
index = json.load(open(os.path.join(ROOT, "tds/index.json")))["components"]
bad = 0
for path in index:
    meta = json.load(open(os.path.join(ROOT, "tds", path, os.path.basename(path) + ".meta.json")))
    tier = path.split("/")[0]
    if meta.get("tier") != tier:
        print(f"{path}: meta tier is '{meta.get('tier')}', folder says '{tier}'"); bad += 1
    for used in meta.get("uses", []):
        if used not in index:
            print(f"{path}: uses unknown component '{used}'"); bad += 1
        elif ORDER.index(used.split("/")[0]) >= ORDER.index(tier):
            print(f"{path}: a {tier[:-1]} may not use {used} (same or higher level)"); bad += 1
print("layers OK" if not bad else f"{bad} problem(s)")
sys.exit(1 if bad else 0)
