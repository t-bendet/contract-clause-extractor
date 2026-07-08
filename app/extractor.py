"""LLM extraction logic.

Flow: contract text -> Claude (asked for strict JSON) -> Pydantic validation.
If validation fails, we retry once, feeding the validation error back to the
model so it can self-correct. Set STUB_MODE=1 to run without an API key.
"""

import json
import os

from dotenv import load_dotenv
from pydantic import ValidationError

from .models import ExtractionResult

load_dotenv()  # reads .env from the project root (ANTHROPIC_API_KEY etc.)

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

SYSTEM_PROMPT = """You are a contract-analysis engine for an in-house legal team.
Extract metadata from the contract provided by the user.

Respond with ONLY a JSON object matching this schema (no markdown, no prose):
{schema}

Rules:
- Use null for anything not stated in the contract. Never guess.
- Quotes in risk_flags must be verbatim from the text.
- Flag as risks: uncapped liability, non-mutual obligations, auto-renewal,
  unusually long confidentiality/non-compete periods, broad IP assignment.
"""


def _schema_for_prompt() -> str:
    return json.dumps(ExtractionResult.model_json_schema(), indent=2)


def _call_claude(contract_text: str, error_feedback: str | None = None) -> str:
    """One round-trip to the API. Returns the raw text response."""
    import anthropic  # imported lazily so STUB_MODE works without the package

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    user_content = f"<contract>\n{contract_text}\n</contract>"
    if error_feedback:
        user_content += (
            "\n\nYour previous response failed schema validation with this error, "
            f"fix it and return only valid JSON:\n{error_feedback}"
        )

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT.format(schema=_schema_for_prompt()),
        messages=[{"role": "user", "content": user_content}],
    )
    # The response may contain non-text blocks (e.g. thinking) — join text only.
    text_parts = [block.text for block in response.content if block.type == "text"]
    if not text_parts:
        raise ValueError("Model response contained no text block")
    return "".join(text_parts)


def _stub_response(contract_text: str) -> str:
    """Canned response for offline testing (STUB_MODE=1)."""
    return json.dumps(
        {
            "document_type": "NDA",
            "parties": [
                {"name": "Acme Corp", "role": "Disclosing Party"},
                {"name": "Beta Ltd", "role": "Receiving Party"},
            ],
            "effective_date": "2026-01-15",
            "term": "2 years",
            "governing_law": "State of Delaware",
            "liability_cap": None,
            "auto_renewal": True,
            "confidentiality_period": "5 years after termination",
            "risk_flags": [
                {
                    "clause_type": "Auto-renewal",
                    "quote": "shall automatically renew for successive one-year periods",
                    "risk_level": "medium",
                    "rationale": "Agreement renews silently unless notice is given 60 days in advance.",
                },
                {
                    "clause_type": "Liability",
                    "quote": "each party shall be liable for all damages arising hereunder",
                    "risk_level": "high",
                    "rationale": "No cap on liability.",
                },
            ],
        }
    )


def _clean_json(raw: str) -> str:
    """Models sometimes wrap JSON in markdown fences despite instructions."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        raw = raw.removeprefix("json").strip()
    return raw


def extract(contract_text: str) -> tuple[ExtractionResult, bool]:
    """Extract structured data from a contract.

    Returns (result, retried). Raises ValidationError if the retry also fails.
    """
    stub = os.environ.get("STUB_MODE") == "1"
    get_raw = _stub_response if stub else _call_claude

    raw = get_raw(contract_text)
    try:
        return ExtractionResult.model_validate_json(_clean_json(raw)), False
    except ValidationError as first_error:
        if stub:
            raise
        # Retry once, letting the model see its own mistake.
        raw = _call_claude(contract_text, error_feedback=str(first_error))
        return ExtractionResult.model_validate_json(_clean_json(raw)), True
