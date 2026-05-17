CREATE TABLE IF NOT EXISTS grammar_form_test_items (
  test_id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  target_grammar TEXT NOT NULL,
  base_word TEXT NOT NULL,
  question_jp TEXT NOT NULL,
  prompt_en TEXT NOT NULL,
  choice_a TEXT NOT NULL,
  choice_b TEXT NOT NULL,
  choice_c TEXT NOT NULL,
  choice_d TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  full_answer TEXT NOT NULL,
  correct_reason_jp TEXT NOT NULL,
  choice_a_explanation_jp TEXT NOT NULL,
  choice_b_explanation_jp TEXT NOT NULL,
  choice_c_explanation_jp TEXT NOT NULL,
  choice_d_explanation_jp TEXT NOT NULL,
  skill_focus TEXT NOT NULL,
  difficulty INTEGER DEFAULT 2,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS child_grammar_form_test_progress (
  child_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  last_selected_index INTEGER,
  last_is_correct INTEGER,
  last_attempted_at TEXT,
  mastered INTEGER DEFAULT 0,
  PRIMARY KEY (child_id, test_id)
);

CREATE TABLE IF NOT EXISTS child_grammar_form_test_attempts (
  attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  selected_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  attempted_at TEXT DEFAULT CURRENT_TIMESTAMP
);
