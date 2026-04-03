# Audit Production Readiness — Chafafiya AI (RAG MREITI/ITIE)

**Date** : 30 mars 2026  
**Système** : RAG documentaire ITIE Mauritanie (n8n + Qdrant + Ollama + Gemini Flash)  
**Workflows analysés** : `Ingestion_PDF_hybrid.json`, `RAG-chat__4_.json`

---

## 📋 Résumé exécutif

### Verdict global
**❌ NON prod-ready pour un service public critique (MREITI)**  
**✅ OUI prod-ready pour un MVP interne/pilote avec monitoring manuel**

### Score technique : 7/10
- ✅ Architecture RAG hybride solide (dense + BM25 + RRF)
- ✅ Prompt engineering avancé (anti-hallucination, contexte enrichi)
- ✅ Métadonnées documentaires riches
- ❌ Gestion d'erreurs inexistante
- ❌ Monitoring et observabilité absents
- ❌ Résilience système non garantie

---

## ✅ Points forts (ce qui est déjà excellent)

### 1. Architecture RAG hybride performante

#### Recherche vectorielle multi-mode
```javascript
// Qdrant hybrid search implémenté correctement
prefetch: [
  { query: queryVector, using: 'dense', limit: 24 },
  { query: { text, model: 'qdrant/bm25' }, using: 'text-bm25', limit: 24 }
],
query: { fusion: 'rrf' }
```

**Forces** :
- Dense retrieval (nomic-embed-text 768d) pour similarité sémantique
- Sparse retrieval (BM25) pour matching exact mots-clés
- Fusion RRF (Reciprocal Rank Fusion) pour combiner les résultats
- Stratégies de retrieval adaptatives selon type de question

#### Logique métier intelligente
- **Smart requirement routing** : Si question mentionne "exigence 2.5" → cherche d'abord dans `note_orientation`, puis `doc_validation`, puis `norme_itie`
- **Document type filtering** : `filterDocType()` évite les 400 Qdrant dus aux chemins imbriqués
- **Requirement matching** : `pointMatchesRequirement()` valide la pertinence des chunks récupérés

---

### 2. Chunking sémantique de haute qualité

#### Stratégie de découpage
```javascript
CHUNK_TARGET = 720 chars
OVERLAP = 120 chars
CHUNK_HARD_MAX = 2200 chars
```

**Détections intelligentes** :
- ✅ Détection tableaux (ratio lignes tabulaires > 45%)
- ✅ Détection en-têtes structurés (`Étape N`, `Exigence X.Y`)
- ✅ Détection cas pratiques (pays + années)
- ✅ Chevauchement inter-chunks pour continuité contextuelle

#### Métadonnées enrichies par chunk
```javascript
metadata: {
  source, filename, source_path, source_rel_path,
  folder_document_type, itie_chapter,
  document_id, document_type, chunk_type,
  section_path, requirement_hint,
  has_table, has_example,
  chunk_index, chunk_index_estimated_total
}
```

#### Préfixe embedding contextuel
```javascript
embedPrefix = "[note_orientation | ITIE chapitre 2 | exigence 2.5 | Propriété effective]\n\n"
embedding_text = embedPrefix + chunk_content
```
→ Améliore drastiquement la pertinence de la recherche vectorielle

---

### 3. Prompt engineering anti-hallucination robuste

#### Règles strictes implémentées
```javascript
INTERDIT :
- Inventer citations, numéros de page, noms de fichiers
- Écrire "Source: blob" ou fichiers non listés
- Créer sections "Objectifs" remplies de contenu générique
- Mélanger sous-exigences (ex: répondre 2.6 quand question = 2.5)
- Utiliser connaissances externes pour contenu normatif
```

#### Classification question intelligente
Types détectés :
- `greeting` : salutations sans demande documentaire
- `definition` : "qu'est-ce que l'ITIE"
- `obligation` : présentation d'une exigence
- `implementation` : "comment mettre en œuvre exigence 2.5"
- `procedure`, `factual`, `chiffre`, `liste`, `comparaison`

#### Rewriting LLM avec enrichissement ITIE
```javascript
// Avant rewriting
question = "explique 2.5"

// Après enrichissement
enrichedQuery = "exigence 2.5 propriété effective bénéficiaires effectifs 
                 UBO actionnariat chaîne de contrôle norme ITIE 2023 
                 note d'orientation MREITI"
```

---

### 4. Reranking optionnel Cohere

```javascript
COHERE_RERANK_ENABLED = true/false (env var)
model: 'rerank-v3.5'
top_n: 6
```

Améliore l'ordre final des chunks avant envoi au LLM.

---

### 5. Observabilité A/B testing

#### Logs MySQL structurés
```sql
CREATE TABLE ab_test_logs (
  response_id VARCHAR(255),
  timestamp DATETIME,
  user_id VARCHAR(255),
  variant VARCHAR(10),
  prompt_id VARCHAR(100),
  original_question TEXT,
  enriched_query TEXT,
  response TEXT,
  response_length INT,
  user_feedback TEXT,
  feedback_score INT
)
```

Permet de :
- Comparer variants de prompts
- Analyser requêtes utilisateurs
- Mesurer satisfaction (via feedback futur)

---

### 6. Gestion conversation multi-tours

```javascript
formatChatHistoryBlock(chatHistory, maxMsg=8, maxChars=650)
```

- Compacte historique pour contexte LLM
- Gère pronoms/ellipses ("idem pour 2.6", "le deuxième point")
- Évite répétition si déjà couvert dans conversation

---

## 🚨 Gaps critiques pour la production

### ❌ 1. Gestion d'erreurs catastrophique

#### Problème
```javascript
// Pattern répété partout dans le code
try {
  const result = await httpRequest({...});
} catch (_) {
  // RIEN — erreur avalée silencieusement
}
```

**Impact** :
- Qdrant down → utilisateur voit "erreur" générique
- Ollama timeout → workflow bloqué sans trace
- Gemini rate-limited → pas de réponse, aucune alerte
- Impossible de débugger en production

#### Solution
```javascript
// Error handling production-grade
try {
  const result = await httpRequest({
    url: qdrantUrl,
    timeout: 30000, // 30s timeout
  });
  return result;
} catch (error) {
  // 1. Logger l'erreur
  await logError({
    timestamp: new Date().toISOString(),
    service: 'qdrant',
    operation: 'hybrid_search',
    error: error.message,
    stack: error.stack,
    userId: currentUserId,
    query: userQuestion,
  });
  
  // 2. Alerter si critique
  if (error.code === 'ECONNREFUSED') {
    await sendSlackAlert('🔴 Qdrant is DOWN');
  }
  
  // 3. Fallback gracieux
  return {
    ok: false,
    fallbackMessage: "Service temporairement indisponible. Contactez support@mreiti.gov.mr"
  };
}
```

**Checklist implémentation** :
- [ ] Logger toutes les erreurs dans table `error_logs` MySQL
- [ ] Timeout 15-30s sur tous les `httpRequest`
- [ ] Circuit breaker pour Qdrant/Ollama/Gemini
- [ ] Message fallback utilisateur si service down
- [ ] Alertes Slack/email si taux erreur > 10%

---

### ❌ 2. Rate limiting inexistant

#### Problème
Aucune protection contre :
- Spam utilisateur (100 requêtes/sec)
- Attaque DDoS basique
- Saturation Ollama (embed batch 32 × parallel 8)

**Impact** :
- VPS crashe sous charge
- Ollama OOM (Out of Memory)
- Facture Gemini Flash explose

#### Solution

**Option A : Rate limit nginx (recommandé)**
```nginx
# /etc/nginx/conf.d/rate-limit.conf
limit_req_zone $binary_remote_addr zone=chafafiya:10m rate=10r/m;

location /webhook/chat {
  limit_req zone=chafafiya burst=5 nodelay;
  limit_req_status 429;
  
  proxy_pass http://localhost:5678;
}
```

**Option B : Rate limit n8n JS**
```javascript
// Début du workflow
const redis = require('redis').createClient();
const userId = headers['x-user-id'] || ip;
const key = `ratelimit:${userId}`;

const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60); // 1 min window

if (count > 10) {
  return [{
    json: {
      error: "Trop de requêtes. Limite : 10/minute.",
      retry_after: 60
    }
  }];
}
```

**Checklist** :
- [ ] Limite 10 req/min/IP pour webhook public
- [ ] Limite 30 req/min/user_id pour utilisateurs authentifiés
- [ ] Réponse HTTP 429 avec header `Retry-After`
- [ ] Dashboard usage par utilisateur

---

### ❌ 3. Monitoring et observabilité absents

#### Problème
Questions sans réponse :
- Combien de requêtes/jour reçoit le système ?
- Quelle est la latence p95 ?
- Quel % d'erreurs Qdrant ?
- Combien de tokens Gemini consommés ?
- Quelles questions échouent le plus ?

#### Solution : Logs structurés + Dashboard

**A. Enrichir les logs**
```javascript
// Logging structuré JSON
const logEntry = {
  timestamp: new Date().toISOString(),
  request_id: generateUUID(),
  user_id: userId,
  
  // Métriques performance
  latency_total_ms: Date.now() - startTime,
  latency_qdrant_ms: qdrantLatency,
  latency_llm_ms: llmLatency,
  
  // Métriques usage
  chunks_retrieved: chunks.length,
  chunks_after_rerank: rerankedChunks.length,
  llm_tokens_input: promptTokens,
  llm_tokens_output: responseTokens,
  
  // Question & réponse
  original_question: originalQ,
  enriched_query: enrichedQ,
  query_type: queryType,
  requirement_detected: requirementId,
  response_length: response.length,
  
  // Erreurs
  qdrant_status: 'ok' | 'timeout' | 'error',
  ollama_status: 'ok' | 'error',
  llm_status: 'ok' | 'rate_limited' | 'error',
  warnings: ['citation_hors_contexte', 'source_invalide'],
  
  // Feedback utilisateur (si disponible)
  user_feedback: null,
  feedback_score: null,
};

await insertLog(logEntry);
```

**B. Dashboard Grafana/Metabase**

Métriques clés :
- **Volumétrie** : Requêtes/heure, /jour, /semaine
- **Performance** : Latence p50/p95/p99, temps par service (Qdrant, Ollama, LLM)
- **Qualité** : % réponses avec citations valides, longueur moyenne réponse
- **Erreurs** : Taux erreur par service, types d'erreurs fréquentes
- **Usage** : Top 10 questions, exigences ITIE les plus demandées
- **Coûts** : Tokens Gemini/jour, coût estimé mensuel

**C. Alertes automatiques**

```yaml
alerts:
  - name: Qdrant Down
    condition: qdrant_status == 'error' for 5 minutes
    action: slack_webhook + email
    
  - name: High Latency
    condition: latency_p95 > 10000ms
    action: slack_warning
    
  - name: Error Rate Spike
    condition: error_rate > 15% in last 10 minutes
    action: slack_critical + sms
    
  - name: Daily Cost Alert
    condition: gemini_tokens_daily > 1M
    action: email_admin
```

**Checklist** :
- [ ] Table `request_logs` avec métriques complètes
- [ ] Dashboard temps réel (Grafana ou Metabase)
- [ ] Alertes critiques configurées (Slack/email)
- [ ] Rapport hebdomadaire automatique (usage + top erreurs)

---

### ❌ 4. Pas de timeouts configurés

#### Problème
```javascript
await httpRequest({ url: qdrantUrl }); // Attend indéfiniment
```

Si Qdrant freeze (réseau lent, bug) → workflow bloqué 5+ minutes.

#### Solution
```javascript
const TIMEOUTS = {
  qdrant_search: 15000,      // 15s
  ollama_embed: 30000,       // 30s (batch peut être long)
  gemini_generate: 45000,    // 45s
  cohere_rerank: 10000,      // 10s
};

await httpRequest({
  url: qdrantUrl,
  timeout: TIMEOUTS.qdrant_search,
  // Si timeout → catch error et fallback
});
```

**Checklist** :
- [ ] Timeout sur tous les `httpRequest`
- [ ] Valeurs adaptées par service
- [ ] Retry 1-2 fois avec backoff exponentiel
- [ ] Fallback si tous les retries échouent

---

### ❌ 5. Résilience services tiers non garantie

#### Problème : Single Point of Failure

**Si Qdrant down** → tout le RAG crash  
**Si Ollama down** → pas d'embedding → crash  
**Si Gemini rate-limited** → pas de réponse

#### Solution : Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(serviceName, threshold = 5, timeout = 60000) {
    this.serviceName = serviceName;
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.nextAttempt = null;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`${this.serviceName} circuit breaker OPEN`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`${this.serviceName} circuit breaker OPEN for ${this.timeout}ms`);
    }
  }
}

// Usage
const qdrantBreaker = new CircuitBreaker('Qdrant', 5, 60000);

try {
  const results = await qdrantBreaker.call(() => 
    searchQdrant(query)
  );
} catch (error) {
  // Fallback : réponse dégradée
  return "Le service de recherche documentaire est temporairement indisponible.";
}
```

**Checklist** :
- [ ] Circuit breaker Qdrant
- [ ] Circuit breaker Ollama
- [ ] Circuit breaker Gemini
- [ ] Message utilisateur gracieux si service down
- [ ] Retry intelligent (backoff exponentiel)

---

### ❌ 6. Scalabilité embedding limitée

#### Problème
```javascript
// Ollama local sur VPS
EMBED_BATCH = 32
EMBED_PARALLEL = 8

// Si 10 users simultanés :
// 10 × 8 = 80 requêtes parallèles Ollama
// → OOM ou queue gigantesque
```

**Goulot d'étranglement** : Ollama local ne scale pas.

#### Solution

**Option A : Embedding cloud (recommandé prod)**
```javascript
// Remplacer Ollama par Voyage AI / Jina / OpenAI
async function embedTexts(texts) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-2',
      input: texts,
    }),
  });
  
  const data = await response.json();
  return data.embeddings;
}
```

**Avantages** :
- ✅ Latence stable (< 200ms)
- ✅ Auto-scaling infini
- ✅ Pas de gestion infrastructure
- ✅ Coût faible (Voyage: $0.13/1M tokens)

**Option B : Ollama horizontal scaling**
```yaml
# docker-compose.yml
services:
  ollama-1:
    image: ollama/ollama
    deploy:
      resources:
        limits:
          memory: 4G
  ollama-2:
    image: ollama/ollama
    deploy:
      resources:
        limits:
          memory: 4G
  ollama-3:
    image: ollama/ollama
    deploy:
      resources:
        limits:
          memory: 4G

  nginx-lb:
    image: nginx
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

```nginx
# nginx-lb.conf
upstream ollama_pool {
  least_conn;
  server ollama-1:11434;
  server ollama-2:11434;
  server ollama-3:11434;
}
```

**Checklist** :
- [ ] Load testing (k6, Locust) avec 50 users simultanés
- [ ] Décision : cloud vs scale Ollama
- [ ] Monitoring latence embedding p95
- [ ] Queue système si dépassement capacité

---

### ❌ 7. Backup et disaster recovery absents

#### Problème
Questions non répondues :
- Qdrant crashe → collections perdues ?
- VPS disque plein → données MySQL perdues ?
- Erreur humaine (DROP TABLE) → recovery comment ?
- Temps de rebuild si tout explose ?

#### Solution : Stratégie 3-2-1

**3 copies / 2 médias / 1 off-site**

**A. Backup Qdrant**
```bash
#!/bin/bash
# /root/scripts/backup-qdrant.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/var/backups/qdrant"
S3_BUCKET="s3://mreiti-backups/qdrant"

# 1. Créer snapshot Qdrant
curl -X POST "http://localhost:6333/collections/documents/snapshots" \
  -H "api-key: $QDRANT_API_KEY"

# 2. Copier snapshot
SNAPSHOT=$(ls -t /var/lib/qdrant/snapshots/documents/*.snapshot | head -1)
cp "$SNAPSHOT" "$BACKUP_DIR/qdrant-$DATE.snapshot"

# 3. Upload S3/Wasabi
aws s3 cp "$BACKUP_DIR/qdrant-$DATE.snapshot" "$S3_BUCKET/"

# 4. Nettoyer backups > 30 jours
find "$BACKUP_DIR" -mtime +30 -delete

# 5. Notifier
echo "✅ Backup Qdrant $DATE" | mail -s "Backup OK" admin@mreiti.gov.mr
```

**B. Backup MySQL**
```bash
#!/bin/bash
# /root/scripts/backup-mysql.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/var/backups/mysql"
S3_BUCKET="s3://mreiti-backups/mysql"

# 1. Dump MySQL
mysqldump -u root -p$MYSQL_PASSWORD \
  --single-transaction \
  --routines \
  --triggers \
  chafafiya_db > "$BACKUP_DIR/mysql-$DATE.sql"

# 2. Compresser
gzip "$BACKUP_DIR/mysql-$DATE.sql"

# 3. Upload S3
aws s3 cp "$BACKUP_DIR/mysql-$DATE.sql.gz" "$S3_BUCKET/"

# 4. Nettoyer
find "$BACKUP_DIR" -mtime +30 -delete
```

**C. Cron jobs**
```cron
# /etc/crontab

# Backup Qdrant tous les jours à 3h
0 3 * * * root /root/scripts/backup-qdrant.sh

# Backup MySQL tous les jours à 4h
0 4 * * * root /root/scripts/backup-mysql.sh

# Backup hebdomadaire complet (dimanche 2h)
0 2 * * 0 root /root/scripts/backup-full.sh
```

**D. Procédure recovery documentée**
```markdown
# Recovery Qdrant

1. Arrêter Qdrant
   systemctl stop qdrant

2. Restaurer snapshot
   aws s3 cp s3://mreiti-backups/qdrant/qdrant-20260330.snapshot /tmp/
   curl -X PUT "http://localhost:6333/collections/documents/snapshots/upload" \
     -H "api-key: $QDRANT_API_KEY" \
     --data-binary @/tmp/qdrant-20260330.snapshot

3. Redémarrer
   systemctl start qdrant

4. Vérifier
   curl http://localhost:6333/collections/documents
```

**Checklist** :
- [ ] Scripts backup automatisés
- [ ] Stockage S3/Wasabi configuré
- [ ] Cron jobs actifs
- [ ] Procédure recovery testée (dry-run)
- [ ] RPO/RTO définis (ex: RPO=24h, RTO=2h)

---

### ❌ 8. Prompt versioning non géré

#### Problème
Le prompt de 300+ lignes est hardcodé dans un nœud JS :
```javascript
const prompt = `
Tu es un assistant expert...
INSTRUCTIONS :
- Réponds UNIQUEMENT à partir des extraits...
...
`;
```

**Risques** :
- Modification accidentelle casse tout
- Impossible de rollback si régression
- Pas de A/B testing sur prompts
- Aucune traçabilité des changements

#### Solution : Externaliser + versionner

**A. Table MySQL `prompts`**
```sql
CREATE TABLE prompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prompt_id VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT FALSE,
  notes TEXT,
  UNIQUE KEY unique_prompt_version (prompt_id, version)
);

-- Exemple
INSERT INTO prompts (prompt_id, version, content, is_active, notes) VALUES
('rag_main', 1, 'Tu es un assistant...', TRUE, 'Version initiale'),
('rag_main', 2, 'Tu es un assistant expert...', FALSE, 'Ajout anti-hallucination');
```

**B. Charger prompt dynamiquement**
```javascript
// Début workflow RAG
async function loadActivePrompt(promptId) {
  const result = await mysql.query(
    'SELECT content FROM prompts WHERE prompt_id = ? AND is_active = TRUE',
    [promptId]
  );
  
  if (!result.length) {
    throw new Error(`Prompt ${promptId} non trouvé`);
  }
  
  return result[0].content;
}

const promptTemplate = await loadActivePrompt('rag_main');

// Utiliser dans le prompt final
const prompt = promptTemplate
  .replace('{{DOCUMENTS}}', contexte)
  .replace('{{QUESTION}}', question)
  .replace('{{HISTORY}}', conversationBlock);
```

**C. A/B testing prompts**
```javascript
// Router 50/50 entre 2 versions
const variant = Math.random() < 0.5 ? 'A' : 'B';
const promptId = variant === 'A' ? 'rag_main_v1' : 'rag_main_v2';

const prompt = await loadActivePrompt(promptId);

// Logger variant pour analyse
await logRequest({
  variant,
  prompt_version: promptId,
  ...
});
```

**Checklist** :
- [ ] Table `prompts` créée
- [ ] Migration prompts actuels → DB
- [ ] Fonction `loadActivePrompt()` implémentée
- [ ] Versioning Git pour backup prompts
- [ ] Interface admin pour activer/désactiver versions

---

### ❌ 9. Cache requêtes inexistant

#### Problème
Même question posée 10× → 10× embedding + 10× search Qdrant

**Gaspillage** :
- Latence inutile (200-500ms par embed)
- Coûts Ollama/cloud
- Charge Qdrant

Questions fréquentes prévisibles :
- "C'est quoi l'ITIE ?"
- "Exigence 2.5 propriété effective"
- "Comment mettre en œuvre 1.4"

#### Solution : Redis cache

**A. Architecture cache**
```javascript
const redis = require('redis').createClient();

async function getCachedOrSearch(question, userId) {
  // 1. Générer clé cache
  const cacheKey = `rag:${hashQuery(question)}`;
  
  // 2. Vérifier cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    await logCacheHit(cacheKey);
    return JSON.parse(cached);
  }
  
  // 3. Cache miss → vraie recherche
  const embedding = await embedText(question);
  const chunks = await searchQdrant(embedding);
  
  // 4. Stocker en cache (TTL 1h)
  await redis.setex(cacheKey, 3600, JSON.stringify(chunks));
  
  return chunks;
}

function hashQuery(text) {
  // Normaliser + hash
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^\w\s]/g, '') // ponctuation
    .trim();
  
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

**B. Invalidation cache**
```javascript
// Après réindexation Qdrant
await redis.del('rag:*'); // Flush tous les caches

// Ou invalidation sélective
await redis.del('rag:exigence-2-5-*');
```

**C. Métriques cache**
```javascript
const metrics = {
  cache_hits: await redis.get('cache:hits') || 0,
  cache_misses: await redis.get('cache:misses') || 0,
  cache_hit_rate: hits / (hits + misses),
};
```

**Checklist** :
- [ ] Redis installé sur VPS
- [ ] Cache search results (TTL 1h)
- [ ] Cache LLM responses pour questions identiques (TTL 30min)
- [ ] Invalidation après réindexation
- [ ] Dashboard hit rate

---

### ⚠️ 10. Sécurité API keys (déjà partiellement corrigé)

#### État actuel
✅ API key hardcodée corrigée  
✅ Utilisation `getCredentials()` n8n  
❌ Pas de rotation automatique  
❌ Pas de monitoring usage par clé

#### Solution : Rotation + monitoring

**A. Procédure rotation documentée**
```markdown
# Rotation API keys (mensuelle)

## Gemini Flash
1. Générer nouvelle clé : https://aistudio.google.com/app/apikey
2. Tester nouvelle clé sur staging
3. Updater n8n credentials
4. Invalider ancienne clé après 48h

## Cohere
1. Dashboard Cohere → New API Key
2. Tester rerank
3. Updater credentials
4. Révoquer ancienne

## Qdrant
1. Qdrant Cloud → Regenerate API Key
2. Updater `.env` ou n8n credentials
3. Restart services
```

**B. Monitoring usage**
```javascript
// Logger usage tokens par clé
await logApiUsage({
  timestamp: new Date(),
  service: 'gemini',
  api_key_id: 'key_prod_001',
  tokens_input: 3500,
  tokens_output: 850,
  cost_usd: 0.00234,
});

// Alerte si usage anormal
if (dailyTokens > 1_000_000) {
  await sendAlert('🚨 Gemini usage spike: ' + dailyTokens);
}
```

**Checklist** :
- [ ] Calendrier rotation (ex: 1er de chaque mois)
- [ ] Procédure documentée
- [ ] Monitoring coûts Gemini/Cohere
- [ ] Alertes si dépassement budget
- [ ] Backup keys dans vault sécurisé (1Password, Vault)

---

## 📊 Plan d'action priorisation

### Phase 1 : Stabilisation critique (3-5 jours) 🔴 P0

**Objectif** : Éviter crashes en production

| Tâche | Effort | Impact |
|-------|--------|--------|
| Error logging MySQL | 4h | Critique |
| Timeouts tous httpRequest | 2h | Critique |
| Rate limiting nginx | 3h | Critique |
| Circuit breaker Qdrant/Ollama | 6h | Élevé |
| Messages fallback gracieux | 2h | Élevé |

**Livrables** :
- ✅ Aucune erreur silencieuse
- ✅ Timeout max 45s par requête
- ✅ Max 10 req/min/IP
- ✅ Message utilisateur si service down

---

### Phase 2 : Observabilité (1-2 semaines) 🟡 P1

**Objectif** : Savoir ce qui se passe en prod

| Tâche | Effort | Impact |
|-------|--------|--------|
| Logs structurés complets | 8h | Élevé |
| Dashboard Grafana/Metabase | 12h | Élevé |
| Alertes Slack critiques | 4h | Moyen |
| Backup automatisé Qdrant+MySQL | 6h | Critique |
| Scripts recovery testés | 4h | Critique |

**Livrables** :
- ✅ Dashboard temps réel
- ✅ Alertes si erreur > 10%
- ✅ Backup quotidien S3
- ✅ RPO ≤ 24h, RTO ≤ 2h

---

### Phase 3 : Optimisation (2-3 semaines) 🟢 P2

**Objectif** : Améliorer performance et coûts

| Tâche | Effort | Impact |
|-------|--------|--------|
| Cache Redis search results | 8h | Moyen |
| Prompt versioning MySQL | 6h | Moyen |
| Load testing 50 users | 4h | Élevé |
| Migration embedding cloud (optionnel) | 12h | Élevé si scale |
| A/B testing infrastructure | 8h | Moyen |

**Livrables** :
- ✅ Cache hit rate > 30%
- ✅ Latence p95 < 3s
- ✅ Système stable à 50 users simultanés

---

## 🎯 Critères production-ready

### Checklist validation finale

#### ✅ Fiabilité
- [ ] Taux erreur < 5% sur 7 jours
- [ ] Aucune panne > 30min en 1 mois
- [ ] Circuit breakers tous services critiques
- [ ] Fallback gracieux si service down

#### ✅ Performance
- [ ] Latence p95 < 5s (p50 < 2s)
- [ ] Throughput ≥ 100 req/heure
- [ ] Cache hit rate > 30%
- [ ] Stable à 50 users simultanés (load test)

#### ✅ Sécurité
- [ ] Rate limiting 10 req/min/IP
- [ ] API keys en credentials manager
- [ ] Logs sanitizés (pas de PII)
- [ ] Backup chiffré

#### ✅ Observabilité
- [ ] Dashboard temps réel opérationnel
- [ ] Alertes critiques configurées
- [ ] Logs structurés JSON
- [ ] Rapport hebdomadaire automatique

#### ✅ Résilience
- [ ] Backup quotidien testé
- [ ] Procédure recovery documentée
- [ ] RPO ≤ 24h, RTO ≤ 2h
- [ ] Runbook incidents documenté

---

## 💰 Estimation coûts production

### Infrastructure mensuelle

| Service | Config | Coût/mois |
|---------|--------|-----------|
| VPS | 8 vCPU, 16GB RAM, 200GB SSD | 40-60€ |
| Qdrant Cloud (optionnel) | 1M vectors, 768d | 50€ |
| S3/Wasabi backup | 100GB | 5€ |
| **Total infra** | | **95-115€** |

### APIs usage (1000 req/jour)

| Service | Usage estimé | Coût/mois |
|---------|--------------|-----------|
| Gemini Flash 1.5 | 1000 req × 4000 tokens input × 30j | ~12€ |
| Cohere Rerank | 1000 req × 6 docs × 30j (optionnel) | ~8€ |
| Ollama local | CPU only, gratuit | 0€ |
| Voyage AI embed (si migration) | 30M tokens embedding | ~4€ |
| **Total APIs** | | **12-24€** |

### Coût total : 110-140€/mois

---

## 📚 Ressources et outils recommandés

### Monitoring
- **Grafana** (gratuit, self-hosted) : Dashboard métriques
- **Metabase** (gratuit) : Analytics MySQL
- **Uptime Kuma** (gratuit) : Health checks

### Logging
- **Loki** (gratuit, Grafana stack) : Logs centralisés
- **Better Stack** (freemium) : Logs + alertes

### Backup
- **Wasabi** (0.0059$/GB) : S3-compatible, moins cher qu'AWS
- **rsync.net** : Backup géo-redondant

### Load Testing
- **k6** (gratuit, open-source) : Scripts JS
- **Locust** (gratuit, Python) : UI web

### Error Tracking
- **Sentry** (freemium) : 5000 events/mois gratuit
- **Rollbar** (freemium) : Alternative

---

## 📞 Support et contact

**Questions techniques** : Ahmedou Khlil, Responsable de la Divulgation Systématique ITIE Mauritanie  
**Documentation système** : `/docs/chafafiya-architecture.md`  
**Runbook incidents** : `/docs/runbook-incidents.md`  
**Changelog** : `/CHANGELOG.md`

---

## 🔄 Prochaines étapes

1. **Réunion priorisation** (1h)
   - Valider phases 1-2-3
   - Assigner responsabilités
   - Fixer deadlines

2. **Spike technique Phase 1** (2 jours)
   - POC error logging
   - POC circuit breaker
   - Test rate limiting nginx

3. **Sprint 1 - Stabilisation** (1 semaine)
   - Implémenter Phase 1 complète
   - Tests charge initiaux
   - Documentation procédures

4. **Sprint 2 - Observabilité** (2 semaines)
   - Dashboard Grafana
   - Backup automatisé
   - Load testing 50 users

5. **Go-live production** (après validation)
   - Migration progressive
   - Monitoring 24/7 première semaine
   - Hotline support

---

**Dernière mise à jour** : 30 mars 2026  
**Version** : 1.0  
**Auteur** : Claude (Anthropic) — Audit technique Chafafiya AI
