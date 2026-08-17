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
const REQUEST_TIMEOUT_MS = 55000;

type HistoryEntry = { role: "user" | "assistant"; content: string };

function trunc(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function toDisplayMessages(stored: StoredMessage[]): Message[] {
  return stored.map((m) => {
    if (m.role === "user") return { type: "user", text: m.content, ts: m.ts };
    if (m.role === "error") return { type: "error", text: m.content, ts: m.ts };
    return { type: "bot", content: m.content, ts: m.ts };
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
      setMessages((prev) => [...prev, { type: "user", text: msg, ts: Date.now() }, { type: "typing" }]);
      conv.messages.push(newMessage("user", msg));
    }

    setLoading(true);
    scheduleSave();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => threadRef.current?.scrollToUserMessage());
    });

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

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
        { type: "bot", content: "", ts: Date.now() },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullText = "";

      const applyText = (text: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          const last = next[lastIdx];
          if (last?.type === "bot") next[lastIdx] = { ...last, content: text };
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

          let payload: { text?: string; warnings?: string[]; response_id?: string };
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
            if (payload.response_id) {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                const last = next[lastIdx];
                if (last?.type === "bot") {
                  next[lastIdx] = { ...last, content: fullText, responseId: payload.response_id };
                }
                return next;
              });
            }
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
      const isAbort = (err as Error)?.name === "AbortError";
      if (isAbort && !timedOut) {
        setMessages((prev) => prev.filter((m) => m.type !== "typing"));
      } else {
        const message = isAbort ? tr.error : err instanceof Error ? err.message : tr.error;
        setMessages((prev) => [
          ...prev.filter((m) => m.type !== "typing"),
          { type: "error", text: message },
        ]);
        conv.messages.push(newMessage("error", message));
        flushSave();
      }
    } finally {
      clearTimeout(timeoutId);
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

  const [shareCopied, setShareCopied] = useState(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  const handleShare = useCallback(async () => {
    const conv = activeConvRef.current;
    if (!conv || !conv.messages.length) return;
    const lastFew = conv.messages.slice(-2);
    const summary = [
      conv.title || tr.newChat,
      "",
      ...lastFew.map((m) => `${m.role === "user" ? "Q" : "R"}: ${m.content}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // Presse-papier indisponible (permissions/contexte non sécurisé) : échec silencieux, pas de blocage UI.
    }
  }, [tr.newChat]);

  const handleExport = useCallback(() => {
    const conv = activeConvRef.current;
    if (!conv || !conv.messages.length) return;
    const lines = conv.messages.map(
      (m) => `[${m.role === "user" ? "Vous" : m.role === "error" ? "Erreur" : tr.botName}]\n${m.content}\n`,
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conv.title || "conversation").replace(/[^\w\-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tr.botName]);

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

        {!showWelcome && activeConversation && (
          <div className="chat-topbar">
            <div className="chat-topbar-titles">
              <div className="chat-topbar-title">{activeConversation.title || tr.newChat}</div>
              <div className="chat-topbar-subtitle">{tr.subtitle}</div>
            </div>
            <div className="chat-topbar-actions">
              <button className="chat-topbar-btn" onClick={handleShare} title={tr.share}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path strokeLinecap="round" d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" />
                </svg>
                {shareCopied ? tr.shareCopied : tr.share}
              </button>
              <button className="chat-topbar-btn" onClick={handleExport} title={tr.exportTooltip}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                {tr.export}
              </button>
            </div>
          </div>
        )}

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
