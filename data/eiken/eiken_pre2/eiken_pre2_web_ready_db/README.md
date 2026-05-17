# EIKEN Pre-2 Web Ready Question Bank + SET13

生成日時: 2026-05-16T07:59:17

## 今回追加した内容
- SET13: 37 questions
  - Q01〜Q20: 語彙・熟語・文法
  - Q21〜Q25: 会話文完成
  - Q26〜Q30: 短文空所補充
  - Q31〜Q37: 読解
- Passages: 4 passages (SET13-P01〜SET13-P04)
- Vocabulary source: `eiken_vocab_database_with_synonyms_utf8_bom(3).csv` の1500語データを参照し、特にQ01〜Q20のtarget_vocabに反映

## Files
- `eiken_pre2_web_ready_with_SET13.sqlite` — SQLite DB with SET01〜SET13
- `question_bank_with_SET13.csv` — question bank with SET13 appended
- `passages_with_SET13.csv` — passages with SET13 appended

## Verification
- question_bank SET13 count: 37
- passages SET13 count: 4
- v_questions_for_quiz SET13 count: 37
- foreign_key_check: OK

## App usage reminder
Use `v_questions_for_quiz` for quiz screens because it does not expose `correct_option` or `explanation_ja`.
Use `v_questions_for_result` only after answer submission.
