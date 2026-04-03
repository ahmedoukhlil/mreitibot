/**
 * Met à jour le nœud « Code in JavaScript » (context builder) dans RAG-chat (4).json
 * — libellés de source propres (pas « blob ») + instructions anti-hallucination.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wfPath = path.join(__dirname, "..", "RAG-chat (4).json");

const newCode = `const b = $('Code in JavaScript3').first().json.body ?? {};
const question =
  b.chatInput ||
  b.originalQuestion ||
  $('Webhook').first()?.json?.body?.chatInput ||
  '';

const docs = $input.all();

function resolveDocLabel(meta, idx) {
  const raw =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  const candidates = [
    raw.source,
    raw.filename,
    raw.file_path,
    raw.filePath,
    raw.path,
    raw.title,
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
    return s.length > 160 ? \`\${s.slice(0, 157)}…\` : s;
  }
  return \`Réf. \${idx + 1}\`;
}

const qTrim = (question || '').trim();
const questionLooksIncomplete =
  qTrim.length < 16 ||
  /['\\u2019]\\s*$/i.test(qTrim) ||
  (!/[.?!]$/.test(qTrim) && qTrim.split(/\\s+/).length <= 4);

const filteredDocs = docs.filter((d) => {
  const content = (
    d.json?.document?.pageContent ||
    d.json?.pageContent ||
    d.json?.text ||
    ''
  ).toLowerCase();

  const score = d.json?.score ?? 0.5;

  return content.length > 50 && score > 0.2;
});

const relevantDocs = filteredDocs.length > 0 ? filteredDocs : docs;

const MAX_LENGTH = 3000;
let totalLength = 0;

const contexte = relevantDocs
  .map((d, i) => {
    let content = (
      d.json?.document?.pageContent ||
      d.json?.pageContent ||
      d.json?.text ||
      ''
    )
      .replace(/\\s+/g, ' ')
      .trim();

    if (!content) return null;

    const meta = d.json?.document?.metadata || d.json?.metadata || {};
    const label = resolveDocLabel(meta, i);

    totalLength += content.length;

    if (totalLength > MAX_LENGTH) return null;

    return \`[\${i + 1}] [Fichier: \${label}]\\n\${content}\`;
  })
  .filter(Boolean)
  .join('\\n\\n');

if (!contexte || contexte.length < 20) {
  const noContextPrompt = \`L'utilisateur a posé cette question : "\${question}"

Aucun document pertinent n'a été trouvé dans la base ITIE/MREITI.
Si c'est une salutation ou question générale, réponds naturellement en français et invite l'utilisateur à poser une question précise sur les normes ITIE, les obligations des entreprises extractives ou les rapports MREITI.
Sinon, indique poliment que tu n'as pas trouvé d'information pertinente dans les documents disponibles et suggère de reformuler la question.\`;
  return [
    {
      json: {
        prompt: noContextPrompt,
        question,
        contexte: '',
      },
    },
  ];
}

const incompletBlock = questionLooksIncomplete
  ? \`\\nATTENTION: La QUESTION semble incomplète ou trop vague. Ne complète pas avec tes connaissances générales : demande poliment de préciser le sujet (ex. ITIE, MREITI, obligations, rapport type…) et ne cite que le CONTEXTE si tu réponds.\`
  : '';

const prompt = \`
Tu es un assistant expert du secteur extractif (ITIE/MREITI), spécialisé dans l'analyse documentaire.

CONTEXTE DOCUMENTAIRE:
\${contexte}

QUESTION:
\${question}
\${incompletBlock}

INSTRUCTIONS:
- Réponds UNIQUEMENT à partir du CONTEXTE ci-dessus (aucune connaissance externe, aucune supposition).
- Ne jamais inventer de citations, de numéros de page, ni de noms de fichiers qui ne figurent pas dans les lignes [n] [Fichier: ...].
- INTERDIT d'écrire « Source: blob », « binary », ou tout libellé de fichier absent du contexte.
- Pour citer une idée, utilise le numéro du passage : ex. « d'après [2] » ou « (voir [1]) », en t'appuyant sur le texte de ce passage uniquement.
- Si l'information n'apparaît pas clairement dans le CONTEXTE, répondre exactement :
  "Cette information ne figure pas dans les documents disponibles"
- Ignore les passages non pertinents pour la question.

STRUCTURE DE LA RÉPONSE:
- Réponse claire et structurée
- Listes numérotées si pertinent
- Chaque affirmation factuelle importante doit renvoyer au numéro de passage [n] utilisé

STYLE:
- Français professionnel
- Réponse concise mais complète
- Pas d'introduction inutile

RÉPONSE:
\`;

return [
  {
    json: {
      prompt,
      question,
      contexte,
    },
  },
];
`;

const j = JSON.parse(fs.readFileSync(wfPath, "utf8"));
const n = j.nodes.find((x) => x.name === "Code in JavaScript");
if (!n) throw new Error("Nœud Code in JavaScript introuvable");
n.parameters.jsCode = newCode;
fs.writeFileSync(wfPath, JSON.stringify(j, null, 2), "utf8");
console.log("OK:", wfPath);
