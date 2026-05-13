"use client";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

interface Props {
  onPick: (q: string) => void;
}

export default function Welcome({ onPick }: Props) {
  const { lang } = useLang();
  const tr = t(lang);

  return (
    <div className="welcome">
      <div className="welcome-logo-inner">
        <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h1>{tr.welcomeTitle} <span>{tr.welcomeTitleSpan}</span></h1>
      <p>{tr.welcomeDesc}</p>
      <div className="welcome-suggestions">
        {tr.suggestions.map((q) => (
          <button key={q} className="welcome-suggestion-btn" onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
