# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A full-stack app that extracts structured metadata and risk flags from contracts. Backend: FastAPI + Claude (Anthropic API). Frontend: React + TypeScript (Vite). Built as a small evening/portfolio project — deliberately scoped, not a production system (see "Known simplifications" below).

## Commands

Setup (one-time):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pnpm install && pnpm --dir frontend install
cp .env.example .env   # then paste ANTHROPIC_API_KEY into .env
```

Run both servers (backend :8000 + frontend :5173) from repo root:

```bash
pnpm start
```

Run separately:

```bash
# backend
.venv/bin/uvicorn app.main:app --reload
# frontend
pnpm --dir frontend dev
```

Offline mode, no API key needed (returns a canned response from `_stub_response` in `app/extractor.py`):

```bash
STUB_MODE=1 uvicorn app.main:app --reload
```

Regenerate frontend types after changing `app/models.py` (this is the required workflow any time backend models change — see Architecture below):

```bash
pnpm gen:types
```

This runs `scripts/export_openapi.py` (dumps FastAPI's OpenAPI schema to `openapi.json`, importing the app with `STUB_MODE=1` so no API key is needed) then `openapi-typescript` to regenerate `frontend/src/generated/api.d.ts`.

Frontend build/typecheck:

```bash
cd frontend
npm run build   # tsc -b && vite build
```

There is no test suite in this repo (no eval suite either — a known, deliberate simplification).

## Architecture

**Pydantic models are the single source of truth for the LLM contract, the API schema, and the frontend types.**

- `app/models.py` defines `ExtractionResult` (and nested `Party`, `RiskFlag`, `RiskLevel`). This is used three ways:
  1. Its `model_json_schema()` is embedded directly into the system prompt sent to Claude (`app/extractor.py::_schema_for_prompt`), so the model is told exactly what shape to return.
  2. FastAPI validates the API request/response against these same models (`app/main.py`).
  3. FastAPI's OpenAPI schema (derived from these models) is exported to `openapi.json` and converted to TypeScript types in `frontend/src/generated/api.d.ts`, re-exported as friendly aliases in `frontend/src/types.ts`.
- **Changing a field on `ExtractionResult` requires running `pnpm gen:types`** afterward, or the frontend types will silently drift from the backend.

**Request flow:**

```
React UI ──POST /extract──> FastAPI ──> Claude (strict JSON prompt) ──> Pydantic validation
                                                                              │
                                                            fail? retry once, feeding the
                                                            validation error back to the model
                                                                              │
                                                                     structured JSON response
```

- `app/extractor.py::extract()` is the core loop: call Claude, try to validate the JSON response against `ExtractionResult`. On `ValidationError`, retry exactly once, appending the validation error text to the prompt so the model can self-correct. The response's `retried: bool` field tells callers whether this happened.
- `_clean_json()` strips markdown code fences the model sometimes adds despite instructions.
- `STUB_MODE=1` swaps `_call_claude` for `_stub_response`, a canned JSON response — used both for manual offline testing and by `scripts/export_openapi.py` (schema export must not require an API key).
- `CLAUDE_MODEL` env var overrides the model (default `claude-sonnet-5`).

**Frontend (`frontend/src/`):**

- `App.tsx` — single-page UI: textarea/file-upload input, "Load sample NDA" button (fetches `samples/sample_nda.txt` served statically), analyze button, and results rendering (parties, metadata grid, risk flag cards).
- `api.ts` — thin fetch wrapper for `POST /extract`; throws on non-OK responses using the FastAPI error `detail`.
- `types.ts` — hand-written aliases over the generated OpenAPI types; don't hand-edit `generated/api.d.ts` itself, regenerate it instead.
- Vite dev server proxies `/extract` and `/health` to `localhost:8000` (see `frontend/vite.config.ts`), so no CORS config is needed in dev.

**Prompting rules baked into `SYSTEM_PROMPT`** (`app/extractor.py`): use `null` for anything not stated in the contract (never guess), risk-flag quotes must be verbatim, and specific risk categories to flag (uncapped liability, non-mutual obligations, auto-renewal, unusually long confidentiality/non-compete periods, broad IP assignment). Keep these in mind when touching prompt or model logic — they encode product intent, not arbitrary choices.

## Known simplifications (deliberate — don't "fix" without asking)

- Plain text input only, no PDF parsing.
- No eval suite.
- No auth or rate limiting.
- Single-document extraction only — no chunking for contracts exceeding the model's context window.
