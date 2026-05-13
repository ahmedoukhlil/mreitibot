"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import type { Lang } from "./i18n";

interface LangCtx {
  lang: Lang;
  toggle: () => void;
}

const LangContext = createContext<LangCtx>({ lang: "fr", toggle: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("fr");
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
