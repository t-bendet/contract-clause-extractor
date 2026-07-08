"""FastAPI app — contract clause extractor.

Run:  uvicorn app.main:app --reload
Docs: http://localhost:8000/docs  (interactive Swagger UI, free with FastAPI)
"""

import logging

from fastapi import FastAPI, HTTPException
from pydantic import ValidationError

from .extractor import MODEL, extract
from .models import ExtractRequest, ExtractResponse

logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="Contract Clause Extractor",
    description="Extracts structured metadata and risk flags from contracts using Claude, "
    "with Pydantic-validated output.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL}


@app.post("/extract", response_model=ExtractResponse)
def extract_contract(request: ExtractRequest) -> ExtractResponse:
    try:
        result, retried = extract(request.text)
    except ValidationError:
        logger.exception("LLM output failed validation twice")
        raise HTTPException(status_code=502, detail="Model returned invalid output after retry")
    except Exception:
        logger.exception("Extraction failed")
        raise HTTPException(status_code=502, detail="Upstream model call failed")

    return ExtractResponse(result=result, model=MODEL, retried=retried)
