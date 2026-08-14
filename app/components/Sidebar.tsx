"use client";
import Image from "next/image";
import { useState } from "react";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";
import ConversationList from "./ConversationList";
import ThemeToggle from "./ThemeToggle";
import type { StoredConversation } from "../lib/storage";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  conversations: StoredConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  onNewChat,
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}: Props) {
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
                background: "var(--accent)", display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}
            >
              M
            </div>
          )}
          <div className="sidebar-title-wrap">
            <div className="sidebar-title">{tr.botName}</div>
          </div>
          <div className="lang-flag-switch">
            <button
              className={`lang-flag-option${lang === "fr" ? " active" : ""}`}
              onClick={() => lang !== "fr" && toggle()}
              aria-label="Français"
              title="Français"
            >
              🇫🇷
            </button>
            <button
              className={`lang-flag-option${lang === "ar" ? " active" : ""}`}
              onClick={() => lang !== "ar" && toggle()}
              aria-label="العربية"
              title="العربية"
            >
              🇲🇷
            </button>
          </div>
          <ThemeToggle />
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {tr.newChat}
        </button>

        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={(id) => { onSelectConversation(id); onClose(); }}
          onRename={onRenameConversation}
          onDelete={onDeleteConversation}
        />

        <div className="sidebar-footer">
          <div className="status-dot" />
          <span className="status-label">{tr.online}</span>
        </div>
      </div>
    </>
  );
}
