"use client";
import Image from "next/image";
import { useState } from "react";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onPickQuestion: (q: string) => void;
}

export default function Sidebar({ isOpen, onClose, onNewChat, onPickQuestion }: Props) {
  const [logoError, setLogoError] = useState(false);
  const { lang, toggle } = useLang();
  const tr = t(lang);

  return (
    <>
      <div
        className={`sidebar-overlay${isOpen ? " open" : ""}`}
        onClick={onClose}
      />

      <div className={`sidebar${isOpen ? " open" : ""}`}>
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
            <div className="sidebar-title">{tr.botName}</div>
            <div className="sidebar-subtitle">{tr.subtitle}</div>
          </div>
        </div>

        {/* Lang toggle */}
        <button className="lang-toggle-btn" onClick={toggle}>
          {lang === "fr" ? "🇲🇷 العربية" : "🇫🇷 Français"}
        </button>

        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {tr.newChat}
        </button>

        <div className="sidebar-section-label">{tr.suggestedQuestions}</div>

        <div className="sidebar-suggestions">
          {tr.suggestions.map((q) => (
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

        <div className="sidebar-footer">
          <div className="status-dot" />
          <span className="status-label">{tr.online}</span>
        </div>
      </div>
    </>
  );
}
