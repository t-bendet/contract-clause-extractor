"""Export the FastAPI app's OpenAPI schema to openapi.json.

FastAPI derives this schema from the Pydantic models, so the generated
TypeScript types (see `pnpm gen:types`) share a single source of truth
with the backend: app/models.py.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("STUB_MODE", "1")  # importing the app must not need an API key

from app.main import app  # noqa: E402

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "openapi.json")
with open(out_path, "w") as f:
    json.dump(app.openapi(), f, indent=2)

print(f"Wrote {out_path}")
