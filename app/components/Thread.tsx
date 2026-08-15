"use client";
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";
import Image from "next/image";
import Welcome from "./Welcome";
import MessageActions from "./MessageActions";
import { parseMarkdown } from "../lib/markdown";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

export type Message =
  | { type: "user"; text: string }
  | { type: "bot"; content: string; responseId?: string }
  | { type: "error"; text: string }
  | { type: "typing" };

export interface ThreadHandle {
  scrollToUserMessage(): void;
}

interface Props {
  messages: Message[];
  showWelcome: boolean;
  onPick: (q: string) => void;
  onRegenerate: () => void;
  onRetry: () => void;
  loading: boolean;
}

const THINKING_STAGE_MS = 2200;

function TypingIndicator({ stages }: { stages: readonly string[] }) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    setStageIdx(0);
    if (stages.length <= 1) return;
    const id = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, stages.length - 1));
    }, THINKING_STAGE_MS);
    return () => clearInterval(id);
  }, [stages]);

  return (
    <div className="typing-wrapper">
      <BotAvatar />
      <div className="typing-text">
        {stages[stageIdx] ?? stages[0]}
        <span className="typing-ellipsis" />
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="bot-avatar">
      <Image
        src="/logo_mreiti.png"
        alt="MREITI"
        width={22}
        height={22}
        style={{ objectFit: "contain" }}
        onError={(e) => {
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) parent.innerHTML = '<span class="bot-avatar-letter">M</span>';
        }}
      />
    </div>
  );
}

/**
 * Mémoïsé : ne recalcule parseMarkdown que lorsque `content` change réellement.
 * Sans ça, chaque chunk du message en cours de streaming force le re-parsing
 * de tous les messages bot précédents du thread à chaque render.
 */
const BotMessage = memo(function BotMessage({
  content,
  isLast,
  onRegenerate,
  responseId,
}: {
  content: string;
  isLast: boolean;
  onRegenerate: () => void;
  responseId?: string;
}) {
  return (
    <div className="message message-bot">
      <BotAvatar />
      <div className="bot-content-wrap">
        <div className="bot-content">{parseMarkdown(content)}</div>
        <MessageActions
          content={content}
          onRegenerate={isLast ? onRegenerate : undefined}
          responseId={responseId}
        />
      </div>
    </div>
  );
});

const Thread = forwardRef<ThreadHandle, Props>(function Thread(
  { messages, showWelcome, onPick, onRegenerate, onRetry, loading },
  ref
) {
  const threadRef = useRef<HTMLDivElement>(null);
  const { lang } = useLang();
  const tr = t(lang);

  useImperativeHandle(ref, () => ({
    scrollToUserMessage() {
      const thread = threadRef.current;
      if (!thread) return;
      const userBubbles = thread.querySelectorAll<HTMLElement>(".message-user");
      const last = userBubbles[userBubbles.length - 1];
      if (last) last.scrollIntoView({ block: "start", behavior: "smooth" });
    },
  }));

  const lastBotIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "bot") return i;
      if (messages[i].type === "typing") return -1; // en cours de génération, pas encore "dernier stable"
    }
    return -1;
  })();

  return (
    <div className="thread" ref={threadRef}>
      <div className="thread-inner">
        {showWelcome && <Welcome onPick={onPick} />}

        {messages.map((msg, i) => {
          if (msg.type === "user") {
            return (
              <div key={i} className="message message-user">
                <div className="user-bubble">{msg.text}</div>
              </div>
            );
          }
          if (msg.type === "bot") {
            return (
              <BotMessage
                key={i}
                content={msg.content}
                isLast={i === lastBotIndex && !loading}
                onRegenerate={onRegenerate}
                responseId={msg.responseId}
              />
            );
          }
          if (msg.type === "error") {
            return (
              <div key={i} className="message message-error">
                <div className="bot-avatar" style={{ background: "var(--error-text)" }}>
                  <span className="bot-avatar-letter">!</span>
                </div>
                <div className="error-content-wrap">
                  <div className="error-content">{msg.text}</div>
                  {!loading && (
                    <button className="retry-btn" onClick={onRetry}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6M1 20v-6h6" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                      </svg>
                      {tr.retry}
                    </button>
                  )}
                </div>
              </div>
            );
          }
          return <TypingIndicator key={i} stages={tr.thinkingStages ?? [tr.thinking]} />;
        })}
      </div>
    </div>
  );
});

export default Thread;
