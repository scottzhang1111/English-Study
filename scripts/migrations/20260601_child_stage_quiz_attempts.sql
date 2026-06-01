CREATE TABLE IF NOT EXISTS child_stage_quiz_attempts (
    attempt_id TEXT PRIMARY KEY,
    child_id INTEGER NOT NULL,
    world_id TEXT NOT NULL,
    stage_number INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    passed INTEGER NOT NULL DEFAULT 0,
    answers_json TEXT NOT NULL DEFAULT '[]',
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_child_stage_quiz_attempts_child_stage
ON child_stage_quiz_attempts (child_id, world_id, stage_number, submitted_at);
