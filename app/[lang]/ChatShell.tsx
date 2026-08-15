"use client";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Thread from "../components/Thread";
import InputArea from "../components/InputArea";
import { useLangSwitch } from "../lib/useLangSwitch";
import type { Lang } from "../lib/i18n";
import { useChat } from "../lib/useChat";

/**
 * Rendu partagé par /[lang] (nouvelle conversation) et /[lang]/c/[id] (conversation existante) —
 * seule la résolution de conversationId/onConversationCreated diffère entre les deux pages appelantes.
 */
export default function ChatShell({
  lang,
  conversationId,
}: {
  lang: Lang;
  conversationId: string | null;
}) {
  const router = useRouter();
  const switchLang = useLangSwitch();

  const chat = useChat({
    lang,
    conversationId,
    onConversationCreated: (id) => router.replace(`/${lang}/c/${id}`),
    onConversationNotFound: () => router.replace(`/${lang}`),
  });

  const {
    tr,
    sidebarOpen,
    setSidebarOpen,
    messages,
    showWelcome,
    input,
    setInput,
    loading,
    conversations,
    activeConversationId,
    threadRef,
    chatMainRef,
    sendMessage,
    regenerate,
    retryLast,
    stopGeneration,
    handlePick,
    resetToNewChat,
    handleRenameConversation,
    handleDeleteConversation,
  } = chat;

  const handleNewChat = () => {
    resetToNewChat();
    router.push(`/${lang}`);
  };

  const handleSelectConversation = (id: string) => {
    router.push(`/${lang}/c/${id}`);
    setSidebarOpen(false);
  };

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
          <button
            className="lang-toggle-btn lang-toggle-mobile"
            onClick={() => switchLang(lang === "fr" ? "ar" : "fr")}
          >
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
