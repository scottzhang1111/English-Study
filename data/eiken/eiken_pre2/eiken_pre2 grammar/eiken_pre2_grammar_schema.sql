-- Eiken Pre-2 Grammar Lesson Library
-- Lesson data and child-specific progress tracking

CREATE TABLE IF NOT EXISTS grammar_lessons (
  lesson_id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  grammar_point TEXT NOT NULL,
  jp_explanation TEXT NOT NULL,
  jp_example TEXT NOT NULL,
  en_example TEXT NOT NULL,
  learning_goal TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS grammar_quizzes (
  quiz_id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  question_jp TEXT NOT NULL,
  choice_a TEXT NOT NULL,
  choice_b TEXT NOT NULL,
  choice_c TEXT NOT NULL,
  choice_d TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation_jp TEXT NOT NULL,
  difficulty INTEGER DEFAULT 2,
  FOREIGN KEY (lesson_id) REFERENCES grammar_lessons(lesson_id)
);

CREATE TABLE IF NOT EXISTS child_grammar_progress (
  child_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT DEFAULT 'not_started', -- not_started / learning / mastered
  view_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  last_score INTEGER DEFAULT 0,
  mastered_at TEXT,
  last_studied_at TEXT,
  next_review_at TEXT,
  PRIMARY KEY (child_id, lesson_id),
  FOREIGN KEY (lesson_id) REFERENCES grammar_lessons(lesson_id)
);

CREATE TABLE IF NOT EXISTS child_grammar_quiz_attempts (
  attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  selected_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES grammar_lessons(lesson_id),
  FOREIGN KEY (quiz_id) REFERENCES grammar_quizzes(quiz_id)
);
