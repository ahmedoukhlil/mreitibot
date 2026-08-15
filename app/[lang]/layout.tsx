import { notFound } from "next/navigation";
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
      {/* next/script strategy="beforeInteractive" est réservé au layout racine (app/layout.tsx) —
          interdit dans un layout imbriqué comme celui-ci, ce qui cassait l'hydration entière
          (input/scroll/navigation inertes). On revient donc à un <script> HTML natif classique :
          il s'exécute en flux normal au parsing du HTML, avant que React n'hydrate quoi que ce
          soit, sans jamais être "possédé" par React après coup (suppressHydrationWarning évite
          l'avertissement bénin de React qui détecte ce script comme contenu non contrôlé). */}
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dir=${JSON.stringify(dir)};try{localStorage.setItem("chafafiya:lang",${JSON.stringify(lang)});}catch(e){}`,
        }}
      />
      <LangProvider lang={lang as Lang}>{children}</LangProvider>
    </>
  );
}
