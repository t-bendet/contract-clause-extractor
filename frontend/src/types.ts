// Friendly aliases over the generated OpenAPI types (src/generated/api.d.ts).
//
// The generated file comes from the backend's OpenAPI schema, which FastAPI
// derives from the Pydantic models — so app/models.py is the single source
// of truth for both runtime validation (backend) and these compile-time
// types (frontend). Regenerate after backend changes: `pnpm gen:types`.

import type { components } from "./generated/api";

export type ExtractionResult = components["schemas"]["ExtractionResult"];
export type ExtractResponse = components["schemas"]["ExtractResponse"];
export type Party = components["schemas"]["Party"];
export type RiskFlag = components["schemas"]["RiskFlag"];
export type RiskLevel = components["schemas"]["RiskLevel"];
