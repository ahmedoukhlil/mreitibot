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
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "ar" || stored === "fr" ? stored : "fr";
}

export function LangProvider({ children }: { children: ReactNode }) {
  // Toujours "fr" au premier rendu (serveur ET client) pour éviter un mismatch
  // d'hydration : la vraie langue stockée n'est appliquée qu'après montage.
  const [lang, setLang] = useState<Lang>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLang(readStoredLang());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang, mounted]);

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
