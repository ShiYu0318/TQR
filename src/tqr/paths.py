"""Repository paths, so scripts give the same result from any working directory.

Requires an editable install (`pip install -e .`), which keeps this file inside the repository.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "src" / "js"                          # tri_core.js, qr_tables.json
DATA = ROOT / "experiments" / "data"              # *.json, *.npy produced by experiments
FIGURES = ROOT / "experiments" / "figures"        # experiment screenshots and renders
MODELS = ROOT / "models"                          # printable STL files
