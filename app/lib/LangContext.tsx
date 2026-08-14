"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Lang } from "./i18n";

const LANG_STORAGE_KEY = "chafafiya:lang";

interface LangCtx {
  lang: Lang;
  toggle: () => void;
}

const LangContext = createContext<LangCtx>({ lang: "fr", toggle: () => {} });

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "ar" || stored === "fr" ? stored : "fr";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  const toggle = () => setLang((l) => (l === "fr" ? "ar" : "fr"));

  return (
    <LangContext.Provider value={{ lang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
