"use client";
import { useState } from "react";

interface Props {
  content: string;
  onRegenerate?: () => void;
  responseId?: string;
}

export default function MessageActions({ content, onRegenerate, responseId }: Props) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API indisponible, ignore silencieusement.
    }
  };

  const handleFeedback = (value: "up" | "down") => {
    if (!responseId || feedback) return;
    setFeedback(value);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_id: responseId, feedback: value }),
    }).catch(() => {});
  };

  return (
    <div className="message-actions">
      <button
        className="message-action-btn"
        onClick={handleCopy}
        aria-label="copy"
        title={copied ? "Copié" : "Copier"}
      >
        {copied ? (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
      {onRegenerate && (
        <button
          className="message-action-btn"
          onClick={onRegenerate}
          aria-label="regenerate"
          title="Régénérer"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6M1 20v-6h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      )}
      {responseId && (
        <>
          <button
            className={`message-action-btn${feedback === "up" ? " message-action-btn-active" : ""}`}
            onClick={() => handleFeedback("up")}
            disabled={!!feedback}
            aria-label="feedback positif"
            title="Réponse utile"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
            </svg>
          </button>
          <button
            className={`message-action-btn${feedback === "down" ? " message-action-btn-active" : ""}`}
            onClick={() => handleFeedback("down")}
            disabled={!!feedback}
            aria-label="feedback négatif"
            title="Réponse à améliorer"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
