const fs = require('fs');
const path = require('path');

const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'chafafiya_gold_questions_itie.json'), 'utf-8'));
const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'runs', '_summary.json'), 'utf-8'));

const byId = new Map(summary.map((r) => [r.id, r]));

const divergences = [];

for (const q of set.questions) {
  const r = byId.get(q.id);
  if (!r || r.skipped || r.error) continue;

  const expected = q.retrieval_strategy_attendu;
  const observed = r.retrieval_strategy_observed;

  // Comparaison souple : "rapport_year_2022" vs "rapport_year_2022 (alias 2020-2021)"
  // -> on compare juste le préfixe rapport_year_XXXX / smart / rapport_analytical.
  const expNorm = String(expected || '').split(' ')[0].split('(')[0].trim();
  const obsNorm = String(observed || '').trim();

  const match = expNorm === obsNorm || expNorm.startsWith(obsNorm) || obsNorm.startsWith(expNorm);

  if (!match) {
    divergences.push({
      id: q.id,
      categorie: q.categorie,
      question: q.question,
      attendu: expected,
      observe: observed,
      chunks: r.chunks_retrieved,
      ctxLen: r.contexte_length,
    });
  }
}

console.log(`\n=== Divergences retrieval_strategy (${divergences.length}/${summary.filter(r=>!r.skipped && !r.error).length}) ===\n`);
for (const d of divergences) {
  console.log(`[${d.id}] ${d.categorie}`);
  console.log(`  Q: ${d.question}`);
  console.log(`  Attendu : ${d.attendu}`);
  console.log(`  Observé : ${d.observe} (chunks=${d.chunks}, ctxLen=${d.ctxLen})`);
  console.log();
}
