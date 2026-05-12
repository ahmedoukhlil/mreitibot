"use client";
import { useRef, useEffect, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function InputArea({ value, onChange, onSend, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [value]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = !disabled && value.trim() !== "";

  return (
    <div className="input-area">
      <div className="input-area-inner">
        <div className="input-box">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Posez votre question sur l'ITIE…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
          />
          <div className="input-toolbar">
            <button
              className="send-btn"
              type="button"
              disabled={!canSend}
              onClick={onSend}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <p className="input-hint">
          <kbd>Enter</kbd> pour envoyer · <kbd>Shift+Enter</kbd> pour nouvelle ligne
        </p>
      </div>
    </div>
  );
}
