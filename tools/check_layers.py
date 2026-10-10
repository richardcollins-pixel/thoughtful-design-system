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
    for item_id, item in (meta.get("items") or {}).items():   # a composed organism may only place what it declares in "uses"
        comp = item.get("component")
        if comp and comp not in meta.get("uses", []):
            print(f"{path}: item '{item_id}' places {comp}, which is not in uses"); bad += 1
    for state in (meta.get("states", []) if meta.get("items") else []):
        for slot in state.get("slots", []):
            for item_id in slot["items"]:
                if item_id not in (meta.get("items") or {}):
                    print(f"{path}: state '{state['id']}' lists unknown item '{item_id}'"); bad += 1
    state_ids = {st["id"] for st in (meta.get("states", []) if meta.get("items") else [])}
    for prompt in meta.get("prompts", []):
        for item_id in prompt["outputs"]:
            if item_id not in (meta.get("items") or {}):
                print(f"{path}: prompt '{prompt['id']}' outputs unknown item '{item_id}'"); bad += 1
        for st in prompt.get("states", []):
            if st not in state_ids:
                print(f"{path}: prompt '{prompt['id']}' names unknown state '{st}'"); bad += 1
    personas = json.load(open(os.path.join(ROOT, "tds/assets/personas.json")))
    for role in meta.get("personas", []):
        if role not in personas:
            print(f"{path}: persona role '{role}' has no entry in personas.json"); bad += 1
    for used in meta.get("uses", []):
        if used not in index:
            print(f"{path}: uses unknown component '{used}'"); bad += 1
        elif ORDER.index(used.split("/")[0]) >= ORDER.index(tier):
            print(f"{path}: a {tier[:-1]} may not use {used} (same or higher level)"); bad += 1
print("layers OK" if not bad else f"{bad} problem(s)")
sys.exit(1 if bad else 0)
