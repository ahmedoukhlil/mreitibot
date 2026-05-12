const ITIE_REQUIREMENT_HINTS = {"1":{"label":"Supervision par le groupe multipartite","summary":"Pilotage du processus par une collaboration gouvernement, entreprises et société civile.","keywords":"groupe multipartite, GMP, gouvernance ITIE, supervision, parties prenantes"},"2":{"label":"Cadre juridique et institutionnel, contrats et licences","summary":"Transparence sur les règles régissant le secteur extractif.","keywords":"cadre légal, licences, contrats, registre, fiscalité extractive, institutions"},"3":{"label":"Exploration et production","summary":"Données sur le potentiel et l'activité réelle du secteur.","keywords":"exploration, production, volumes, réserves, exportations extractives"},"4":{"label":"Collecte des revenus","summary":"Transparence sur les paiements des entreprises et recettes de l'État.","keywords":"revenus, paiements, recettes fiscales, matérialité, rapprochement"},"5":{"label":"Attribution des revenus","summary":"Suivi de l'utilisation de l'argent issu de l'extraction.","keywords":"budget, répartition, transferts infranationaux, gestion des revenus"},"6":{"label":"Dépenses sociales et environnementales","summary":"Impact économique et social au-delà des simples taxes.","keywords":"social, environnement, emploi, quasi-fiscalité, impact"},"7":{"label":"Résultats et impact","summary":"Les données doivent nourrir le débat public et les réformes.","keywords":"impact, débat public, données ouvertes, recommandations, suivi"},"1.1":{"label":"Engagement du gouvernement","summary":"Direction politique de haut niveau.","keywords":"gouvernement, engagement politique, haut niveau, direction, volonté politique"},"1.2":{"label":"Engagement des entreprises","summary":"Participation active des sociétés extractives.","keywords":"entreprises extractives, opérateurs, engagement industrie, sociétés minières et pétrolières"},"1.3":{"label":"Engagement de la société civile","summary":"Participation libre et indépendante.","keywords":"société civile, OSC, indépendance, participation, plaidoyer"},"1.4":{"label":"Groupe multipartite","summary":"Établissement et gouvernance du groupe de supervision.","keywords":"groupe multipartite, GMP, composition, équilibre des collèges, mandat, statuts"},"1.5":{"label":"Plan de travail","summary":"Maintien d'un plan chiffré avec des objectifs mesurables.","keywords":"plan de travail, objectifs mesurables, SMART, calendrier, résultats attendus"},"2.1":{"label":"Cadre juridique","summary":"Description du régime fiscal et des rôles des organismes publics.","keywords":"régime fiscal, législation, cadre juridique, autorités publiques, rôles institutionnels"},"2.2":{"label":"Octroi des licences","summary":"Processus d'attribution et critères de sélection.","keywords":"octroi, attribution, licences, permis, critères de sélection, procédure concurrentielle"},"2.3":{"label":"Registre des licences","summary":"Informations sur les détenteurs et les coordonnées géographiques.","keywords":"registre, titulaires, titres miniers, périmètre géographique, cartographie"},"2.4":{"label":"Divulgation des contrats","summary":"Publication des textes intégraux des contrats et licences.","keywords":"contrats, licences, publication intégrale, transparence contractuelle, textes officiels"},"2.5":{"label":"Propriété effective","summary":"Divulgation des propriétaires réels des entreprises extractives.","keywords":"bénéficiaires effectifs, propriétaires réels, propriété réelle, UBO, actionnariat effectif, chaîne de contrôle"},"2.6":{"label":"Participation de l'État","summary":"Rôle des entreprises publiques et transactions financières liées.","keywords":"entreprises d'État, SOE, participation publique, entreprises publiques extractives, flux financiers État"},"3.1":{"label":"Exploration","summary":"Informations sur les activités de prospection significatives.","keywords":"exploration, prospection, permis d'exploration, activités significatives"},"3.2":{"label":"Production","summary":"Données sur les volumes et les valeurs de production.","keywords":"production, volumes, valeurs, tonnage, barils, revenus production"},"3.3":{"label":"Exportations","summary":"Données sur les volumes et les valeurs des produits exportés.","keywords":"exportations, flux commerciaux, volumes exportés, valeur des exportations"},"4.1":{"label":"Déclaration exhaustive","summary":"Rapprochement des paiements et recettes significatifs.","keywords":"matérialité, seuils, agrégation, rapprochement paiements recettes, déclaration exhaustive"},"4.2":{"label":"Ventes de la part de production de l'État","summary":"Transparence sur la vente de pétrole, gaz ou minerais par l'État.","keywords":"part de production État, ventes publiques, hydrocarbures, minerais, revenus vente"},"4.3":{"label":"Transport","summary":"Revenus tirés du transport des ressources extractives.","keywords":"transport, pipelines, droits de transport, revenus logistiques extractifs"},"4.4":{"label":"Transactions des entreprises d'État","summary":"Flux financiers entre l'État et ses entreprises.","keywords":"entreprises d'État, transferts, transactions internes, dividende, prête-nom"},"5.1":{"label":"Répartition des revenus","summary":"Inscription des revenus au budget national.","keywords":"budget national, affectation, loi de finances, revenus extractifs budget"},"5.2":{"label":"Transferts infranationaux","summary":"Revenus reversés aux collectivités locales.","keywords":"collectivités locales, décentralisation, transferts, péréquation, régions"},"5.3":{"label":"Gestion des revenus et dépenses","summary":"Divulgation des politiques de gestion.","keywords":"gestion des ressources, politiques budgétaires, dépenses, fonds souverains, règles de gestion"},"6.1":{"label":"Dépenses sociales et environnementales","summary":"Paiements obligatoires ou volontaires pour le développement social.","keywords":"dépenses sociales, environnementales, développement local, obligations volontaires"},"6.2":{"label":"Quasi-fiscalité","summary":"Dépenses hors budget effectuées par des entreprises d'État.","keywords":"quasi-fiscalité, dépenses hors budget, missions publiques, SOE"},"6.3":{"label":"Contribution du secteur à l'économie","summary":"Emploi, PIB et investissements.","keywords":"emploi, PIB, investissement, contribution macroéconomique, chaîne de valeur"},"6.4":{"label":"Impact environnemental","summary":"Divulgation des rapports d'impact et de réhabilitation.","keywords":"impact environnemental, EIE, réhabilitation, mitigation, biodiversité"},"7.1":{"label":"Débat public","summary":"Accessibilité des rapports pour favoriser la discussion.","keywords":"débat public, consultation, diffusion rapports, participation citoyenne"},"7.2":{"label":"Accessibilité des données","summary":"Publication en format de données ouvertes.","keywords":"open data, données ouvertes, formats réutilisables, API, fichiers structurés"},"7.3":{"label":"Recommandations","summary":"Suivi des leçons tirées pour améliorer la gouvernance.","keywords":"recommandations, plan d'action, suivi EITI, correctifs"},"7.4":{"label":"Examen de l'impact","summary":"Évaluation annuelle des progrès accomplis.","keywords":"évaluation d'impact, progrès annuels, résultats ITIE, performance"}};

function extractAskedRequirement(s) {
  const t = String(s || '').trim();
  const sub = t.match(
    /\bexigence\s+([1-7])[\._]([0-9]{1,2})(?:[\._]([a-z0-9]+))?\b/i,
  );
  if (sub) {
    return sub[3]
      ? `${sub[1]}.${sub[2]}.${sub[3]}`.toLowerCase()
      : `${sub[1]}.${sub[2]}`.toLowerCase();
  }
  const sub2 = t.match(
    /\b(?:l['\u2019]exigence|l'exigence)\s*[:\s]*([1-7])[\._]([0-9]{1,2})(?:[\._]([a-z0-9]+))?\b/i,
  );
  if (sub2) {
    return sub2[3]
      ? `${sub2[1]}.${sub2[2]}.${sub2[3]}`.toLowerCase()
      : `${sub2[1]}.${sub2[2]}`.toLowerCase();
  }
  const sub3 = t.match(/\brequirement\s+([1-7])[\._]([0-9]{1,2})\b/i);
  if (sub3) return `${sub3[1]}.${sub3[2]}`.toLowerCase();
  if (/\b(itie|eiti|norme\s+itie|mreiti|standard\s+itie)\b/i.test(t)) {
    const bare = t.match(/\b([1-7])[\._]([0-9]{1,2})(?:[\._]([a-z0-9]+))?\b/);
    if (bare) {
      return bare[3]
        ? `${bare[1]}.${bare[2]}.${bare[3]}`.toLowerCase()
        : `${bare[1]}.${bare[2]}`.toLowerCase();
    }
  }
  const ch = t.match(/\bexigence\s+([1-7])\b(?!\.[\d])/i);
  if (ch && !/\b[1-7][\._][0-9]/.test(t)) return ch[1];
  return '';
}

function getItieRequirementEntry(hints, id) {
  if (!id || !hints || typeof hints !== 'object') return null;
  const key = String(id).toLowerCase();
  const row = hints[key];
  if (row && typeof row === 'object') return { key, ...row };
  const m = key.match(/^([1-7])\.([0-9]{1,2})\.([a-z0-9]+)$/i);
  if (m) {
    const parent = `${m[1]}.${m[2]}`.toLowerCase();
    const p = hints[parent];
    if (p && typeof p === 'object')
      return {
        key: parent,
        subId: key,
        ...p,
      };
  }
  return null;
}

function buildRequirementSearchSuffix(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const parts = [
    `exigence ${entry.key}`,
    'norme ITIE 2023',
    "note d'orientation",
    'MREITI',
    entry.label,
    entry.summary,
    entry.keywords || '',
  ];
  return parts
    .filter((x) => x != null && String(x).trim() !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRequirementFocusPromptBlock(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const sub =
    entry.subId && entry.subId !== entry.key
      ? ` (sous-référence utilisateur : ${entry.subId})`
      : '';
  const kw = entry.keywords
    ? ` Thèmes et termes pour cadrer la recherche documentaire : ${entry.keywords}.`
    : '';
  return `
FOCUS EXIGENCE ITIE ${entry.key}${sub} — ${entry.label}
Référence (catalogue national / norme) : ${entry.summary}${kw}
- Base ta réponse sur des passages qui concernent clairement cette exigence (${entry.key}), la norme ITIE 2023 ou tout document de référence ITIE présent dans les extraits (notes d'orientation, texte normatif, etc.).
- Privilégie notes d'orientation et norme quand ils couvrent la question ; tous les extraits pertinents pour ${entry.key} sont utilisables pour le fond (voir la règle DISCRÉTION sur la formulation si elle figure dans le prompt principal).
- Ne substitue pas une autre sous-exigence du même chapitre si le passage ne fait pas le lien explicite avec ${entry.key}.
- Si aucun extrait ne couvre ${entry.key} ou ses thèmes, dis-le brièvement plutôt que d'expliquer une autre exigence à la place.
`;
}
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

const isProblem =
  /en cas (de|d'|du)|que faire|doit[- ]on faire|faut[- ]il faire|comment (resoudre|traiter|gerer|remedier|corriger|regler)|que se passe|probleme|problematique|difficulte|ecart|conflit|desaccord|non[- ]conformite|manquement|anomalie|insuffisan|defaut|obstacle|blocage|risque|litige|divergen|que faire si/i.test(loweredOrig);

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

const sourceUrls = new Map();
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

    const url = (typeof meta.source_url === 'string' && meta.source_url.startsWith('http') ? meta.source_url : null) || (typeof meta.source === 'string' && meta.source.startsWith('http') ? meta.source : null) || (typeof meta.source_path === 'string' && meta.source_path.startsWith('http') ? meta.source_path : null);
    if (url) sourceUrls.set(i + 1, url);
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
    : `Tu es Chafafiya AI, assistant ITIE/MREITI.

SITUATION : Aucun extrait pertinent trouvé dans la base documentaire pour la question : "${question}"${histNoDoc}

INSTRUCTIONS :
- Réponds en français professionnel, 2 à 3 phrases maximum.
- Explique que la base documentaire ne contient pas d'extrait correspondant à cette question précise.
- Propose une reformulation utile : suggère d'utiliser le numéro d'exigence (ex. « exigence 2.5 »), un terme technique ITIE (« propriété effective », « matérialité », « groupe multipartite »), ou de préciser le thème (transparence, revenus, licences, validation…).
- Reste encourageant et professionnel — l'utilisateur doit avoir envie de reformuler.
- INTERDIT : donner une définition ou explication ITIE tirée de tes connaissances générales.`;

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
MODE : MISE EN ŒUVRE D'UNE EXIGENCE

Tu agis comme un conseiller opérationnel. Structure ta réponse en 4 blocs distincts séparés par une ligne vide :

**Ce que demande la norme**
Résume en 1-2 phrases l'obligation centrale de l'exigence selon les extraits [n]. Ce bloc est OBLIGATOIRE et doit toujours apparaître en premier.

**Comment la mettre en œuvre**
Liste d'étapes numérotées en continu (1. 2. 3. …). La numérotation NE DOIT PAS se réinitialiser entre les étapes. FORMAT STRICT pour chaque étape :

1. **[Titre court de l'étape]**
   - Action : [action précise à réaliser]
   - Acteur : [gouvernement / GMP / entreprises extractives / Administrateur Indépendant]
   - Livrable : [rapport, registre, formulaire, délibération…]
   - Référence : (voir [n])

2. **[Titre court de l'étape suivante]**
   - Action : [...]
   - Acteur : [...]
   - Livrable : [...]
   - Référence : (voir [n])

RÈGLES STRICTES : numérotation continue sans interruption. INTERDIT d'utiliser un titre **gras seul** sans numéro devant. INTERDIT de repartir à 1 en milieu de liste.

**Points critiques et pièges à éviter**
Difficultés fréquentes de mise en œuvre mentionnées dans les extraits.

**Ressources disponibles**
Si les extraits mentionnent des notes d'orientation, modèles ou formulaires ITIE, liste-les avec leur lien si disponible.

RÈGLES MODE IMPL :
- Sois direct et précis — pas de généralités, chaque étape doit pouvoir être exécutée immédiatement.
- EXHAUSTIVITÉ ABSOLUE : liste TOUTES les étapes présentes dans les extraits, sans exception ni résumé. Si la note d'orientation liste 8 étapes, ta réponse doit en présenter 8. Ne regroupe pas, ne condense pas.
- Si les extraits sont en anglais, traduis chaque étape fidèlement en français avant de la présenter.
- Si une étape n'est pas couverte par les extraits, utilise ton expertise ITIE et marque-la (expertise ITIE).
- Ne répète pas l'intitulé exact de l'exigence au-delà de la partie 1.
`;
}
 else if (isFactualEntityQuestion) {
  modeBlock = `
MODE : RÉPONSE FACTUELLE (LISTES, PÉRIMÈTRE, ENTITÉS)

- Réponds uniquement si les extraits contiennent explicitement l'information demandée (listes, critères, catégories, obligations liées à la question).
- Si les extraits ne traitent pas le sujet clairement : une réponse courte (3 à 5 phrases) indiquant que les documents disponibles ne permettent pas de répondre précisément. INTERDIT d'ajouter une définition générale de l'ITIE ou du MREITI pour combler.
- Ne crée pas de section « Définition » générique de l'ITIE dans ce cas.
- Tu peux proposer une reformulation ou des mots-clés seulement si ces termes figurent dans les extraits ; sinon invite à consulter les textes officiels sans inventer de numéros d'exigence.
`;
} else if (isProblem) {
  modeBlock = `
MODE : RÉSOLUTION DE PROBLÉMATIQUE

Tu réponds en conseiller qui aide à résoudre un problème concret rencontré dans la mise en œuvre de l'ITIE. Tu ne décris PAS une exigence — tu proposes des SOLUTIONS tirées strictement des extraits documentaires.

Structure ta réponse ainsi :

**Diagnostic**
Identifie brièvement la nature du problème soulevé (1-2 phrases) en t'appuyant sur les extraits [n].

**Solutions recommandées**
Liste numérotée de solutions concrètes et applicables immédiatement, tirées des extraits. FORMAT :

1. **[Titre court de la solution]**
   - Action : [ce qu'il faut faire concrètement]
   - Acteur : [qui doit agir]
   - Résultat attendu : [ce que ça résout]
   - Référence : (voir [n])

**Mesures préventives**
Si les extraits mentionnent des mécanismes pour éviter que le problème se reproduise, liste-les en puces.

**Références ITIE applicables**
Cite les exigences ou notes d'orientation directement pertinentes pour ce problème.

RÈGLES :
- Chaque solution doit être ancrée dans un extrait [n]. Si aucune solution n'est dans les extraits, dis-le clairement.
- Ne transforme PAS la réponse en explication générale de la norme.
- Reste orienté vers l'action corrective et la résolution.
`;
} else if (isDefinitionPack) {
  modeBlock = `
MODE : DÉFINITION / PRÉSENTATION

STRUCTURE :
- Commence par une définition concise (1-2 phrases) ancrée dans les extraits [n].
- Développe en 1 à 2 paragraphes fluides : contexte, objectif, portée.
- Si l'exigence a des composantes distinctes (a, b, c…), une courte liste à puces est appropriée avec (voir [n]) pour chaque élément.

RÈGLES :
- Pas de titres Markdown (###) sauf si demandé explicitement.
- Chaque idée factuelle = un extrait [n] identifiable.
- N'assimile pas à des « objectifs de la norme ITIE » des passages qui parlent d'autre chose.
- INTERDIT : liste générique non ancrée dans les extraits.
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
Tu es Chafafiya AI, conseiller expert en mise en œuvre de la Norme ITIE 2023, au service de MREITI (Initiative pour la Transparence des Industries Extractives — Mauritanie).

Ton rôle est d'accompagner concrètement les parties prenantes — gouvernement, entreprises extractives, société civile, auditeurs — dans l'application opérationnelle des 7 exigences de la Norme ITIE 2023.

Tu te bases exclusivement sur les notes d'orientation officielles de l'ITIE (eiti.org) disponibles dans les extraits documentaires ci-dessous. Chaque conseil pratique, chaque étape de mise en œuvre, chaque recommandation que tu donnes doit être tirée directement de ces extraits.

Ton ton est celui d'un conseiller expérimenté : direct, orienté action, précis.

SOURCES DOCUMENTAIRES (extraits numérotés issus de eiti.org — base exclusive de ta réponse) :
${contexte}

${conversationSection}QUESTION :
${question}
${incompletBlock}
${requirementFocusBlock}
${modeBlock}
${validationDiscretionBlock}

IDENTITÉ : Si l'utilisateur demande qui t'a développé, créé ou conçu, réponds uniquement : « Ce chatbot a été développé par Ahmedou Khlil, Responsable de Divulgation Systematique ITIE Mauritanie. » Ne mentionne aucune autre technologie ni outil tiers.

TERMINOLOGIE OBLIGATOIRE : Utilise toujours la terminologie exacte de la Norme ITIE 2023. En particulier :
- Dis toujours "Administrateur Indépendant" (jamais "auditeur" seul, ni "expert indépendant")
- Dis "Groupe Multipartite" ou "GMP" ou "Comité National" (jamais "GMP" qui est l'acronyme anglais, jamais "groupe de travail" sans précision)
- Dis "entreprises extractives" (jamais "sociétés" seul)
- Dis "note d'orientation" (jamais "guide" ou "manuel" sauf si c'est le titre exact du document)

RÈGLES DE RÉPONSE :
1. SOURCES STRICTES : chaque affirmation, étape ou recommandation doit être tirée d'un extrait [n] identifié. N'invente rien qui ne figure pas dans les extraits.
2. ORIENTATION ACTION : formule chaque point comme un conseil opérationnel concret (quoi faire, qui, comment) — pas comme une description abstraite de la norme. Si l'extrait dit « les États membres doivent publier… », traduis-le en « Publiez… en suivant les étapes : … ».
3. PRÉCISION EXIGENCE : si la question porte sur une exigence précise (ex. 2.5), centre ta réponse sur cette exigence uniquement.
4. HONNÊTETÉ : si les extraits ne couvrent pas suffisamment la question pour donner un conseil pratique complet, dis-le clairement et indique quels aspects sont couverts.
5. COHÉRENCE : une seule position par réponse. Pas de contradictions, pas de généralités sans appui documentaire.
6. FIL DE DIALOGUE : enchaîne naturellement si l'utilisateur fait référence à un échange précédent.
7. SOURCES : cite toujours (voir [n]) après chaque point tiré d'un extrait. Ne mentionne jamais « blob », « binary », ni un nom de fichier brut.
8. LIENS SOURCES : si le prompt contient une section SOURCES avec des URLs, ajoute en fin de réponse une section **Sources :** avec les liens Markdown vers les pages eiti.org des extraits cités.
9. EXHAUSTIVITÉ DES ÉTAPES : lorsque les extraits proviennent d'une note d'orientation officielle ITIE (note d'orientation, guidance note, implementation guidance), tu DOIS reproduire et détailler TOUTES les étapes mentionnées dans ces extraits sans en omettre aucune. Numérote chaque étape clairement. Si une étape contient des sous-étapes, détaille-les également.
10. LANGUE FRANÇAISE OBLIGATOIRE : ta réponse doit toujours être rédigée en français, même si les extraits documentaires sont en anglais. Traduis fidèlement tout contenu anglais extrait des notes d'orientation. Ne laisse aucun passage en anglais dans ta réponse finale.

TON ET FORMAT :
- Français professionnel, fluide et accessible — adapté à un expert comme à un novice ITIE.
- Structure tes réponses : contexte bref → contenu structuré → synthèse si utile.
- NUMÉROTATION OBLIGATOIRE : toute liste d'étapes, de mesures ou d'actions DOIT être présentée sous forme de liste numérotée (1. 2. 3. …), jamais en puces (-) ni en paragraphes continus. Chaque étape = un numéro distinct. Les sous-détails de chaque étape (action, acteur, livrable, référence) utilisent des tirets indentés (   - texte).
- Les définitions et explications contextuelles utilisent des paragraphes. Les critères, obligations et listes d'entités utilisent des puces (-).
- Évite : « CONTEXTE », « prompt », « RAG », « extrait système », « selon mes données ».
- Préfère : « selon la Norme ITIE 2023 », « d'après la note d'orientation », « conformément à l'exigence X.Y ».

RÉPONSE :
`;

// Build sources block from collected URLs
const sourcesLines = [];
for (const [sIdx, sUrl] of sourceUrls.entries()) {
  sourcesLines.push(`[${sIdx}] ${sUrl}`);
}
const sourcesBlock = sourcesLines.length
  ? `

SOURCES :
` + sourcesLines.join(`
`)
  : '';
const promptFinal = prompt + sourcesBlock;

return [
  {
    json: {
      prompt: promptFinal,
      question,
      contexte,
      sources: Object.fromEntries(sourceUrls),
      retrieval_errors: retrievalErrors,
      retrieval_metrics: retrievalMetrics,
      chunks_retrieved: chunksRetrieved,
      chunks_used: chunksUsed,
    },
  },
];
