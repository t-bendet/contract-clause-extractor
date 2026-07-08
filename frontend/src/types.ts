// TypeScript mirrors of the backend's Pydantic models (app/models.py).
// Same shapes on both sides of the wire — Pydantic validates on the way out,
// these types keep the UI honest on the way in.

export type RiskLevel = "low" | "medium" | "high";

export interface Party {
  name: string;
  role: string;
}

export interface RiskFlag {
  clause_type: string;
  quote: string;
  risk_level: RiskLevel;
  rationale: string;
}

export interface ExtractionResult {
  document_type: string;
  parties: Party[];
  effective_date: string | null;
  term: string | null;
  governing_law: string | null;
  liability_cap: string | null;
  auto_renewal: boolean | null;
  confidentiality_period: string | null;
  risk_flags: RiskFlag[];
}

export interface ExtractResponse {
  result: ExtractionResult;
  model: string;
  retried: boolean;
}
