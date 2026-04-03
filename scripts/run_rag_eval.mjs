/**
 * Même rôle que run_rag_eval.py (Node 18+).
 * Usage: node scripts/run_rag_eval.mjs [--url http://...] [--csv tests/rag_eval_questions.csv] [--out fichier.csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {
    url: process.env.RAG_EVAL_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/chat',
    csv: path.join(__dirname, '..', 'tests', 'rag_eval_questions.csv'),
    out: '',
    delay: Number(process.env.RAG_EVAL_DELAY_SEC || 0.5) * 1000,
    timeout: Number(process.env.RAG_EVAL_TIMEOUT_SEC || 180) * 1000,
  };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--url') o.url = a[++i];
    else if (a[i] === '--csv') o.csv = a[++i];
    else if (a[i] === '--out') o.out = a[++i];
    else if (a[i] === '--delay') o.delay = Number(a[++i]) * 1000;
    else if (a[i] === '--timeout') o.timeout = Number(a[++i]) * 1000;
  }
  return o;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = [];
  let cur = '';
  let q = false;
  const first = lines[0];
  for (let i = 0; i < first.length; i++) {
    const c = first[i];
    if (c === '"') q = !q;
    else if ((c === ',' && !q) || i === first.length - 1) {
      if (i === first.length - 1 && c !== ',') cur += c;
      headers.push(cur.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      cur = '';
    } else cur += c;
  }
  const rows = [];
  for (let L = 1; L < lines.length; L++) {
    const vals = [];
    cur = '';
    q = false;
    const line = lines[L];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (c === ',' && !q) {
        vals.push(cur.replace(/^"|"$/g, '').replace(/""/g, '"'));
        cur = '';
      } else cur += c;
    }
    vals.push(cur.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const row = {};
    headers.forEach((h, j) => {
      row[h] = vals[j] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

function escCsv(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const opts = parseArgs();
  const inPath = path.resolve(opts.csv);
  if (!fs.existsSync(inPath)) {
    console.error('Fichier introuvable:', inPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(inPath, 'utf8');
  const { headers, rows } = parseCsv(raw);
  const extra = ['http_status', 'latency_ms', 'reponse_bot', 'erreur', 'run_at_utc'];
  const outFields = [...headers, ...extra.filter((e) => !headers.includes(e))];

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.join(path.dirname(inPath), `rag_eval_results_${ts}.csv`);

  const outLines = [outFields.map(escCsv).join(',')];

  for (const row of rows) {
    const q = (row.question || '').trim();
    const runAt = new Date().toISOString();
    if (!q) {
      const r = { ...row, http_status: '', latency_ms: '', reponse_bot: '', erreur: 'question vide', run_at_utc: runAt };
      outLines.push(outFields.map((h) => escCsv(r[h] ?? '')).join(','));
      continue;
    }

    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), opts.timeout);
    const t0 = Date.now();
    let code = -1;
    let body = '';
    let err = '';
    try {
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: q }),
        signal: ac.signal,
      });
      code = res.status;
      body = await res.text();
      if (!res.ok) err = `HTTP ${code}`;
    } catch (e) {
      err = String(e.message || e);
    }
    clearTimeout(tid);
    const ms = Date.now() - t0;

    const r = {
      ...row,
      http_status: String(code),
      latency_ms: String(ms),
      reponse_bot: code === 200 ? body : '',
      erreur: code === 200 ? '' : err,
      run_at_utc: runAt,
    };
    outLines.push(outFields.map((h) => escCsv(r[h] ?? '')).join(','));

    await new Promise((r) => setTimeout(r, Math.max(0, opts.delay)));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`OK — ${rows.length} lignes → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
