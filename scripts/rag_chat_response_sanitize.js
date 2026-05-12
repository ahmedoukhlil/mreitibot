function envStr(name) {
  try {
    if (typeof process === 'undefined') return '';
    const pe = process.env;
    if (!pe || typeof pe[name] !== 'string') return '';
    return pe[name];
  } catch (_) {
    return '';
  }
}

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
  const mc = o.message?.content;
  if (typeof mc === 'string' && mc.trim()) return mc.trim();
  if (Array.isArray(mc)) {
    let s = '';
    for (let k = 0; k < mc.length; k++) {
      const p = mc[k];
      if (typeof p === 'string') s += p;
      else if (p && typeof p.text === 'string') s += p.text;
    }
    if (s.trim()) return s.trim();
  }
  if (typeof o.text === 'string' && o.text.trim()) return o.text.trim();
  if (typeof o.response === 'string' && o.response.trim())
    return o.response.trim();
  return '';
}

function maxCitationFromContext(contexte) {
  const ctx = String(contexte || '');
  const re = /\[(\d+)\]/g;
  let m;
  let max = 0;
  while ((m = re.exec(ctx)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
}

function stripRagMetaParagraphs(text) {
  const chunks = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = chunks.filter((p) => {
    const low = p.toLowerCase();
    if (/^#{0,3}\s*\*{0,2}\s*nota\s+bene\b/i.test(p)) return false;
    if (/^nota\s+bene\s*:/i.test(low)) return false;
    if (/^nb\s*:/i.test(low)) return false;
    if (/^\*{0,2}\s*nota\s+bene\b/i.test(low)) return false;
    return true;
  });
  return kept.join('\n\n').trim();
}

function responseQualityWarnings(response, contexte) {
  const warnings = [];
  const maxRef = maxCitationFromContext(contexte);
  const res = String(response || '');
  const citeRe = /\[(\d+)\]/g;
  let m;
  while ((m = citeRe.exec(res)) !== null) {
    const n = parseInt(m[1], 10);
    if (maxRef > 0 && n > maxRef) {
      warnings.push('citation_hors_contexte');
      break;
    }
  }
  const low = res.toLowerCase();
  if (/source:\s*blob/.test(low) || /fichier:\s*blob/.test(low)) {
    warnings.push('source_invalide');
  }
  return warnings;
}

const raw = $input.first().json;
let response =
  extractAssistantText(raw) ||
  extractAssistantText(raw?.output) ||
  extractAssistantText(raw?.data) ||
  '';

if (!response) {
  return [
    {
      json: {
        response: "Désolé, je n'ai pas pu générer de réponse.",
      },
    },
  ];
}

const stripped = stripRagMetaParagraphs(response);
if (stripped.length >= 24) {
  response = stripped;
}

const ctxItem = $('Code in JavaScript').first()?.json ?? {};
const contexte = ctxItem.contexte != null ? String(ctxItem.contexte) : '';

const strictOff = /^(0|false|off|no)$/i.test(
  envStr('RAG_STRICT_CITATION').trim(),
);

const warnings = responseQualityWarnings(response, contexte);

const FALLBACK =
  "Je ne peux pas confirmer cette réponse à partir des extraits fournis. Veuillez reformuler votre question ou préciser le sujet (exigence, norme ITIE, rapport MREITI).";

if (warnings.length > 0 && contexte.length >= 20) {
  if (strictOff) {
    response +=
      "\n\n⚠️ Attention : certains éléments (citations ou sources) ne correspondent pas aux passages indexés ; vérifiez dans les documents officiels.";
  } else {
    response = FALLBACK;
  }
}

return [
  {
    json: {
      response,
      warnings,
    },
  },
];
