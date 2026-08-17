"use client";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

interface Props {
  status?: "final" | "provisional";
}

export default function StatusBadge({ status }: Props) {
  const { lang } = useLang();
  const tr = t(lang);

  if (!status) return null;

  if (status === "provisional") {
    return (
      <span className="status-badge status-badge-provisional">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 9v4M12 17h.01M10.3 3.9L2 20h20L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
        {tr.badgeProvisional}
      </span>
    );
  }

  return (
    <span className="status-badge status-badge-final">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {tr.badgeFinal}
    </span>
  );
}
