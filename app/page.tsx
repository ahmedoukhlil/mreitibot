"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Thread, { Message, ThreadHandle } from "./components/Thread";
import InputArea from "./components/InputArea";
import { useLang } from "./lib/LangContext";
import { t } from "./lib/i18n";
import {
  StoredConversation,
  StoredMessage,
  listConversations,
  getConversation,
  createConversation,
  saveConversation,
  renameConversation,
  deleteConversation,
  newMessage,
} from "./lib/storage";

const WEBHOOK_URL = "/api/chat";
const HISTORY_MAX = 16;
const HISTORY_MAX_CHARS = 3500;
const SAVE_DEBOUNCE_MS = 400;

type HistoryEntry = { role: "user" | "assistant"; content: string };

function trunc(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function toDisplayMessages(stored: StoredMessage[]): Message[] {
  return stored.map((m) => {
    if (m.role === "user") return { type: "user", text: m.content };
    if (m.role === "error") return { type: "error", text: m.content };
    return { type: "bot", content: m.content };
  });
}

export default function ChatPage() {
  const { lang, toggle } = useLang();
  const tr = t(lang);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<StoredConversation[]>(listConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const threadRef = useRef<ThreadHandle>(null);
  const chatMainRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeConvRef = useRef<StoredConversation | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserMsgRef = useRef<string>("");

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (activeConvRef.current) {
      saveConversation(activeConvRef.current);
      setConversations(listConversations());
    }
  }, []);

  useEffect(() => {
    const handler = () => flushSave();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flushSave]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (activeConvRef.current) {
        saveConversation(activeConvRef.current);
        setConversations(listConversations());
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const ensureActiveConversation = useCallback((): StoredConversation => {
    if (activeConvRef.current) return activeConvRef.current;
    const conv = createConversation(lang);
    activeConvRef.current = conv;
    setActiveConversationId(conv.id);
    setConversations(listConversations());
    return conv;
  }, [lang]);

  /**
   * Cœur de l'envoi/streaming, réutilisé par sendMessage (nouveau tour), regenerate
   * (renvoie la dernière question, remplace la dernière réponse en place) et retry
   * (relance la dernière question après une erreur, sans dupliquer la bulle user).
   */
  const runTurn = useCallback(async (msg: string, opts: { replaceLast?: boolean } = {}) => {
    const conv = ensureActiveConversation();
    lastUserMsgRef.current = msg;

    if (opts.replaceLast) {
      setMessages((prev) => {
        const next = [...prev];
        // Retire la dernière bulle bot/error, garde le message user précédent.
        while (next.length && next[next.length - 1].type !== "user") next.pop();
        return [...next, { type: "typing" }];
      });
      if (conv.messages.length && conv.messages[conv.messages.length - 1].role !== "user") {
        conv.messages.pop();
      }
    } else {
      setShowWelcome(false);
      setMessages((prev) => [...prev, { type: "user", text: msg }, { type: "typing" }]);
      conv.messages.push(newMessage("user", msg));
    }

    setLoading(true);
    scheduleSave();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => threadRef.current?.scrollToUserMessage());
    });

    const controller = new AbortController();
    abortRef.current = controller;

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
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let errMsg = tr.error;
        try {
          const errJson = await res.json();
          if (errJson?.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "typing"),
        { type: "bot", content: "" },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullText = "";

      const applyText = (text: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.type === "bot") next[lastIdx] = { type: "bot", content: text };
          return next;
        });
      };

      streamLoop: while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const lines = rawEvent.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }
          if (!dataLine) continue;

          let payload: { text?: string; warnings?: string[] };
          try {
            payload = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (eventName === "chunk" && payload.text) {
            fullText += payload.text;
            applyText(fullText);
          } else if (eventName === "correction" && payload.text) {
            fullText = payload.text;
            applyText(fullText);
          } else if (eventName === "done") {
            break streamLoop;
          }
        }
      }

      if (!fullText) applyText("—");

      const h = historyRef.current;
      h.push({ role: "user", content: msg });
      h.push({ role: "assistant", content: trunc(fullText || "", HISTORY_MAX_CHARS) });
      while (h.length > HISTORY_MAX) h.shift();

      conv.messages.push(newMessage("assistant", fullText || "—"));
      flushSave();

    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setMessages((prev) => prev.filter((m) => m.type !== "typing"));
      } else {
        const message = err instanceof Error ? err.message : tr.error;
        setMessages((prev) => [
          ...prev.filter((m) => m.type !== "typing"),
          { type: "error", text: message },
        ]);
        conv.messages.push(newMessage("error", message));
        flushSave();
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [ensureActiveConversation, scheduleSave, flushSave, tr.error]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    await runTurn(msg);
  }, [input, loading, runTurn]);

  // regenerate (dernière réponse bot) et retryLast (après erreur) font la même chose :
  // renvoyer la dernière question utilisateur, en remplaçant la dernière réponse/erreur en place.
  const replayLastTurn = useCallback(() => {
    if (loading || !lastUserMsgRef.current) return;
    runTurn(lastUserMsgRef.current, { replaceLast: true });
  }, [loading, runTurn]);
  const regenerate = replayLastTurn;
  const retryLast = replayLastTurn;

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handlePick = useCallback((q: string) => sendMessage(q), [sendMessage]);

  const handleNewChat = useCallback(() => {
    flushSave();
    activeConvRef.current = null;
    setActiveConversationId(null);
    historyRef.current = [];
    lastUserMsgRef.current = "";
    setMessages([]);
    setShowWelcome(true);
    setInput("");
    setSidebarOpen(false);
    if (chatMainRef.current) chatMainRef.current.scrollTop = 0;
  }, [flushSave]);

  const handleSelectConversation = useCallback((id: string) => {
    flushSave();
    const conv = getConversation(id);
    if (!conv) return;
    activeConvRef.current = conv;
    setActiveConversationId(conv.id);
    setMessages(toDisplayMessages(conv.messages));
    setShowWelcome(conv.messages.length === 0);
    const lastUser = [...conv.messages].reverse().find((m) => m.role === "user");
    lastUserMsgRef.current = lastUser?.content ?? "";
    historyRef.current = conv.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: trunc(m.content, HISTORY_MAX_CHARS) }))
      .slice(-HISTORY_MAX);
    setInput("");
    if (chatMainRef.current) chatMainRef.current.scrollTop = 0;
  }, [flushSave]);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    renameConversation(id, title);
    setConversations(listConversations());
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    deleteConversation(id);
    setConversations(listConversations());
    if (activeConversationId === id) {
      activeConvRef.current = null;
      setActiveConversationId(null);
      historyRef.current = [];
      lastUserMsgRef.current = "";
      setMessages([]);
      setShowWelcome(true);
    }
  }, [activeConversationId]);

  return (
    <div className="app" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="chat-main" ref={chatMainRef}>
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="mobile-header-title">{tr.botName}</span>
          <button className="lang-toggle-btn lang-toggle-mobile" onClick={toggle}>
            {lang === "fr" ? "ع" : "FR"}
          </button>
        </div>

        <Thread
          ref={threadRef}
          messages={messages}
          showWelcome={showWelcome}
          onPick={handlePick}
          onRegenerate={regenerate}
          onRetry={retryLast}
          loading={loading}
        />

        <InputArea
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          onStop={stopGeneration}
          disabled={loading}
        />
      </div>
    </div>
  );
}
