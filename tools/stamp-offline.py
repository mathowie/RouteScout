#!/usr/bin/env python3
"""Use the current shell bytes as its offline cache revision."""
from hashlib import sha256
from pathlib import Path
import re

dist = Path(__file__).resolve().parent.parent / "dist"
worker = dist / "sw.js"
digest = sha256()
for path in sorted(dist.iterdir()):
    if path.is_file() and path != worker:
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
stamp = digest.hexdigest()[:16]
text = worker.read_text()
updated, matches = re.subn(r"shell-(?:[\da-f]{16}|__ASSET_REVISION__)", f"shell-{stamp}", text)
if matches != 1:
    raise SystemExit("Could not locate the service worker revision.")
if updated != text:
    worker.write_text(updated)
print(f"Offline shell {stamp}")
