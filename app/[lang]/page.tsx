import ChatShell from "./ChatShell";
import type { Lang } from "../lib/i18n";

export default async function NewChatPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <ChatShell lang={lang as Lang} conversationId={null} />;
}
