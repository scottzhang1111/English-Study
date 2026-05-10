# EIKEN Pre-2 Web Ready Question Bank

生成日時: 2026-05-10T12:37:19

## 内容
- 10 sets: SET01〜SET10
- 300 questions: each set has 30 questions
- 50 reading passages
- UTF-8 with BOM CSV files for Excel compatibility
- SQLite database ready for web app usage

## Files
- `eiken_pre2_web_ready.sqlite` — main SQLite DB
- `question_bank.csv` — questions with answers, Japanese translations, explanation_ja, vocabulary_notes_ja
- `passages.csv` — reading passages with Japanese translation fields
- `students.csv` — sample student master
- `attempts.csv` — sample attempt record
- `student_answers_template.csv` — answer records template
- `schema.sql` — DB schema and indexes
- `sample_api_queries.sql` — useful SQL for web backend

## Important API rule
Use `v_questions_for_quiz` for quiz screens. It does **not** expose `correct_option` or `explanation_ja`.
Use `v_questions_for_result` only after submission/result screen.

## Suggested flow
1. GET sets: `SELECT set_id, COUNT(*) FROM question_bank GROUP BY set_id;`
2. Start attempt: insert into `attempts`.
3. Show quiz: query `v_questions_for_quiz`.
4. Submit answers: compare submitted answer with `question_bank.correct_option` on backend.
5. Save each row into `student_answers`.
6. Show result: query `v_questions_for_result` and join saved answers.
7. Review mistakes: query `v_wrong_answers`.
