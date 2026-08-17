"use client";
import { useMemo, useState } from "react";
import type { StoredConversation } from "../lib/storage";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";
import { groupByDate, type DateGroupKey } from "../lib/dateGroups";

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
  const [search, setSearch] = useState("");
  const { lang } = useLang();
  const tr = t(lang);

  const groupLabels: Record<DateGroupKey, string> = {
    today: tr.dateToday,
    week: tr.dateWeek,
    older: tr.dateOlder,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.title || tr.newChat).toLowerCase().includes(q));
  }, [conversations, search, tr.newChat]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

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
    <>
      <div className="sidebar-search-wrap">
        <span className="sidebar-search-icon">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          className="sidebar-search-input"
          placeholder={tr.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="conversation-list">
        {groups.length === 0 && (
          <div className="sidebar-search-empty">{tr.searchNoResults}</div>
        )}
        {groups.map((group) => (
          <div key={group.key} className="conversation-group">
            <div className="conversation-group-label">{groupLabels[group.key]}</div>
            {group.items.map((conv) => (
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
                    <span className="conversation-dot" />
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
        ))}
      </div>
    </>
  );
}
