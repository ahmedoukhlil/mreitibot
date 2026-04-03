'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workflowPath = path.join(root, 'RAG-chat (4).json');

const hints = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'itie_requirement_hints.json'), 'utf8'),
);
const injected = `const ITIE_REQUIREMENT_HINTS = ${JSON.stringify(hints)};\n\n`;
const shared = fs.readFileSync(
  path.join(__dirname, 'rag_chat_itie_requirement_shared.js'),
  'utf8',
);
const mergedItie = injected + shared;

const contextJs =
  mergedItie +
  fs.readFileSync(path.join(__dirname, 'rag_chat_context_build.js'), 'utf8');
const responseJs = fs.readFileSync(
  path.join(__dirname, 'rag_chat_response_sanitize.js'),
  'utf8',
);
const rewritingPrepJs = fs.readFileSync(
  path.join(__dirname, 'rag_chat_rewriting_prep.js'),
  'utf8',
);
const parseClassificationJs =
  mergedItie +
  fs.readFileSync(
    path.join(__dirname, 'rag_chat_parse_classification.js'),
    'utf8',
  );
const qdrantHybridJs = fs.readFileSync(
  path.join(__dirname, 'rag_qdrant_hybrid_search.js'),
  'utf8',
);

const wf = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

let n = 0;
for (const node of wf.nodes) {
  if (node.name === 'Code in JavaScript' && node.parameters?.jsCode != null) {
    node.parameters.jsCode = contextJs;
    n++;
  }
  if (node.name === 'Code in JavaScript1' && node.parameters?.jsCode != null) {
    node.parameters.jsCode = responseJs;
    n++;
  }
  if (node.name === 'Code in JavaScript2' && node.parameters?.jsCode != null) {
    node.parameters.jsCode = rewritingPrepJs;
    n++;
  }
  if (node.name === 'Code in JavaScript3' && node.parameters?.jsCode != null) {
    node.parameters.jsCode = parseClassificationJs;
    n++;
  }
  if (
    node.name === 'Qdrant Hybrid Search' &&
    node.parameters?.jsCode != null
  ) {
    node.parameters.jsCode = qdrantHybridJs;
    n++;
  }
}

if (n !== 5) {
  console.error('Attendu 5 nœuds mis à jour, obtenu:', n);
  process.exit(1);
}

fs.writeFileSync(workflowPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log('OK:', workflowPath);
