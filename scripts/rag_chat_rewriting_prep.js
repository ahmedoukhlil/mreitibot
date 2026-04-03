const root = $input.first().json;
const fromBody =
  root.body && typeof root.body === 'object' ? { ...root.body } : {};
const chatHistoryResolved = Array.isArray(fromBody.chatHistory)
  ? fromBody.chatHistory
  : Array.isArray(root.chatHistory)
    ? root.chatHistory
    : [];
const inboundBody = { ...fromBody, chatHistory: chatHistoryResolved };
const question = inboundBody.chatInput ?? root.chatInput ?? 'question vide';

function compactHistoryForClassifier(items, maxMsg, maxLen) {
  if (!Array.isArray(items) || !items.length) return '';
  const lines = [];
  for (const m of items.slice(-maxMsg)) {
    const role = String(m.role || '').toLowerCase();
    const tag =
      role === 'user'
        ? 'U'
        : role === 'assistant' || role === 'bot'
          ? 'A'
          : null;
    if (!tag) continue;
    let c = String(m.content || m.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!c) continue;
    if (c.length > maxLen) c = `${c.slice(0, maxLen)}…`;
    lines.push(`${tag}: ${c}`);
  }
  return lines.length
    ? `\n\nÉchanges précédents (interpréter ellipses, pronoms, suites type « idem », « la suivante » ; ne pas inventer de faits) :\n${lines.join('\n')}`
    : '';
}

const histCtx = compactHistoryForClassifier(inboundBody.chatHistory, 8, 480);

const prompt =
  'Classe la question (ITIE / MREITI / norme / transparence extractive) et retourne UNIQUEMENT un JSON valide, sans markdown ni texte autour.\n\n' +
  'QUESTION: "' +
  question +
  '"' +
  histCtx +
  '\n\n' +
  'queryType doit être UN parmi:\n' +
  '- greeting : simple salutation ou politesses (bonjour, merci, au revoir…) sans demande documentaire\n' +
  '- definition : définition ou présentation (ex. qu\'est-ce que l\'ITIE, c\'est quoi, présenter, rappeler ce qu\'est…)\n' +
  '- obligation : présentation d\'une exigence / obligation ITIE (sans demander comment la mettre en œuvre)\n' +
  '- implementation : comment mettre en œuvre / appliquer / concrétiser une exigence (ex. exigence 2.5, étapes, note d\'orientation + norme)\n' +
  '- procedure : autres démarches procédurales non couvrant implementation\n' +
  '- chiffre | liste | comparaison | general\n\n' +
  'Si la QUESTION est une suite courte (ex. « idem pour 2.6 », « merci », « le deuxième point »), déduis le sujet depuis les échanges précédents quand ils sont fournis, et intègre ce sujet dans enrichedQuery.\n\n' +
  'Si la QUESTION cite un numéro d\'exigence ITIE (ex. 1.4, 2.5, 4.1), enrichedQuery DOIT reprendre le numéro exact, les expressions « norme ITIE 2023 », « note d\'orientation », « MREITI », et les mots-clés thématiques de CETTE sous-exigence uniquement — sans mélanger avec une autre sous-exigence.\n\n' +
  'Pour les questions sur entreprises de l\'État, périmètre des entreprises, sociétés publiques ou participations de l\'État : enrichis enrichedQuery avec des termes ITIE pertinents (périmètre des entreprises extractives, entreprises publiques, reporting, norme ITIE 2023, MREITI) sans inventer de numéro d\'exigence.\n\n' +
  'Format exact:\n' +
  '{\n' +
  '  "queryType": "...",\n' +
  '  "enrichedQuery": "question reformulée + mots-clés ITIE / MREITI / norme / note d\'orientation si utile",\n' +
  '  "language": "fr|ar|en"\n' +
  '}';

return [
  {
    json: {
      ...root,
      body: { ...inboundBody, chatInput: question },
      rewritingPrompt: prompt,
      originalQuestion: question,
    },
  },
];
