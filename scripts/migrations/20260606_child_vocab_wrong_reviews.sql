CREATE TABLE IF NOT EXISTS child_vocab_wrong_reviews (
  child_id INTEGER NOT NULL,
  vocab_id INTEGER NOT NULL,
  world_id TEXT,
  stage_number INTEGER,
  question_type TEXT,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_wrong_at TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending',
  mastered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id, vocab_id)
);
