"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LANG_STORAGE_KEY = "chafafiya:lang";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    router.replace(stored === "ar" ? "/ar" : "/fr");
  }, [router]);

  return null;
}
