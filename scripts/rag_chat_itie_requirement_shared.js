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
