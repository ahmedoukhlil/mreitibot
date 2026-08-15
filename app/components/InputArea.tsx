"use client";
import { useRef, useEffect, KeyboardEvent } from "react";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled: boolean;
}

export default function InputArea({ value, onChange, onSend, onStop, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { lang } = useLang();
  const tr = t(lang);

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
            placeholder={tr.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
          />
          <div className="input-toolbar">
            {disabled ? (
              <button
                className="send-btn stop-btn"
                type="button"
                onClick={onStop}
                aria-label="Stop"
              >
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
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
            )}
          </div>
        </div>
        <p className="ai-disclaimer">{tr.aiDisclaimer}</p>
      </div>
    </div>
  );
}
