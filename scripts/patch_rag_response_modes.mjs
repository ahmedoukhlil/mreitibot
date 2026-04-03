/**
 * Met à jour « Code in JavaScript » : greeting, définition+objectifs, mise en œuvre (puces).
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

const queryType = String(b.queryType || 'general').toLowerCase();
const originalForDetect = String(
  b.originalQuestion || b.chatInput || question || '',
).trim();
const loweredOrig = originalForDetect.toLowerCase();

const isGreeting =
  queryType === 'greeting' ||
  (/^(bonjour|bonsoir|salut|coucou|hello|hi|hey|bonne journée|bonne soirée)\\b/i.test(
    originalForDetect,
  ) &&
    originalForDetect.length < 140 &&
    !/\\?/.test(originalForDetect) &&
    originalForDetect.split(/\\s+/).length <= 15);

const isImplementation =
  queryType === 'implementation' ||
  (queryType === 'procedure' &&
    /mettre en oeuvre|mise en oeuvre|mise en œuvre|comment mettre|comment appliquer|exigence|orientation|guidance|standard/i.test(
      loweredOrig,
    )) ||
  /mettre en oeuvre|mise en oeuvre|mise en œuvre|comment mettre en|comment appliquer|étapes.*(exigence|mise)|exigence\\s*[0-9]/i.test(
    loweredOrig,
  );

const isDefinitionPack =
  queryType === 'definition' ||
  queryType === 'obligation' ||
  /c'est quoi|cest quoi|qu'est-ce|qu est-ce|définition|definition|présent|presente|presenter|rappel.*(itie|eiti|mreiti)|quest ce que l'|quoi l'itie/i.test(
    loweredOrig,
  );

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

if (isGreeting) {
  return [
    {
      json: {
        prompt: \`Tu es l'assistant Chafafiya AI pour la transparence des industries extractives (MREITI / ITIE).

L'utilisateur écrit : "\${originalForDetect || question}" (salutation ou politesse).

INSTRUCTIONS:
- Réponds en français, ton professionnel et chaleureux.
- Salue brièvement puis demande comment tu peux l'aider (définitions ITIE, exigences de la norme ITIE, rapports MREITI, mise en œuvre d'une exigence, etc.).
- Ne cite aucun document ni numéro [n]. N'invente pas de contenu normatif.
- 2 à 4 phrases maximum.

RÉPONSE:\`,
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
    /['\\u2019]\\s*$/i.test(qTrim) ||
    (!/[.?!]$/.test(qTrim) && qTrim.split(/\\s+/).length <= 4));

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

let modeBlock = '';
if (isImplementation) {
  modeBlock = \`
MODE : MISE EN ŒUVRE D'UNE EXIGENCE (procedure / implementation)

STRUCTURE OBLIGATOIRE:
- Utilise des listes à puces (•). Chaque puce = une étape concrète de mise en œuvre, dans l'ordre logique.
- Appuie-toi en priorité sur les passages du CONTEXTE qui relèvent de la note d'orientation (repère les fichiers ou titres contenant orientation, guidance, note) ET de la norme ITIE.
- Chaque étape importante doit renvoyer au passage utilisé : (voir [n]).
- Si le CONTEXTE ne contient pas assez d'éléments pour séparer la note d'orientation et la norme ITIE, reste factuel et indique ce qui manque dans les extraits.
\`;
} else if (isDefinitionPack) {
  modeBlock = \`
MODE : DÉFINITION / PRÉSENTATION (ITIE, MREITI ou exigence)

STRUCTURE OBLIGATOIRE:
1) Paragraphe « Définition » : 2 à 5 phrases, uniquement à partir du CONTEXTE, avec citations [n].
2) Paragraphe ou section « Objectifs » : liste à puces des objectifs / finalités mentionnés pour ce sujet dans le CONTEXTE ; chaque puce avec (voir [n]) si possible.
3) Si aucun objetif n'apparaît dans le CONTEXTE, indique-le explicitement après la définition (sans inventer).
\`;
}

const incompletBlock = questionLooksIncomplete
  ? \`\\nATTENTION: La QUESTION semble incomplète ou trop vague. Ne complète pas avec tes connaissances générales : demande poliment de préciser le sujet et ne cite que le CONTEXTE si tu réponds.\`
  : '';

const prompt = \`
Tu es un assistant expert du secteur extractif (ITIE/MREITI), spécialisé dans l'analyse documentaire.

CONTEXTE DOCUMENTAIRE:
\${contexte}

QUESTION:
\${question}
\${incompletBlock}
\${modeBlock}

INSTRUCTIONS GÉNÉRALES:
- Réponds UNIQUEMENT à partir du CONTEXTE ci-dessus (aucune connaissance externe).
- Ne jamais inventer de citations, de numéros de page, ni de noms de fichiers absents des lignes [n] [Fichier: ...].
- INTERDIT d'écrire « Source: blob », « binary », ou un fichier non listé dans le CONTEXTE.
- Cite avec les numéros [n] comme dans le CONTEXTE.

STYLE:
- Français professionnel, réponse claire.

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
if (!n) throw new Error("Code in JavaScript introuvable");
n.parameters.jsCode = newCode;
fs.writeFileSync(wfPath, JSON.stringify(j, null, 2), "utf8");
console.log("OK: Code in JavaScript (modes réponse)");
