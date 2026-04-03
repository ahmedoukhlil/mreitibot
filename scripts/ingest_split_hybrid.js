/**
 * Découpe hybride 100 % JS (n8n) : paragraphes, en-têtes type « Étape », exigences ITIE,
 * blocs tabulaires, chevauchement. Métadonnées enrichies pour Qdrant + préfixe embedding.
 *
 * Variables d'environnement (optionnelles) :
 * INGEST_CHUNK_CHARS   (défaut 720)
 * INGEST_OVERLAP_CHARS (défaut 120)
 * INGEST_CHUNK_MAX     (défaut 2200, plafond pour un seul bloc tableau/cas)
 */
function envStr(name) {
  try {
    if (typeof process === 'undefined') return '';
    const pe = process.env;
    if (!pe || typeof pe[name] !== 'string') return '';
    return pe[name];
  } catch (_) {
    return '';
  }
}

function envInt(name, def) {
  const v = envStr(name).trim();
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const CHUNK_TARGET = envInt('INGEST_CHUNK_CHARS', 720);
const OVERLAP = envInt('INGEST_OVERLAP_CHARS', 120);
const CHUNK_HARD_MAX = envInt('INGEST_CHUNK_MAX', 2200);
const INGEST_PROFILE = 'hybrid_semantic_n8n_js_v1';

const items = $input.all();
const out = [];

function pdfText(j) {
  if (!j || typeof j !== 'object') return '';
  if (typeof j.text === 'string') return j.text;
  if (typeof j.data === 'string') return j.data;
  for (const k of Object.keys(j)) {
    const v = j[k];
    if (typeof v === 'string' && v.length > 80) return v;
  }
  return '';
}

function normalizePdfText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hashDocId(sourceKey) {
  let h = 2166136261;
  const str = String(sourceKey || 'unknown');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'doc_' + (h >>> 0).toString(16);
}

function titleFromFile(name) {
  const n = String(name || '').replace(/\\/g, '/').split('/').pop() || '';
  return n
    .replace(/\.pdf$/i, '')
    .replace(/\.html?$/i, '')
    .replace(/_/g, ' ')
    .trim() || n;
}

/**
 * Priorité au chemin d’ingestion (sous-dossiers sur le serveur) : plus fiable que le seul nom de fichier.
 * Arborescence typique : documents/orientation/Exigence 2/*.pdf, documents/Validation/, documents/norme/, documents/divulgation/
 */
function documentTypeFromFolderPath(fullPath) {
  const p = String(fullPath || '').toLowerCase().replace(/\\/g, '/');
  if (
    /(^|\/)(validation|guide_validation|guide-de-la-validation|procedure-validation|procedure_de_validation|evaluations_ciblees|evaluations-ciblees)(\/|$)/.test(
      p,
    ) ||
    /validation\s*guide|guide\s*de\s*la\s*validation|procedure\s*de\s*validation/.test(
      p,
    )
  )
    return 'doc_validation';
  if (
    /(^|\/)divulgation(\/|$)/.test(p) ||
    /(^|\/)systematic_disclosure|toolkit_divulgation/.test(p)
  )
    return 'note_orientation';
  if (
    /(^|\/)(orientation|guidance|notes_itie|notes-itie)(\/|$)/.test(p) ||
    /notes?\s*d['\u2019]?\s*orientation/.test(p) ||
    /(^|\/)(exigence|requirement)\s*[1-7](\/|$)/.test(p)
  )
    return 'note_orientation';
  if (
    /(^|\/)(norme|standard|partie\s*1|principles?\s*(and|&)?\s*requirements)(\/|$)/.test(
      p,
    )
  )
    return 'norme_itie';
  return null;
}

/** Dossier « Exigence N » (N = 1..7, norme ITIE 2023) dans le chemin */
function itieChapterFromFolderPath(fullPath) {
  const p = String(fullPath || '').replace(/\\/g, '/');
  const m = p.match(/(?:^|[\\/])(?:exigence|requirement)\s*[:\s]*([1-7])(?:\D|$)/i);
  return m ? m[1] : '';
}

function relativeCorpusPath(fullPath) {
  const p = String(fullPath || '').replace(/\\/g, '/');
  const markers = ['/documents/', '/root/documents/'];
  for (const m of markers) {
    const i = p.indexOf(m);
    if (i >= 0) return p.slice(i + m.length);
  }
  return p.split('/').filter(Boolean).slice(0, -1).join('/') || '';
}

function classifyDocumentType(fileName, textHead) {
  const fn = String(fileName || '').toLowerCase();
  const head = String(textHead || '').slice(0, 12000).toLowerCase();
  if (/orientation|guidance|note\s*d|no_?orientation/.test(fn))
    return 'note_orientation';
  if (/note\s*d'orientation|guide.*orientation/.test(head) && /itie|eiti/.test(head))
    return 'note_orientation';
  if (
    /(guide|manuel|handbook).{0,40}valid/i.test(fn) ||
    /valid.{0,24}(itie|eiti|guide)/i.test(fn) ||
    /(itie|eiti).{0,28}valid/i.test(fn) ||
    /bar[eè]me|scoring|crit[eè]res?\s*de\s*valid/i.test(fn)
  )
    return 'doc_validation';
  if (
    /crit[eè]res?\s+de\s+validation|guide\s+(.{0,24}\s+)?validation|guide\s+de\s+la\s+validation|manuel\s+de\s+validation|validation\s+itie|conformit[eé].*validation|proc[eé]dure\s+de\s+validation/i.test(
      head,
    )
  )
    return 'doc_validation';
  if (/norme|standard/.test(fn) || /norme\s+itie|standard\s+itie/.test(head))
    return 'norme_itie';
  if (/rapport|mreiti|reconciliation|itie.*rapport/.test(fn)) return 'rapport_mreiti';
  if (/rapport|tableau\s+de\s+conciliation/.test(head)) return 'rapport_mreiti';
  return 'autre';
}

function requirementFromFileName(fileName) {
  const base = String(fileName || '').replace(/\.pdf$/i, '');
  const m = base.match(/\b([1-7])[._-]([0-9]{1,2})\b/);
  if (m) return m[1] + '.' + m[2];
  const m2 = base.match(/exigence[_\s-]*([1-7])[\._]([0-9]{1,2})/i);
  if (m2) return m2[1] + '.' + m2[2];
  return '';
}

function extractRequirementFromText(snippet) {
  const s = String(snippet || '').slice(0, 500);
  const m = s.match(/exigence\s+([1-7])[\._]([0-9]{1,2})(?:[\._]([a-z0-9]+))?/i);
  if (m) return m[3] ? `${m[1]}.${m[2]}.${m[3]}` : `${m[1]}.${m[2]}`;
  const m2 = s.match(/\b([1-7])[\._]([0-9]{1,2})[\._]([a-z])\b/i);
  if (m2) return `${m2[1]}.${m2[2]}.${m2[3]}`;
  return '';
}

function detectHeadingLine(line) {
  const t = String(line || '').trim();
  if (!t || t.length > 180) return '';
  if (/^étape\s+\d+/i.test(t)) return t;
  if (/^step\s+\d+/i.test(t)) return t;
  if (/^exigence\s+[0-9]+\s*$/i.test(t)) return t;
  if (/^exigence\s+[0-9]+[\._][0-9]+/i.test(t)) return t;
  if (/^[0-9]+\.[0-9]+(\.[a-z]+)?\s+[A-ZÀÉÈÊËÎÏÔÙÛÜÇ]/.test(t)) return t;
  if (/^partie\s+[ivx0-9]+/i.test(t)) return t;
  return '';
}

function inferChunkType(text) {
  const t = String(text || '');
  const lines = t.split('\n').filter((l) => l.trim());
  if (lines.length >= 4) {
    let tabLike = 0;
    for (const l of lines) {
      if (/\t/.test(l) || /\|/.test(l) || /\s{3,}/.test(l)) tabLike++;
    }
    if (tabLike >= Math.ceil(lines.length * 0.45)) return 'data_table';
  }
  if (
    /\b(cameroun|tanzanie|guinée|ghana|zambie|nigeria|mali|sénégal)\b/i.test(
      t,
    ) &&
    /\b(20[0-2][0-9])\b/.test(t)
  )
    return 'case_study';
  return 'narrative_section';
}

function splitIntoParagraphs(t) {
  return String(t || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function chunkLongParagraph(para, target, overlap, hardMax) {
  const chunks = [];
  if (para.length <= target) {
    if (para) chunks.push(para);
    return chunks;
  }
  let start = 0;
  while (start < para.length) {
    let end = Math.min(start + hardMax, para.length);
    if (end - start > target && end < para.length) {
      end = Math.min(start + target, para.length);
      const lb = para.lastIndexOf('\n', end);
      if (lb > start + Math.floor(target * 0.45)) end = lb + 1;
      else {
        const sp = para.lastIndexOf('. ', end);
        if (sp > start + Math.floor(target * 0.45)) end = sp + 2;
      }
    }
    const piece = para.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= para.length) break;
    let nextStart = end - overlap;
    const nb = para.lastIndexOf('\n', end - 1);
    if (nb > start && nb >= nextStart) nextStart = nb + 1;
    start = Math.max(start + 1, nextStart);
  }
  return chunks;
}

function buildEmbeddingPrefix(meta) {
  const parts = [];
  if (meta.document_type) parts.push(meta.document_type.replace(/_/g, ' '));
  if (meta.itie_chapter && !meta.requirement_hint)
    parts.push('ITIE chapitre exigence ' + meta.itie_chapter);
  if (meta.requirement_hint) parts.push('ITIE exigence ' + meta.requirement_hint);
  if (meta.section_path) parts.push(meta.section_path);
  if (meta.title && !meta.section_path) parts.push(meta.title);
  if (!parts.length) return '';
  return '[' + parts.join(' | ') + ']\n\n';
}

for (const item of items) {
  const j = item.json || {};
  const raw = pdfText(j);
  const t = normalizePdfText(raw);
  const filePath = j.path || j.filePath || '';
  const fileName =
    j.fileName ||
    j.name ||
    (filePath && String(filePath).split(/[/\\]/).pop()) ||
    'inconnu.pdf';
  const isWeb =
    j.ingest_source === 'url' ||
    j.content_type === 'text/html' ||
    /\.html?$/i.test(fileName);
  const sourceKey = filePath ? filePath + '|' + fileName : fileName;
  const documentId = hashDocId(sourceKey);
  const title =
    (isWeb && typeof j.source_title === 'string' && j.source_title.trim()
      ? j.source_title.trim()
      : null) || titleFromFile(fileName);
  if (!t) continue;

  const folderType = documentTypeFromFolderPath(filePath);
  const documentType =
    folderType || classifyDocumentType(fileName, t);
  const itieChapter = itieChapterFromFolderPath(filePath);
  const requirementHint = requirementFromFileName(fileName);
  const sourceRelPath = relativeCorpusPath(filePath);
  let requirementRolling = requirementHint;
  const paragraphs = splitIntoParagraphs(t);

  let sectionPath = '';
  const buffer = [];
  let bufLen = 0;

  function emitChunk(body, idxRef) {
    const chunkType = inferChunkType(body);
    const reqFromChunk = extractRequirementFromText(body);
    const req = reqFromChunk || requirementRolling || requirementHint || '';
    if (reqFromChunk) requirementRolling = reqFromChunk;

    const metadata = {
      source: fileName,
      filename: fileName,
      source_path: filePath || '',
      source_rel_path: sourceRelPath || undefined,
      folder_document_type: folderType || undefined,
      itie_chapter: itieChapter || undefined,
      title,
      document_id: documentId,
      type: isWeb ? 'html' : 'pdf',
      content_type: isWeb ? 'text/html' : 'application/pdf',
      chunk_index: idxRef.count,
      chunk_size_target: CHUNK_TARGET,
      chunk_overlap: OVERLAP,
      ingest_profile: INGEST_PROFILE,
      document_type: documentType,
      section_path: sectionPath || undefined,
      requirement_hint: req || undefined,
      chunk_type: chunkType,
      has_table: chunkType === 'data_table',
      has_example: chunkType === 'case_study',
    };

    const embedPrefix = buildEmbeddingPrefix(metadata);
    const embedding_text = embedPrefix + body;

    out.push({
      json: {
        chunk: body,
        embedding_text,
        chunk_index: idxRef.count,
        source: fileName,
        source_path: filePath || undefined,
        document_id: documentId,
        metadata,
      },
    });
    idxRef.count += 1;
  }

  function flushBuffer(idxRef) {
    if (!buffer.length) return;
    const combined = buffer.join('\n\n');
    buffer.length = 0;
    bufLen = 0;

    if (combined.length <= CHUNK_TARGET) {
      emitChunk(combined, idxRef);
      return;
    }
    const pieces = chunkLongParagraph(
      combined,
      CHUNK_TARGET,
      OVERLAP,
      CHUNK_HARD_MAX,
    );
    for (const p of pieces) emitChunk(p, idxRef);
  }

  const idxRef = { count: 0 };

  for (const para of paragraphs) {
    const lines = para.split('\n');
    for (const line of lines) {
      const h = detectHeadingLine(line);
      if (h) sectionPath = h.length > 160 ? h.slice(0, 157) + '…' : h;
    }

    const isHuge = para.length > CHUNK_HARD_MAX;
    const linesP = para.split('\n');
    const tabLike = linesP.filter(
      (l) => /\t/.test(l) || /\|/.test(l) || /\s{3,}/.test(l),
    ).length;
    const isCompactTable =
      linesP.length >= 4 && tabLike >= Math.ceil(linesP.length * 0.45);

    if (isCompactTable && para.length <= CHUNK_HARD_MAX) {
      flushBuffer(idxRef);
      emitChunk(para, idxRef);
      continue;
    }

    if (isHuge) {
      flushBuffer(idxRef);
      const pieces = chunkLongParagraph(
        para,
        CHUNK_TARGET,
        OVERLAP,
        CHUNK_HARD_MAX,
      );
      for (const p of pieces) emitChunk(p, idxRef);
      continue;
    }

    const addLen = para.length + (bufLen ? 2 : 0);
    if (bufLen + addLen > CHUNK_TARGET && bufLen > 0) flushBuffer(idxRef);

    buffer.push(para);
    bufLen = buffer.join('\n\n').length;
  }

  flushBuffer(idxRef);
}

const counts = {};
for (const it of out) {
  const id = it.json?.document_id;
  if (id) counts[id] = (counts[id] || 0) + 1;
}
for (const it of out) {
  const m = it.json?.metadata;
  const id = it.json?.document_id;
  if (m && id && counts[id]) m.chunk_index_estimated_total = counts[id];
}

return out;
