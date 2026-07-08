"""Pydantic models — the contract between the LLM and the API.

The LLM returns JSON; these models validate it. If the model hallucinates
a wrong shape, validation fails and we retry with the error message
(see extractor.py). This is the same pattern as Zod schemas in TypeScript.
"""

from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Party(BaseModel):
    name: str = Field(description="Legal name of the party")
    role: str = Field(description="Role in the agreement, e.g. 'Disclosing Party', 'Receiving Party', 'Vendor'")


class RiskFlag(BaseModel):
    clause_type: str = Field(description="e.g. 'Liability', 'Non-compete', 'Auto-renewal'")
    quote: str = Field(description="Short verbatim quote of the problematic language")
    risk_level: RiskLevel
    rationale: str = Field(description="One-sentence explanation of why this is flagged")


class ExtractionResult(BaseModel):
    """Structured metadata extracted from a contract."""

    document_type: str = Field(description="e.g. 'NDA', 'MSA', 'DPA'")
    parties: list[Party]
    effective_date: str | None = Field(default=None, description="ISO date if stated, else null")
    term: str | None = Field(default=None, description="Duration of the agreement as stated, e.g. '2 years'")
    governing_law: str | None = Field(default=None, description="Jurisdiction, e.g. 'State of Delaware'")
    liability_cap: str | None = Field(default=None, description="Cap on liability if any, else null")
    auto_renewal: bool | None = Field(default=None, description="True if the contract auto-renews")
    confidentiality_period: str | None = Field(default=None, description="How long confidentiality obligations survive")
    risk_flags: list[RiskFlag] = Field(default_factory=list)


class ExtractRequest(BaseModel):
    text: str = Field(min_length=50, description="Raw contract text")


class ExtractResponse(BaseModel):
    result: ExtractionResult
    model: str
    retried: bool = Field(description="True if the first LLM response failed validation and was retried")
