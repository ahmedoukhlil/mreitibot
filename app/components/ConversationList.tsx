"use client";
import { useState } from "react";
import type { StoredConversation } from "../lib/storage";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

interface Props {
  conversations: StoredConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function ConversationList({ conversations, activeId, onSelect, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { lang } = useLang();
  const tr = t(lang);

  if (conversations.length === 0) return null;

  const startRename = (conv: StoredConversation) => {
    setEditingId(conv.id);
    setEditValue(conv.title || tr.newChat);
  };

  const commitRename = (id: string) => {
    onRename(id, editValue);
    setEditingId(null);
  };

  return (
    <div className="conversation-list">
      <div className="sidebar-section-label">{tr.conversations}</div>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={`conversation-item${conv.id === activeId ? " active" : ""}`}
        >
          {editingId === conv.id ? (
            <input
              className="conversation-rename-input"
              value={editValue}
              autoFocus
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitRename(conv.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(conv.id);
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          ) : (
            <>
              <button
                className="conversation-title-btn"
                onClick={() => onSelect(conv.id)}
                title={conv.title || tr.newChat}
              >
                {conv.title || tr.newChat}
              </button>
              <div className="conversation-actions">
                <button
                  className="conversation-action-btn"
                  aria-label="rename"
                  onClick={() => startRename(conv)}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className="conversation-action-btn"
                  aria-label="delete"
                  onClick={() => onDelete(conv.id)}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 4h6a1 1 0 011 1v2H8V5a1 1 0 011-1z" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
