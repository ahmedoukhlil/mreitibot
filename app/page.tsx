"use client";
import { useState, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Thread, { Message, ThreadHandle } from "./components/Thread";
import InputArea from "./components/InputArea";
import { renderMarkdown } from "./lib/markdown";

const WEBHOOK_URL = "/api/chat";
const HISTORY_MAX = 16;
const HISTORY_MAX_CHARS = 3500;

type HistoryEntry = { role: "user" | "assistant"; content: string };

function trunc(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const historyRef = useRef<HistoryEntry[]>([]);
  const threadRef = useRef<ThreadHandle>(null);
  const chatMainRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setShowWelcome(false);
    setMessages((prev) => [...prev, { type: "user", text: msg }]);
    setInput("");
    setLoading(true);
    setMessages((prev) => [...prev, { type: "typing" }]);

    // Amène le message user en haut de la zone visible après render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => threadRef.current?.scrollToUserMessage());
    });

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatInput: msg,
          chatHistory: historyRef.current.map((m) => ({
            role: m.role,
            content: trunc(m.content, HISTORY_MAX_CHARS),
          })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reply = await res.text();

      // Retire le typing, insère le bubble bot vide
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "typing"),
        { type: "bot", html: "" },
      ]);

      // Attendre 2 frames que React commite le bubble dans le DOM
      await new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); });

      // Streaming : écriture directe dans le DOM, zéro scroll forcé
      const CHARS_PER_FRAME = 2;
      const chars = [...(reply || "—")];
      let revealed = "";
      let i = 0;

      await new Promise<void>((resolve) => {
        function tick() {
          if (i >= chars.length) { resolve(); return; }
          revealed += chars.slice(i, i + CHARS_PER_FRAME).join("");
          i += CHARS_PER_FRAME;
          threadRef.current?.updateLastBot(renderMarkdown(revealed));
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });

      // Rendu final complet
      threadRef.current?.updateLastBot(renderMarkdown(reply || "—"));

      // Sync state React avec le HTML final
      const finalHtml = renderMarkdown(reply || "—");
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.type === "bot") next[lastIdx] = { type: "bot", html: finalHtml };
        return next;
      });

      // Historique
      const h = historyRef.current;
      h.push({ role: "user", content: msg });
      h.push({ role: "assistant", content: trunc(reply || "", HISTORY_MAX_CHARS) });
      while (h.length > HISTORY_MAX) h.shift();

    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "typing"),
        { type: "error", text: "Impossible de joindre le serveur. Vérifiez votre connexion." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handlePick = useCallback((q: string) => sendMessage(q), [sendMessage]);

  const handleNewChat = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
    setShowWelcome(true);
    setInput("");
    setSidebarOpen(false);
    if (chatMainRef.current) chatMainRef.current.scrollTop = 0;
  }, []);

  return (
    <div className="app">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onPickQuestion={handlePick}
      />

      <div className="chat-main" ref={chatMainRef}>
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="mobile-header-title">MREITI BOT</span>
        </div>

        <Thread
          ref={threadRef}
          messages={messages}
          showWelcome={showWelcome}
          onPick={handlePick}
          scrollContainerRef={chatMainRef}
        />

        <InputArea
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          disabled={loading}
        />
      </div>
    </div>
  );
}
