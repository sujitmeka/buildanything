"""Shared pytest configuration for lint_parsers tests."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure eval/ is on sys.path so `lint_parsers.*` imports resolve when pytest
# is invoked from the repo root or from eval/.
EVAL_DIR = Path(__file__).resolve().parents[2]
if str(EVAL_DIR) not in sys.path:
    sys.path.insert(0, str(EVAL_DIR))
