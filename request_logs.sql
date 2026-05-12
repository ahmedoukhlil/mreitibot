CREATE TABLE IF NOT EXISTS request_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  request_id VARCHAR(64) NOT NULL,
  response_id VARCHAR(255) NULL,
  user_id VARCHAR(255) NULL,

  original_question TEXT NULL,
  enriched_query TEXT NULL,
  query_type VARCHAR(32) NULL,
  language VARCHAR(8) NULL,
  requirement_detected VARCHAR(16) NULL,

  -- Latences (ms)
  latency_total_ms INT NULL,
  latency_retrieval_ms INT NULL,
  latency_ollama_embed_ms INT NULL,
  latency_qdrant_ms INT NULL,

  -- Retrieval stats
  retrieval_strategy VARCHAR(32) NULL,
  chunks_retrieved INT NULL,
  chunks_after_rerank INT NULL,
  qdrant_status VARCHAR(24) NULL,
  ollama_status VARCHAR(24) NULL,
  redis_cache VARCHAR(24) NULL,
  cache_hit TINYINT(1) NULL,
  cache_key_hash VARCHAR(48) NULL,
  llm_status VARCHAR(24) NULL,

  -- Réponse
  response_length INT NULL,

  -- Qualité / garde-fous
  warnings_json JSON NULL,
  retrieval_errors_json JSON NULL
);

CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX idx_request_logs_request_id ON request_logs(request_id);
CREATE INDEX idx_request_logs_user_id ON request_logs(user_id);

-- Si la table request_logs existait déjà sans colonnes cache :
-- ALTER TABLE request_logs ADD COLUMN redis_cache VARCHAR(24) NULL AFTER ollama_status;
-- ALTER TABLE request_logs ADD COLUMN cache_hit TINYINT(1) NULL AFTER redis_cache;
-- ALTER TABLE request_logs ADD COLUMN cache_key_hash VARCHAR(48) NULL AFTER cache_hit;
