"use client";
import Image from "next/image";
import { useState } from "react";

const SUGGESTIONS = [
  "Comment mettre en œuvre l'exigence 1.1 sur l'engagement du gouvernement ?",
  "Quelles sont les obligations des entreprises extractives selon l'exigence 1.2 ?",
  "Comment divulguer les bénéficiaires effectifs (exigence 2.5) ?",
  "Quelles étapes pour satisfaire l'exigence 4.1 sur la déclaration exhaustive ?",
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onPickQuestion: (q: string) => void;
}

export default function Sidebar({ isOpen, onClose, onNewChat, onPickQuestion }: Props) {
  const [logoError, setLogoError] = useState(false);

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`sidebar-overlay${isOpen ? " open" : ""}`}
        onClick={onClose}
      />

      <div className={`sidebar${isOpen ? " open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          {!logoError ? (
            <div className="sidebar-logo-wrap">
              <Image
                src="/logo_mreiti.png"
                alt="MREITI"
                width={80}
                height={34}
                className="sidebar-logo"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <div
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: "#006c35", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}
            >
              M
            </div>
          )}
          <div>
            <div className="sidebar-title">MREITI BOT</div>
            <div className="sidebar-subtitle">MREITI · ITIE Mauritanie</div>
          </div>
        </div>

        {/* New chat */}
        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle conversation
        </button>

        <div className="sidebar-section-label">Questions suggérées</div>

        {/* Suggestions */}
        <div className="sidebar-suggestions">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              className="sidebar-suggestion-btn"
              onClick={() => { onPickQuestion(q); onClose(); }}
            >
              <span className="sidebar-suggestion-icon">
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="sidebar-suggestion-text">{q}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="status-dot" />
          <span className="status-label">En ligne</span>
        </div>
      </div>
    </>
  );
}
