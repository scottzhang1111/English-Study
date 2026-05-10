
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS passages (
  passage_id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  passage_no INTEGER NOT NULL,
  genre TEXT NOT NULL,
  passage_type TEXT NOT NULL,
  title TEXT,
  title_ja TEXT,
  passage_text TEXT NOT NULL,
  passage_text_ja TEXT,
  key_points_ja TEXT,
  source_style TEXT
);

CREATE TABLE IF NOT EXISTS question_bank (
  question_id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  question_no INTEGER NOT NULL,
  section TEXT NOT NULL,
  question_type TEXT NOT NULL,
  passage_id TEXT,
  prompt TEXT NOT NULL,
  question_text_ja TEXT,
  option_A TEXT NOT NULL,
  option_B TEXT NOT NULL,
  option_C TEXT NOT NULL,
  option_D TEXT NOT NULL,
  option_A_ja TEXT,
  option_B_ja TEXT,
  option_C_ja TEXT,
  option_D_ja TEXT,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  correct_answer_text TEXT,
  correct_answer_text_ja TEXT,
  explanation_ja TEXT,
  vocabulary_notes_ja TEXT,
  difficulty TEXT,
  skill_tag TEXT,
  weak_point_tag TEXT,
  target_vocab TEXT,
  source_style TEXT,
  FOREIGN KEY (passage_id) REFERENCES passages(passage_id)
);

CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  grade TEXT,
  target_level TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS attempts (
  attempt_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  total_questions INTEGER DEFAULT 30,
  correct_count INTEGER,
  score_percent REAL,
  time_minutes INTEGER,
  notes TEXT,
  FOREIGN KEY (student_id) REFERENCES students(student_id)
);

CREATE TABLE IF NOT EXISTS student_answers (
  answer_id TEXT PRIMARY KEY,
  attempt_id TEXT,
  student_id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  student_answer TEXT CHECK (student_answer IN ('A','B','C','D') OR student_answer IS NULL OR student_answer=''),
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  is_correct INTEGER CHECK (is_correct IN (0,1) OR is_correct IS NULL),
  answered_at TEXT,
  review_flag TEXT,
  review_note TEXT,
  weak_point_tag TEXT,
  FOREIGN KEY (attempt_id) REFERENCES attempts(attempt_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (question_id) REFERENCES question_bank(question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_set ON question_bank(set_id, question_no);
CREATE INDEX IF NOT EXISTS idx_question_passage ON question_bank(passage_id);
CREATE INDEX IF NOT EXISTS idx_answers_student ON student_answers(student_id, is_correct, weak_point_tag);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, set_id);
