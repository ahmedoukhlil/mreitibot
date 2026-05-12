const fs = require('fs');

const wfPath = 'RAG-chat (4).json';
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const nodes = wf.nodes || wf.workflow?.nodes || [];
const n = nodes.find(n => n.id === '0ae28f4d-304e-4570-bd43-d7a3763fd172');
let code = n.parameters.jsCode;

// ── Patch 1: insert sourceUrls tracker before contexte map, and collect url in map
// Step 1a: add Map before cappedDocs map
code = code.replace(
  'const contexte = cappedDocs',
  'const sourceUrls = new Map();\nconst contexte = cappedDocs'
);

// Step 1b: inject url collection right before the return statement inside the map
// The return looks like:  return `[${i + 1}] [Fichier: ${label}]${sectionHint}\n${content}`;
// We use a regex to find this exact pattern
code = code.replace(
  /return `\[\$\{i \+ 1\}\] \[Fichier: \$\{label\}\]\$\{sectionHint\}\n\$\{content\}`;/,
  `const url = typeof meta.source_url === 'string' && meta.source_url.startsWith('http') ? meta.source_url : null;
    if (url) sourceUrls.set(i + 1, url);
    return \`[\${i + 1}] [Fichier: \${label}]\${sectionHint}\n\${content}\`;`
);
console.log('[Patch 1] ✓ source_url collection ajoutée');

// ── Patch 2: inject sources block before final return
// Find last return [ in the code
const lastReturnIdx = code.lastIndexOf('return [');
const beforeReturn = code.substring(0, lastReturnIdx);
const returnAndAfter = code.substring(lastReturnIdx);

// Build the sources injection code
const sourcesCode = `// Build sources block from collected URLs
const sourcesLines = [];
for (const [sIdx, sUrl] of sourceUrls.entries()) {
  sourcesLines.push(\`[\${sIdx}] \${sUrl}\`);
}
const sourcesBlock = sourcesLines.length
  ? '\n\nSOURCES (à mentionner en fin de réponse) :\n' + sourcesLines.join('\n')
  : '';
const promptFinal = prompt + sourcesBlock;

`;

// Replace prompt with promptFinal in the return statement
const newReturnAndAfter = returnAndAfter
  .replace('prompt,', 'prompt: promptFinal,')
  .replace('contexte,\n      retrieval_errors', 'contexte,\n      sources: Object.fromEntries(sourceUrls),\n      retrieval_errors');

code = beforeReturn + sourcesCode + newReturnAndAfter;
console.log('[Patch 2] ✓ sources block injecté avant le return final');

// ── Patch 3: add citation URL instruction to system prompt
const CITE_RULE = "- Cites TOUJOURS les numéros de sources entre crochets, ex. [1], [2].";
if (code.includes(CITE_RULE)) {
  code = code.replace(
    CITE_RULE,
    CITE_RULE + "\n- À la fin de ta réponse, si le prompt contient une section SOURCES avec des URLs, ajoute une section **Sources :** avec les liens Markdown vers les pages eiti.org citées."
  );
  console.log('[Patch 3] ✓ instruction URLs ajoutée');
} else {
  console.log('[Patch 3] ⚠ règle citation non trouvée, skip');
}

n.parameters.jsCode = code;
fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');
JSON.parse(fs.readFileSync(wfPath, 'utf8'));
console.log('\n[JSON] ✓ Fichier valide et sauvegardé');
console.log('Réimportez RAG-chat (4).json dans n8n.');
