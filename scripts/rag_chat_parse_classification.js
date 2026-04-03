function extractAssistantText(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data.trim();
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const t = extractAssistantText(data[i]);
      if (t) return t;
    }
    return '';
  }
  if (typeof data !== 'object') return String(data);
  const o = data;
  if (typeof o.output === 'string' && o.output.trim()) return o.output.trim();
  const choice = o.choices?.[0]?.message?.content;
  if (typeof choice === 'string' && choice.trim()) return choice.trim();
  const gem =
    o.content?.parts?.[0]?.text ||
    o.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof gem === 'string' && gem.trim()) return gem.trim();
  const blocks = o.content;
  if (Array.isArray(blocks)) {
    const out = [];
    for (let j = 0; j < blocks.length; j++) {
      const b = blocks[j];
      if (typeof b === 'string') out.push(b);
      else if (b && typeof b.text === 'string') out.push(b.text);
    }
    const joined = out.join('').trim();
    if (joined) return joined;
  }
  if (typeof o.text === 'string' && o.text.trim()) return o.text.trim();
  return '';
}

const raw = $input.first().json;
const originalNode = $('Code in JavaScript2').first().json ?? {};

const rawText =
  extractAssistantText(raw) ||
  extractAssistantText(raw?.output) ||
  extractAssistantText(raw?.data) ||
  '{}';

let parsed;
try {
  parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
} catch (e) {
  parsed = {};
}

const originalChat =
  originalNode.body?.chatInput ??
  originalNode.chatInput ??
  originalNode.originalQuestion ??
  '';

let enrichedQuery =
  parsed.enrichedQuery && parsed.enrichedQuery.length > 5
    ? parsed.enrichedQuery
    : originalChat;

const rid = extractAskedRequirement(String(originalChat || ''));
const rentry = getItieRequirementEntry(ITIE_REQUIREMENT_HINTS, rid);
const qSuffix = buildRequirementSearchSuffix(rentry);
if (qSuffix) {
  enrichedQuery = `${enrichedQuery} ${qSuffix}`.replace(/\s+/g, ' ').trim();
}

const baseBody =
  originalNode.body && typeof originalNode.body === 'object'
    ? { ...originalNode.body }
    : {};

const chatHistoryOut = Array.isArray(baseBody.chatHistory)
  ? baseBody.chatHistory
  : [];

return [
  {
    json: {
      ...originalNode,
      body: {
        ...baseBody,
        chatInput: enrichedQuery,
        originalQuestion:
          baseBody.chatInput ?? originalNode.originalQuestion ?? originalChat,
        queryType: parsed.queryType || 'general',
        language: parsed.language || 'fr',
        chatHistory: chatHistoryOut,
      },
    },
  },
];
