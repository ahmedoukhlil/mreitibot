/**
 * Copie scripts/rag_qdrant_hybrid_search.js dans le nœud « Qdrant Hybrid Search »
 * du workflow RAG-chat (4).json. Exécuter : node scripts/sync_qdrant_hybrid_to_workflow.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const wfPath = path.join(root, 'RAG-chat (4).json');
const jsPath = path.join(root, 'scripts', 'rag_qdrant_hybrid_search.js');

const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const code = fs.readFileSync(jsPath, 'utf8');
const node = wf.nodes.find((n) => n.name === 'Qdrant Hybrid Search');
if (!node?.parameters) {
  console.error('Nœud « Qdrant Hybrid Search » introuvable.');
  process.exit(1);
}
node.parameters.jsCode = code;
fs.writeFileSync(wfPath, `${JSON.stringify(wf, null, 2)}\n`, 'utf8');
console.log(`OK — jsCode mis à jour (${code.length} caractères).`);
