-- 1. Get set list
SELECT set_id, COUNT(*) AS question_count FROM question_bank GROUP BY set_id ORDER BY set_id;

-- 2. Get quiz questions without answers/explanations
SELECT * FROM v_questions_for_quiz WHERE set_id = 'SET01' ORDER BY question_no;

-- 3. Get passages for one set
SELECT * FROM passages WHERE set_id = 'SET01' ORDER BY passage_no;

-- 4. Backend grading query for submitted answers
SELECT question_id, correct_option, weak_point_tag FROM question_bank WHERE set_id = 'SET01';

-- 5. Result detail with Japanese explanation
SELECT qb.question_id, qb.question_no, qb.prompt, qb.question_text_ja,
       sa.student_answer, qb.correct_option, qb.correct_answer_text,
       qb.explanation_ja, qb.vocabulary_notes_ja, sa.is_correct
FROM student_answers sa
JOIN question_bank qb ON qb.question_id = sa.question_id
WHERE sa.attempt_id = 'A001'
ORDER BY qb.question_no;

-- 6. Wrong-question review for one student
SELECT * FROM v_wrong_answers WHERE student_id = 'S001' ORDER BY answered_at DESC;

-- 7. Weak point count
SELECT weak_point_tag, COUNT(*) AS wrong_count
FROM student_answers
WHERE student_id = 'S001' AND is_correct = 0
GROUP BY weak_point_tag
ORDER BY wrong_count DESC;
