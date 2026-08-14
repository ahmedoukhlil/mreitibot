export type StoredRole = "user" | "assistant" | "error";

export interface StoredMessage {
  id: string;
  role: StoredRole;
  content: string;
  ts: number;
}

export interface StoredConversation {
  id: string;
  title: string;
  lang: "fr" | "ar";
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

interface StorageSchema {
  version: 1;
  conversations: StoredConversation[];
}

const STORAGE_KEY = "chafafiya:conversations";
const TITLE_MAX = 40;

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptySchema(): StorageSchema {
  return { version: 1, conversations: [] };
}

function readSchema(): StorageSchema {
  if (typeof window === "undefined") return emptySchema();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySchema();
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && Array.isArray(parsed.conversations)) {
      return parsed as StorageSchema;
    }
    return emptySchema();
  } catch {
    return emptySchema();
  }
}

function writeSchema(schema: StorageSchema): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
  } catch (err) {
    if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
      pruneOldest(schema);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
      } catch {
        // Toujours en échec après élagage : abandon silencieux, rien de plus à faire.
      }
    }
  }
}

/** Supprime les conversations les plus anciennes (LRU par updatedAt) jusqu'à revenir sous ~80% du quota estimé. */
function pruneOldest(schema: StorageSchema): void {
  const sorted = [...schema.conversations].sort((a, b) => a.updatedAt - b.updatedAt);
  const toRemove = Math.max(1, Math.ceil(sorted.length * 0.2));
  const removeIds = new Set(sorted.slice(0, toRemove).map((c) => c.id));
  schema.conversations = schema.conversations.filter((c) => !removeIds.has(c.id));
}

export function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim();
  if (trimmed.length <= TITLE_MAX) return trimmed;
  return trimmed.slice(0, TITLE_MAX).trimEnd() + "…";
}

export function listConversations(): StoredConversation[] {
  return readSchema().conversations.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): StoredConversation | undefined {
  return readSchema().conversations.find((c) => c.id === id);
}

export function createConversation(lang: "fr" | "ar"): StoredConversation {
  const now = Date.now();
  const conv: StoredConversation = {
    id: uid(),
    title: "",
    lang,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const schema = readSchema();
  schema.conversations.push(conv);
  writeSchema(schema);
  return conv;
}

export function saveConversation(conv: StoredConversation): void {
  const schema = readSchema();
  const idx = schema.conversations.findIndex((c) => c.id === conv.id);
  conv.updatedAt = Date.now();
  if (!conv.title) {
    const firstUser = conv.messages.find((m) => m.role === "user");
    if (firstUser) conv.title = deriveTitle(firstUser.content);
  }
  if (idx === -1) schema.conversations.push(conv);
  else schema.conversations[idx] = conv;
  writeSchema(schema);
}

export function renameConversation(id: string, title: string): void {
  const schema = readSchema();
  const conv = schema.conversations.find((c) => c.id === id);
  if (!conv) return;
  conv.title = title.trim() || conv.title;
  conv.updatedAt = Date.now();
  writeSchema(schema);
}

export function deleteConversation(id: string): void {
  const schema = readSchema();
  schema.conversations = schema.conversations.filter((c) => c.id !== id);
  writeSchema(schema);
}

export function newMessage(role: StoredRole, content: string): StoredMessage {
  return { id: uid(), role, content, ts: Date.now() };
}
