import { notFound } from "next/navigation";
import Script from "next/script";
import { LangProvider } from "../lib/LangContext";
import type { Lang } from "../lib/i18n";

export function generateStaticParams() {
  return [{ lang: "fr" }, { lang: "ar" }];
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (lang !== "fr" && lang !== "ar") notFound();
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <>
      {/* S'exécute avant le paint (beforeInteractive, sans requête externe) pour corriger
          les attributs du <html> racine, qu'un layout imbriqué ne peut pas rendre lui-même. */}
      <Script id="lang-attrs" strategy="beforeInteractive">
        {`document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dir=${JSON.stringify(dir)};try{localStorage.setItem("chafafiya:lang",${JSON.stringify(lang)});}catch(e){}`}
      </Script>
      <LangProvider lang={lang as Lang}>{children}</LangProvider>
    </>
  );
}
