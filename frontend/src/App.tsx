import { useRef, useState } from "react";
import { extractContract } from "./api";
import type { ExtractResponse, RiskFlag } from "./types";

type Status = "idle" | "loading" | "error" | "success";

const MIN_LENGTH = 50;

export default function App() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ExtractResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSubmit = text.trim().length >= MIN_LENGTH && status !== "loading";

  async function handleAnalyze() {
    if (!canSubmit) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    try {
      const result = await extractContract(text, controller.signal);
      setResponse(result);
      setStatus("success");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
    event.target.value = ""; // allow re-uploading the same file
  }

  async function loadSample() {
    const sample = await fetch("/sample_nda.txt").then((r) => r.text());
    setText(sample);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Contract Clause Extractor</h1>
          <p className="subtitle">
            Paste a contract, get structured metadata and risk flags —
            FastAPI + Pydantic + Claude, React on top.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="panel input-panel">
          <div className="panel-header">
            <h2>Contract</h2>
            <span className="char-count">
              {text.length.toLocaleString()} chars
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste contract text here, or upload a .txt file…"
            spellCheck={false}
          />

          <div className="actions">
            <button
              className="button secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain"
              onChange={handleFileUpload}
              hidden
            />
            <button className="button secondary" onClick={loadSample}>
              Load sample NDA
            </button>
            <button
              className="button primary"
              onClick={handleAnalyze}
              disabled={!canSubmit}
            >
              {status === "loading" ? "Analyzing…" : "Analyze contract"}
            </button>
          </div>

          {text.trim().length > 0 && text.trim().length < MIN_LENGTH && (
            <p className="hint">
              Needs at least {MIN_LENGTH} characters to analyze.
            </p>
          )}
        </section>

        <section className="panel results-panel">
          <div className="panel-header">
            <h2>Analysis</h2>
            {response && status === "success" && (
              <span className="model-badge">
                {response.model}
                {response.retried && " · retried"}
              </span>
            )}
          </div>

          {status === "idle" && (
            <EmptyState message="Results will appear here." />
          )}
          {status === "loading" && (
            <EmptyState message="Reading the contract…" spinning />
          )}
          {status === "error" && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          {status === "success" && response && (
            <Results response={response} />
          )}
        </section>
      </main>
    </div>
  );
}

function EmptyState({
  message,
  spinning = false,
}: {
  message: string;
  spinning?: boolean;
}) {
  return (
    <div className="empty-state">
      {spinning && <div className="spinner" aria-hidden />}
      <p>{message}</p>
    </div>
  );
}

function Results({ response }: { response: ExtractResponse }) {
  const r = response.result;
  // Optional in the schema (has a server-side default), so normalize once here.
  const riskFlags = r.risk_flags ?? [];
  const fields: Array<[string, string]> = [
    ["Document type", r.document_type],
    ["Effective date", r.effective_date ?? "—"],
    ["Term", r.term ?? "—"],
    ["Governing law", r.governing_law ?? "—"],
    ["Liability cap", r.liability_cap ?? "None stated"],
    [
      "Auto-renewal",
      r.auto_renewal === null ? "—" : r.auto_renewal ? "Yes" : "No",
    ],
    ["Confidentiality survives", r.confidentiality_period ?? "—"],
  ];

  return (
    <div className="results">
      <div className="parties">
        {r.parties.map((party) => (
          <div className="party-card" key={party.name}>
            <span className="party-name">{party.name}</span>
            <span className="party-role">{party.role}</span>
          </div>
        ))}
      </div>

      <dl className="meta-grid">
        {fields.map(([label, value]) => (
          <div className="meta-item" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="risks-title">
        Risk flags
        <span className="risks-count">{riskFlags.length}</span>
      </h3>
      {riskFlags.length === 0 ? (
        <p className="hint">No risks flagged.</p>
      ) : (
        <ul className="risk-list">
          {riskFlags.map((flag) => (
            <RiskCard key={`${flag.clause_type}-${flag.quote}`} flag={flag} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskCard({ flag }: { flag: RiskFlag }) {
  return (
    <li className={`risk-card risk-${flag.risk_level}`}>
      <div className="risk-card-header">
        <span className="risk-type">{flag.clause_type}</span>
        <span className={`risk-chip chip-${flag.risk_level}`}>
          {flag.risk_level}
        </span>
      </div>
      <blockquote>“{flag.quote}”</blockquote>
      <p className="risk-rationale">{flag.rationale}</p>
    </li>
  );
}
