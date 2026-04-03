'use strict';

const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, '..', 'RAG-chat (4).json');
const wf = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

const AB_LOGGER_JS = `const response = $input.first().json;
const headers = $('Webhook').first()?.json?.headers || {};
const userIdVal =
  headers['x-user-id'] ||
  headers['x-forwarded-for'] ||
  \`anonymous_\${Date.now()}\`;

const body3 = $('Code in JavaScript3').first()?.json?.body ?? {};
const originalQ =
  body3.originalQuestion != null ? String(body3.originalQuestion) : '';
const enrichedQ =
  body3.chatInput != null ? String(body3.chatInput) : originalQ;

const responseId = \`resp_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
const text = response.response || response.output || '';
const now = new Date();
const ts = now.toISOString();
const pad = (n) => String(n).padStart(2, '0');
const createdAtMysql =
  \`\${now.getUTCFullYear()}-\${pad(now.getUTCMonth() + 1)}-\${pad(now.getUTCDate())} \${pad(now.getUTCHours())}:\${pad(now.getUTCMinutes())}:\${pad(now.getUTCSeconds())}\`;
const promptId = 'rag_main';
// Colonnes MySQL souvent ENUM('A','B') ou VARCHAR(1) — 'single' déclenche ER_DATA_TOO_LONG
const variantVal = 'A';

const logEntry = {
  responseId,
  timestamp: ts,
  userId: userIdVal,
  variant: variantVal,
  routingMode: 'single_path',
  promptId,
  originalQuestion: originalQ,
  enrichedQuery: enrichedQ,
  response: text,
  responseLength: text.length,
  userFeedback: null,
  feedbackScore: null,
};

return [{
  json: {
    response: text,
    response_id: responseId,
    variant: variantVal,
    ab_test_variant: variantVal,
    prompt_id: promptId,
    user_id: userIdVal,
    original_question: originalQ,
    enriched_query: enrichedQ,
    response_length: text.length,
    user_feedback: null,
    feedback_score: null,
    ab_test_log: JSON.stringify(logEntry),
    created_at: createdAtMysql,
  },
}];`;

wf.nodes = wf.nodes.filter((n) => n.name !== 'AB Router');

const logger =
  wf.nodes.find((n) => n.name === 'Response Logger') ||
  wf.nodes.find((n) => n.name === 'AB Logger');
if (!logger) throw new Error('Response Logger / AB Logger introuvable');
logger.parameters.jsCode = AB_LOGGER_JS;
if (logger.name === 'AB Logger') logger.name = 'Response Logger';

const model1 = wf.nodes.find((n) => n.name === 'Message a model1');
if (!model1) throw new Error('Message a model1 not found');
model1.parameters.responses.values[0].content = '={{ $json.prompt }}';

wf.connections['Code in JavaScript'] = {
  main: [[{ node: 'Message a model1', type: 'main', index: 0 }]],
};

delete wf.connections['AB Router'];

if (wf.connections['AB Logger']) {
  wf.connections['Response Logger'] = wf.connections['AB Logger'];
  delete wf.connections['AB Logger'];
}
for (const key of Object.keys(wf.connections)) {
  const main = wf.connections[key]?.main;
  if (!Array.isArray(main)) continue;
  for (const branch of main) {
    if (!Array.isArray(branch)) continue;
    for (const ref of branch) {
      if (ref && ref.node === 'AB Logger') ref.node = 'Response Logger';
    }
  }
}

for (const node of wf.nodes) {
  const p = node.parameters;
  if (!p) continue;
  const rb = p.responseBody;
  if (typeof rb === 'string' && rb.includes("$('AB Logger')")) {
    p.responseBody = rb.split("$('AB Logger')").join("$('Response Logger')");
  }
}

fs.writeFileSync(workflowPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(
  'OK: AB Router supprimé, Response Logger (ex AB Logger) corrigé, Message a model1 → $json.prompt.',
);
