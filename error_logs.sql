CREATE TABLE IF NOT EXISTS error_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  response_id VARCHAR(255) NULL,
  user_id VARCHAR(255) NULL,
  service VARCHAR(64) NOT NULL,
  operation VARCHAR(64) NULL,
  error_message TEXT NULL,
  stack TEXT NULL,
  http_status INT NULL,
  original_question TEXT NULL,
  enriched_query TEXT NULL
);

