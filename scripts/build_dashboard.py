#!/usr/bin/env python3
"""Compatibility entry point for the canonical, full project dashboard.

Update data/current_session.json after each session, then run this command or
node scripts/render-main.mjs. Both preserve server, validation and history tabs.
"""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
subprocess.run(["node", str(root / "scripts/render-main.mjs")], cwd=root, check=True)
