"use client";
import { createContext, useContext, ReactNode } from "react";
import type { Lang } from "./i18n";

interface LangCtx {
  lang: Lang;
}

const LangContext = createContext<LangCtx>({ lang: "fr" });

/** La langue est désormais dérivée du segment d'URL [lang], fourni par la page/layout appelante. */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={{ lang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
