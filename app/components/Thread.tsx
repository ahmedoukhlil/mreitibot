"use client";
import { forwardRef, useImperativeHandle, useRef } from "react";
import Image from "next/image";
import Welcome from "./Welcome";

export type Message =
  | { type: "user"; text: string }
  | { type: "bot"; html: string }
  | { type: "error"; text: string }
  | { type: "typing" };

export interface ThreadHandle {
  updateLastBot(html: string): void;
  scrollToUserMessage(): void;
}

interface Props {
  messages: Message[];
  showWelcome: boolean;
  onPick: (q: string) => void;
  /** ref vers le conteneur scrollable (.chat-main) passé depuis page.tsx */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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

const Thread = forwardRef<ThreadHandle, Props>(function Thread(
  { messages, showWelcome, onPick, scrollContainerRef },
  ref
) {
  const threadRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    updateLastBot(html: string) {
      const thread = threadRef.current;
      if (!thread) return;
      const nodes = thread.querySelectorAll<HTMLElement>(".bot-content");
      const last = nodes[nodes.length - 1];
      if (last) last.innerHTML = html;
    },
    scrollToUserMessage() {
      const thread = threadRef.current;
      if (!thread) return;
      const userBubbles = thread.querySelectorAll<HTMLElement>(".message-user");
      const last = userBubbles[userBubbles.length - 1];
      if (last) last.scrollIntoView({ block: "start", behavior: "smooth" });
    },
  }));

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
              <div key={i} className="message message-bot">
                <BotAvatar />
                <div
                  className="bot-content"
                  dangerouslySetInnerHTML={{ __html: msg.html }}
                />
              </div>
            );
          }
          if (msg.type === "error") {
            return (
              <div key={i} className="message message-error">
                <div className="bot-avatar" style={{ background: "#c0392b" }}>
                  <span className="bot-avatar-letter">!</span>
                </div>
                <div className="error-content">{msg.text}</div>
              </div>
            );
          }
          return (
            <div key={i} className="typing-wrapper">
              <BotAvatar />
              <div className="typing-text">
                MREITI BOT est en train de réfléchir
                <span className="typing-ellipsis" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default Thread;
