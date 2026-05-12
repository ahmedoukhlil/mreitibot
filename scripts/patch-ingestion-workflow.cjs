'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workflowPath = path.join(root, 'Ingestion PDF hybrid.json');
const splitJs = fs.readFileSync(
  path.join(__dirname, 'ingest_split_hybrid.js'),
  'utf8',
);
const upsertJs = fs.readFileSync(
  path.join(__dirname, 'ingest_upsert_hybrid.js'),
  'utf8',
);

const wf = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

const OLD_SPLIT = 'Split into chunks (1000/120)';
const NEW_SPLIT = 'Split into chunks (hybrid JS)';

let splitN = 0;
let upsertN = 0;
for (const node of wf.nodes) {
  if (node.parameters?.jsCode != null) {
    if (node.name === OLD_SPLIT) {
      node.name = NEW_SPLIT;
      node.parameters.jsCode = splitJs;
      splitN++;
    } else if (node.name === NEW_SPLIT) {
      node.parameters.jsCode = splitJs;
      splitN++;
    }
    if (node.name === 'Upsert dense + BM25 (Qdrant API)') {
      node.parameters.jsCode = upsertJs;
      upsertN++;
    }
  }
}

if (splitN !== 1 || upsertN !== 1) {
  console.error(
    'Attendu 1 nœud split + 1 upsert, obtenu:',
    splitN,
    upsertN,
  );
  process.exit(1);
}

if (wf.connections[OLD_SPLIT]) {
  wf.connections[NEW_SPLIT] = wf.connections[OLD_SPLIT];
  delete wf.connections[OLD_SPLIT];
}
for (const key of Object.keys(wf.connections)) {
  const main = wf.connections[key]?.main;
  if (!Array.isArray(main)) continue;
  for (const branch of main) {
    if (!Array.isArray(branch)) continue;
    for (const ref of branch) {
      if (ref && ref.node === OLD_SPLIT) ref.node = NEW_SPLIT;
    }
  }
}

wf.versionId = 'hybrid-ingest-n8n-js-v2-semantic-prefix';

fs.writeFileSync(workflowPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log('OK:', workflowPath);
