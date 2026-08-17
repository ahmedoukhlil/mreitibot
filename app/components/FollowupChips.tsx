"use client";
import { useLang } from "../lib/LangContext";
import { t } from "../lib/i18n";

interface Props {
  suggestions: string[];
  onPick: (q: string) => void;
}

export default function FollowupChips({ suggestions, onPick }: Props) {
  const { lang } = useLang();
  const tr = t(lang);

  if (!suggestions.length) return null;

  return (
    <div className="followup-chips" aria-label={tr.followupLabel}>
      {suggestions.map((s, i) => (
        <button key={i} className="followup-chip" onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
