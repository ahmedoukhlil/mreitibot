"use client";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { Lang } from "./i18n";
import { swapLangInPath } from "./i18n";

const LANG_STORAGE_KEY = "chafafiya:lang";

/** Bascule /fr <-> /ar en conservant le reste du chemin (ex. /fr/c/abc -> /ar/c/abc), avec un fondu si le navigateur le supporte. */
export function useLangSwitch() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (target: Lang) => {
      const dest = swapLangInPath(pathname, target);
      const nav = () => {
        window.localStorage.setItem(LANG_STORAGE_KEY, target);
        router.push(dest);
      };
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (typeof doc.startViewTransition === "function") {
        doc.startViewTransition(nav);
      } else {
        nav();
      }
    },
    [router, pathname],
  );
}
