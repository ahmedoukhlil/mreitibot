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

function envInt(name, def) {
  const v = envStr(name).trim();
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function envFloat(name, def) {
  const v = envStr(name).trim();
  if (!v) return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function envIntOptional(name) {
  const v = envStr(name).trim();
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeChatHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = String(m.role || '').toLowerCase();
    const label =
      role === 'user'
        ? 'Utilisateur'
        : role === 'assistant' || role === 'bot'
          ? 'Assistant'
          : '';
    if (!label) continue;
    const content = String(m.content ?? m.text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!content) continue;
    out.push({ label, content });
  }
  return out;
}

function formatChatHistoryBlock(raw, maxMessages, maxCharsPerMsg) {
  const items = normalizeChatHistory(raw).slice(-maxMessages);
  if (!items.length) return '';
  const lines = items.map((m) => {
    let c = m.content;
    if (c.length > maxCharsPerMsg) c = `${c.slice(0, maxCharsPerMsg)}…`;
    return `${m.label}: ${c}`;
  });
  return `CONVERSATION RÉCENTE (pronoms, raccourcis et enchaînements ; le fond normatif vient uniquement des DOCUMENTS ci-dessus) :\n${lines.join('\n')}`;
}

const b = $('Code in JavaScript3').first().json.body ?? {};
const wh = $('Webhook').first()?.json;
const chatHistoryFromWebhook = Array.isArray(wh?.body?.chatHistory)
  ? wh.body.chatHistory
  : Array.isArray(wh?.chatHistory)
    ? wh.chatHistory
    : null;
const question =
  b.chatInput ||
  b.originalQuestion ||
  wh?.body?.chatInput ||
  wh?.chatInput ||
  '';

const queryType = String(b.queryType || 'general').toLowerCase();
const originalForDetect = String(
  b.originalQuestion || b.chatInput || question || '',
).trim();
const loweredOrig = originalForDetect.toLowerCase();

function userAsksAboutItieValidation(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    /\bvalidation\b/.test(t) ||
    /guide\s*(de\s*la\s*)?validation/.test(t) ||
    /procedure\s*(de\s*)?validation/.test(t) ||
    /criteres?\s*(de\s*)?validation/.test(t) ||
    /processus\s+de\s+validation/.test(t) ||
    /\bevaluation\s+ciblee\b/.test(t) ||
    /\bbar[eè]me\s+de\s+validation\b/.test(t) ||
    /\bconformit[eé].*validation\b/.test(t)
  );
}

const userMentionsValidation = userAsksAboutItieValidation(originalForDetect);

const askedReq = extractAskedRequirement(originalForDetect);
const reqEntry = getItieRequirementEntry(ITIE_REQUIREMENT_HINTS, askedReq);

const histMaxMsg = envInt('RAG_HISTORY_MAX_MESSAGES', 8);
const histMaxChars = envInt('RAG_HISTORY_MAX_CHARS_PER_MSG', 650);
const chatHistoryResolved = Array.isArray(b.chatHistory)
  ? b.chatHistory
  : chatHistoryFromWebhook || [];
const conversationBlock = formatChatHistoryBlock(
  chatHistoryResolved,
  histMaxMsg,
  histMaxChars,
);

const isGreeting =
  queryType === 'greeting' ||
  (/^(bonjour|bonsoir|salut|coucou|hello|hi|hey|bonne journée|bonne soirée)\b/i.test(
    originalForDetect,
  ) &&
    originalForDetect.length < 140 &&
    !/\?/.test(originalForDetect) &&
    originalForDetect.split(/\s+/).length <= 15);

const isImplementation =
  queryType === 'implementation' ||
  (queryType === 'procedure' &&
    /mettre en oeuvre|mise en oeuvre|mise en œuvre|comment mettre|comment appliquer|exigence|orientation|guidance|standard/i.test(
      loweredOrig,
    )) ||
  /mettre en oeuvre|mise en oeuvre|mise en œuvre|comment mettre en|comment appliquer|étapes.*(exigence|mise)|exigence\s*[0-9]/i.test(
    loweredOrig,
  ) ||
  /explique[rz]?\s+.*\bexigence\b|décri(re|vez)|détail.*\bexigence\b|portée\s+de\s+l['\u2019]exigence|qu['\u2019]est-?ce\s+que\s+l['\u2019]exigence/i.test(
    loweredOrig,
  );

const isDefinitionPack =
  queryType === 'definition' ||
  queryType === 'obligation' ||
  /c'est quoi|cest quoi|qu'est-ce|qu est-ce|définition|definition|présent|presente|presenter|rappel.*(itie|eiti|mreiti)|quest ce que l'|quoi l'itie/i.test(
    loweredOrig,
  );

const isFactualEntityQuestion =
  /quelles?\s+sont|quels?\s+sont|liste\s+(des|les|\d)|entreprises?[^.\n]{0,120}(état|etat|public|publique)|sociétés?[^.\n]{0,80}(état|etat|public)|périmètre[^.\n]{0,60}entreprise|entreprises?\s+publiques?|quelle\s+société|quelles\s+sociétés|soe\b/i.test(
    loweredOrig,
  );

const RAG_BOT_AUTHOR_REPLY_FR =
  'Ahmedou Khlil, Responsable de la Divulgation Systematique de Données à ITIE Mauritanie';

function userAsksAboutBotAuthor(text) {
  const t = String(text || '').trim();
  if (t.length > 240) return false;
  return (
    /\bqui\s+(t['\u2019]a|vous\s+a)\s+(a\s+)?(d[eé]velopp|developp|con[cç]u|concu|cr[éeé]e?|programm|imagin|fa[iî]t|mis\s+au\s+point)/i.test(
      t,
    ) ||
    /\bqui\s+t['\u2019]\s*a\s+(d[eé]velopp|developp|con[cç]u|concu|cr[éeé])/i.test(
      t,
    ) ||
    /\b(d[eé]veloppeur|developpeur|concepteur|cr[eé]ateur|auteur)\b.{0,48}\b(chafafiya|cet\s+assistant|ce\s+chatbot|toi)\b/i.test(
      loweredOrig,
    ) ||
    /\b(par\s+qui)\b.{0,50}\b(d[eé]velopp|developp|con[cç]u|concu|cr[éeé])\b/i.test(
      loweredOrig,
    ) ||
    /\bqu['\u2019]est-ce\s+qui\s+(t['\u2019]|vous)\s+a\s+(d[eé]velopp|developp|con[cç]u|concu|cr[éeé])/i.test(
      loweredOrig,
    )
  );
}

const isAuthorOrOriginQuestion = userAsksAboutBotAuthor(originalForDetect);

const docs = $input.all();

const retrievalErrors = docs.flatMap((d) => {
  const j = d && d.json ? d.json : {};
  const v = j.retrieval_errors || j.retrievalErrors || j.retrievalError;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'object') return [v];
  return [];
});

const retrievalMetrics = (() => {
  for (const d of docs) {
    const j = d && d.json ? d.json : {};
    const m = j.retrieval_metrics || j.retrievalMetrics;
    if (m && typeof m === 'object') return m;
  }
  return null;
})();

function resolveDocLabel(meta, idx) {
  const raw =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  const candidates = [
    raw.title,
    raw.source,
    raw.filename,
    raw.file_path,
    raw.filePath,
    raw.path,
    raw.pdf,
    raw.name,
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const s = typeof c === 'string' ? c.trim() : String(c).trim();
    if (s.length < 2) continue;
    const low = s.toLowerCase();
    if (
      low === 'blob' ||
      low === 'binary' ||
      low === 'unknown' ||
      low === 'inconnu.pdf' ||
      low.startsWith('[object')
    ) {
      continue;
    }
    if (low === 'application/pdf') continue;
    return s.length > 160 ? `${s.slice(0, 157)}…` : s;
  }
  return `Réf. ${idx + 1}`;
}

if (isAuthorOrOriginQuestion) {
  return [
    {
      json: {
        prompt: `Tu es l'assistant Chafafiya AI (MREITI / ITIE).

QUESTION (responsable du développement ou de la conception de l'assistant) :
"${originalForDetect || question}"

INSTRUCTIONS :
- Ta réponse doit être exactement UNE seule phrase, sans rien ajouter avant ni après (pas de salutation, pas de guillemets, pas de tiret, pas de source).
- Texte obligatoire, caractère par caractère :
${RAG_BOT_AUTHOR_REPLY_FR}

RÉPONSE:`,
        question,
        contexte: '',
      },
    },
  ];
}

if (isGreeting) {
  const histGreeting = formatChatHistoryBlock(chatHistoryResolved, 6, 420);
  const suiteGreeting = histGreeting
    ? `\n\n${histGreeting}\n\nPoursuite de conversation : adapte le ton (remerciement, clôture, relance courte) en cohérence avec cet historique. Ne répète pas une longue explication déjà donnée.`
    : '';
  return [
    {
      json: {
        prompt: `Tu es l'assistant Chafafiya AI pour la transparence des industries extractives (MREITI / ITIE).

Message actuel : "${originalForDetect || question}" (salutation ou politesse).${suiteGreeting}

INSTRUCTIONS:
- Réponds en français, ton professionnel et chaleureux, comme dans un échange naturel.
- S'il s'agit d'un premier contact : salue brièvement et propose ton aide (définitions ITIE, exigences, rapports MREITI, mise en œuvre).
- S'il s'agit d'une suite de dialogue : réponds de façon brève et liée au fil (sans relecture complète d'un sujet déjà traité).
- Ne cite aucun document ni numéro [n]. N'invente pas de contenu normatif.
- 2 à 5 phrases maximum.

RÉPONSE:`,
        question,
        contexte: '',
      },
    },
  ];
}

const qTrim = (question || '').trim();
const questionLooksIncomplete =
  !isDefinitionPack &&
  !isImplementation &&
  (qTrim.length < 16 ||
    /['\u2019]\s*$/i.test(qTrim) ||
    (!/[.?!]$/.test(qTrim) && qTrim.split(/\s+/).length <= 4));

const MIN_CONTENT_LENGTH = envInt('RAG_MIN_CONTENT_LENGTH', 150);
const MIN_SCORE = envFloat('RAG_MIN_SCORE', 0.28);

function isRepetitiveContent(text) {
  const t = String(text || '')
    .toLowerCase()
    .trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 5) return true;
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  return repetitionRatio < 0.4;
}

function isMetadataOnly(text) {
  const trimmed = String(text || '').trim();
  const metadataPatterns = [
    /^(page|tableau|figure|annexe)\s+\d+/i,
    /^document (confidentiel|interne)/i,
    /^voir (annexe|page|section)/i,
    /^\d+\s+(sur|\/)\s+\d+$/,
  ];
  return metadataPatterns.some((pattern) => pattern.test(trimmed));
}

const filteredDocs = docs.filter((d) => {
  const rawContent =
    d.json?.document?.pageContent ||
    d.json?.pageContent ||
    d.json?.text ||
    '';
  const content = rawContent.trim();
  const contentLower = content.toLowerCase();
  const score = typeof d.json?.score === 'number' ? d.json.score : 0;

  return (
    contentLower.length >= MIN_CONTENT_LENGTH &&
    score >= MIN_SCORE &&
    !isRepetitiveContent(content) &&
    !isMetadataOnly(content)
  );
});

const relevantDocs = filteredDocs.length > 0 ? filteredDocs : docs;

const CONTEXT_LIMITS = {
  greeting: 1000,
  definition: 3000,
  obligation: 3500,
  implementation: 6000,
  procedure: 5000,
  factual: 4000,
  chiffre: 3500,
  liste: 4000,
  comparaison: 4000,
  general: 4000,
};
const CHUNK_LIMITS = {
  greeting: 2,
  definition: 5,
  obligation: 6,
  implementation: 10,
  procedure: 8,
  factual: 7,
  chiffre: 6,
  liste: 7,
  comparaison: 6,
  general: 6,
};

let limitKey = queryType;
if (
  isFactualEntityQuestion &&
  !['implementation', 'definition', 'obligation', 'greeting'].includes(
    queryType,
  )
) {
  limitKey = 'factual';
}

const MAX_LENGTH =
  envIntOptional('RAG_MAX_CONTEXT_CHARS') ??
  (CONTEXT_LIMITS[limitKey] ?? CONTEXT_LIMITS.general);
const maxChunks =
  envIntOptional('RAG_LLM_MAX_CHUNKS') ??
  (CHUNK_LIMITS[limitKey] ?? CHUNK_LIMITS.general);

const maxPerDoc = envInt('RAG_MAX_CHUNKS_PER_DOC', 3);

function diversifyDocs(items, perSource) {
  const counts = {};
  const out = [];
  for (const d of items) {
    const meta = d.json?.document?.metadata || d.json?.metadata || {};
    const sid =
      meta.document_id ||
      meta.source ||
      meta.filename ||
      meta.title ||
      'unknown';
    const key = String(sid);
    const c = counts[key] || 0;
    if (c >= perSource) continue;
    counts[key] = c + 1;
    out.push(d);
  }
  return out;
}

const diversified = diversifyDocs(relevantDocs, maxPerDoc);
const workingDocs =
  diversified.length > 0 ? diversified : relevantDocs;
const cappedDocs = workingDocs.slice(0, maxChunks);
const chunksRetrieved = Array.isArray(workingDocs) ? workingDocs.length : 0;
const chunksUsed = Array.isArray(cappedDocs) ? cappedDocs.length : 0;

let totalLength = 0;

const contexte = cappedDocs
  .map((d, i) => {
    let content = (
      d.json?.document?.pageContent ||
      d.json?.pageContent ||
      d.json?.text ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();

    if (!content) return null;

    const meta = d.json?.document?.metadata || d.json?.metadata || {};
    const label = resolveDocLabel(meta, i);
    const sec =
      typeof meta.section_path === 'string' && meta.section_path.trim()
        ? meta.section_path.trim().slice(0, 140)
        : '';
    const sectionHint = sec ? ` [Section: ${sec}]` : '';

    totalLength += content.length;

    if (totalLength > MAX_LENGTH) return null;

    return `[${i + 1}] [Fichier: ${label}]${sectionHint}\n${content}`;
  })
  .filter(Boolean)
  .join('\n\n');

if (!contexte || contexte.length < 20) {
  const histNoDoc = conversationBlock
    ? `\n\n${conversationBlock}\n\nTu peux faire une phrase de transition qui renvoie au fil de la conversation, sans inventer de contenu documentaire.`
    : '';
  const noContextPrompt = retrievalErrors.length
    ? `SITUATION : Le service de recherche documentaire n'a pas pu fonctionner correctement pour : "${question}".${histNoDoc}

TU DOIS répondre en français par un message très court qui :
- dit que le service de recherche est temporairement indisponible pour répondre précisément ;
- propose de réessayer plus tard (et éventuellement de reformuler avec des mots-clés : exigence, norme ITIE, rapport, transparence, MREITI) ;
- ne donne AUCUNE définition ni détail sur l'ITIE, la norme ou les obligations : interdiction d'utiliser tes connaissances générales.`
    : `SITUATION : Aucun passage pertinent trouvé pour : "${question}"${histNoDoc}

TU DOIS répondre en français par un message très court qui :
- dit que tu n'as trouvé aucun document pertinent dans la base MREITI pour cette question ;
- propose de reformuler (mots-clés : exigence, norme ITIE, rapport, transparence, MREITI) ;
- ne donne AUCUNE définition ni détail sur l'ITIE, la norme ou les obligations : interdiction d'utiliser tes connaissances générales.`;

  return [
    {
      json: {
        prompt: noContextPrompt,
        question,
        contexte: '',
        retrieval_errors: retrievalErrors,
        retrieval_metrics: retrievalMetrics,
        chunks_retrieved: chunksRetrieved,
        chunks_used: chunksUsed,
      },
    },
  ];
}

let modeBlock = '';
if (isImplementation) {
  modeBlock = `
MODE : MISE EN ŒUVRE D'UNE EXIGENCE (procedure / implementation)

STRUCTURE OBLIGATOIRE:
- Utilise des listes à puces (•). Chaque puce = une étape concrète de mise en œuvre, dans l'ordre logique.
- Appuie-toi sur les passages [n] pertinents : notes d'orientation, norme ITIE ou autres documents officiels présents dans les extraits (ne nomme pas le « guide de validation » ni la « validation » au sens ITIE si la règle DISCRÉTION du prompt s'applique).
- Chaque étape importante doit renvoyer au passage utilisé : (voir [n]).
- Si les extraits sont insuffisants, reste factuel et dis ce qui manque en langage utilisateur (sans mot « CONTEXTE »).
`;
} else if (isFactualEntityQuestion) {
  modeBlock = `
MODE : RÉPONSE FACTUELLE (LISTES, PÉRIMÈTRE, ENTITÉS)

- Réponds uniquement si les extraits contiennent explicitement l'information demandée (listes, critères, catégories, obligations liées à la question).
- Si les extraits ne traitent pas le sujet clairement : une réponse courte (3 à 5 phrases) indiquant que les documents disponibles ne permettent pas de répondre précisément. INTERDIT d'ajouter une définition générale de l'ITIE ou du MREITI pour combler.
- Ne crée pas de section « Définition » générique de l'ITIE dans ce cas.
- Tu peux proposer une reformulation ou des mots-clés seulement si ces termes figurent dans les extraits ; sinon invite à consulter les textes officiels sans inventer de numéros d'exigence.
`;
} else if (isDefinitionPack) {
  modeBlock = `
MODE : DÉFINITION / PRÉSENTATION (ITIE, MREITI ou exigence)

- Réponds en un flux continu (1 à 2 paragraphes), sans imposer de titres Markdown (pas de ### Définition / ### Objectifs) sauf si l'utilisateur demande explicitement une structure.
- Chaque idée factuelle doit venir d'au plus un passage [n] à la fois : ne mélange pas un paragraphe sur la communication, un autre sur la gouvernance, etc., comme s'il s'agissait d'une seule liste « objectifs de la norme ».
- N'utilise une liste à puces QUE si tu énumères des éléments qui apparaissent comme tels dans un même passage (ou le même type d'exigence) ; chaque puce a (voir [n]) et reprend le même thème que l'extrait.
- Si un passage parle d'autre chose que la QUESTION (ex. critères SMART, évaluation d'un programme sans lien explicite avec « la norme ITIE »), ne le présente pas comme définition ou objectif de la norme ITIE.
- INTERDIT : section ou sous-titre « Objectifs » rempli de points génériques non étiquetés comme objectifs ITIE/MREITI dans les passages.
`;
}

const incompletBlock = questionLooksIncomplete
  ? `\nATTENTION: La QUESTION semble incomplète ou trop vague. Ne complète pas avec tes connaissances générales : demande poliment de préciser le sujet ; si tu réponds, limite-toi aux passages [n].`
  : '';

const requirementFocusBlock = buildRequirementFocusPromptBlock(reqEntry);

const validationDiscretionBlock = userMentionsValidation
  ? `

VOIX « VALIDATION » : La question évoque la validation ITIE ; tu peux nommer explicitement le guide, la procédure ou les critères de validation si c'est utile, en restant ancré dans les extraits [n].
`
  : `

DISCRÉTION — FORMULATION : Les extraits peuvent inclure le guide de la validation, des procédures ou critères associés au cycle de validation ITIE ; utilise leur contenu pour répondre sans le présenter comme tel dans ta phrase. N'emploie pas dans ta réponse (sauf citation strictement nécessaire d'un titre déjà dans un extrait) : « guide de validation », « procédure de validation », « critères de validation », ni « validation » au sens du cycle d'évaluation ITIE du pays. Préfère « d'après les documents », « selon les passages cités » ou (voir [n]). Si [Fichier: ...] contient le mot « validation », ne le répète pas : reste sur (voir [n]). Tu peux toujours parler de « validation » dans d'autres sens métier (ex. validation de données) si l'extrait l'exige.
`;

const conversationSection = conversationBlock
  ? `${conversationBlock}

`
  : '';

const prompt = `
Tu es un assistant expert du secteur extractif (ITIE/MREITI), spécialisé dans l'analyse documentaire.

DOCUMENTS (extraits numérotés — ta réponse doit s'appuyer uniquement sur ce qui suit) :
${contexte}

${conversationSection}QUESTION ACTUELLE:
${question}
${incompletBlock}
${requirementFocusBlock}
${modeBlock}
${validationDiscretionBlock}

INSTRUCTIONS GÉNÉRALES:
- Réponds UNIQUEMENT à partir des extraits ci-dessus (aucune connaissance externe) pour tout contenu normatif ou factuel issu des textes.
- FIL DE DISCUSSION : si la conversation récente t'aide à interpréter la QUESTION ACTUELLE (ex. « la même chose pour 2.6 », « merci », « peux-tu préciser le premier point »), assume ce lien en une phrase courte en t'appuyant sur les DOCUMENTS pour la substance ; ne répète pas de longs passages déjà couverts sauf si l'utilisateur le redemande clairement.
- RÈGLE ANTI-MÉLANGE : ne regroupe pas sous une même étiquette (objectifs, principes, exigences) des phrases qui, dans les documents, concernent des sujets ou chapitres différents. Une affirmation = un passage [n] clairement lié à la QUESTION.
- ANTI-REMPLISSAGE : si la QUESTION est précise et que les extraits ne couvrent pas ce sujet, dis-le en une courte réponse sans inventer de contenu ni emprunter d'autres rubriques du PDF.
- COHÉRENCE : une seule position par message. INTERDIT : « Nota Bene », « NB », « Note : », ou toute phrase du type « aucun … n'est mentionné » / « rien dans les documents » si tu as déjà donné des listes ou paragraphes de contenu sur ce thème.
- Ne jamais inventer de citations, de numéros de page, ni de noms de fichiers absents des lignes [n] [Fichier: ...].
- INTERDIT d'écrire « Source: blob », « binary », ou un fichier non listé dans les extraits.

LANGAGE À L'UTILISATEUR:
- Français professionnel, ton conversationnel et fluide (tu enchaînes avec l'utilisateur sans être sec).
- N'utilise pas : « CONTEXTE », « prompt », « RAG », « extrait système ». Préfère : « d'après les documents disponibles », « selon les passages cités », « pour reprendre sur ce que nous disions » lorsque c'est pertinent.

RÉPONSE:
`;

return [
  {
    json: {
      prompt,
      question,
      contexte,
      retrieval_errors: retrievalErrors,
      retrieval_metrics: retrievalMetrics,
      chunks_retrieved: chunksRetrieved,
      chunks_used: chunksUsed,
    },
  },
];
