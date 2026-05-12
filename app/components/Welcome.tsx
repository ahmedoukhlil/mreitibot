"use client";

const SUGGESTIONS = [
  "Comment mettre en œuvre l'exigence 1.1 sur l'engagement du gouvernement ?",
  "Quelles sont les obligations des entreprises extractives selon l'exigence 1.2 ?",
  "Comment divulguer les bénéficiaires effectifs (exigence 2.5) ?",
  "Quelles étapes pour satisfaire l'exigence 4.1 sur la déclaration exhaustive ?",
];

interface Props {
  onPick: (q: string) => void;
}

export default function Welcome({ onPick }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-logo-inner">
        <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h1>Comment puis-je vous <span>aider ?</span></h1>
      <p>Assistant expert en mise en œuvre de la Norme ITIE 2023 et en transparence des industries extractives en Mauritanie.</p>
      <div className="welcome-suggestions">
        {SUGGESTIONS.map((q) => (
          <button key={q} className="welcome-suggestion-btn" onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
