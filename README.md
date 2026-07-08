# Contract Clause Extractor

A full-stack app that extracts structured metadata and risk flags from
contracts. Backend: FastAPI + Claude, with LLM output validated by Pydantic
models (the Python equivalent of Zod schemas). Frontend: React + TypeScript
(Vite), with types mirroring the Pydantic models on the other side of the wire.

Built in an evening with Claude Code as a hands-on exercise in the
FastAPI / Pydantic / LLM stack.

## How it works

```
React UI (paste / upload) ──> POST /extract ──> Claude (strict JSON prompt)
                                        │
                              Pydantic validation
                                        │
                     fail? ──> retry once, feeding the
                               validation error back to the model
                                        │
                              structured JSON response
```

Design notes:

- **Pydantic as the LLM contract.** The JSON schema sent to the model is
  generated from the same Pydantic models that validate the response —
  one source of truth (`app/models.py`).
- **Self-correcting retry.** If validation fails, the validation error is fed
  back to the model for one retry. The response reports `retried: true` so
  callers can monitor how often this happens.
- **Nulls over guesses.** The prompt forbids inferring values not stated in
  the contract.

Known simplifications (deliberate, it's an evening project): plain text input
only (no PDF parsing), no eval suite, no auth/rate limiting, single-document
extraction (no chunking for contracts beyond the context window).

## Run it

One-time setup, then a single command runs both servers:

```bash
# setup (once)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pnpm install && pnpm --dir frontend install
cp .env.example .env   # then paste your ANTHROPIC_API_KEY into .env

# run both (backend :8000 + frontend :5173)
pnpm start
```

Open http://localhost:5173.

### Running the servers separately

Backend (terminal 1):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY=sk-ant-...   # from console.anthropic.com
uvicorn app.main:app --reload
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — paste a contract, upload a `.txt`, or click
"Load sample NDA". The Vite dev server proxies `/extract` to the backend,
so no CORS setup is needed.

Backend only: http://localhost:8000/docs has the interactive Swagger UI, or:

```bash
python - <<'EOF'
import json, urllib.request
text = open("samples/sample_nda.txt").read()
req = urllib.request.Request(
    "http://localhost:8000/extract",
    data=json.dumps({"text": text}).encode(),
    headers={"Content-Type": "application/json"},
)
print(json.dumps(json.load(urllib.request.urlopen(req)), indent=2))
EOF
```

### Offline mode (no API key)

`STUB_MODE=1 uvicorn app.main:app --reload` returns a canned response —
useful for testing the API plumbing without credentials.
