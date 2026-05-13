import type { Metadata } from "next";
import { Poppins, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { LangProvider } from "./lib/LangContext";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "MREITI BOT — MREITI",
  description: "MREITI BOT — Assistant documentaire MREITI / ITIE Mauritanie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${notoArabic.variable}`}>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
