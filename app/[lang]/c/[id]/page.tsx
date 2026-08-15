import ChatShell from "../../ChatShell";
import type { Lang } from "../../../lib/i18n";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  return <ChatShell lang={lang as Lang} conversationId={id} />;
}
