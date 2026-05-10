import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module


class EikenPre2QuestionBankTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.bank_path = Path(self.temp_dir.name) / 'eiken_pre2_web_ready.sqlite'
        shutil.copyfile(app_module.get_eiken_pre2_bank_path(), self.bank_path)
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_bank_path_patch = patch.object(app_module, 'get_eiken_pre2_bank_path', return_value=str(self.bank_path))
        self.get_db_path_patch.start()
        self.get_bank_path_patch.start()
        app_module.init_db()
        self.client = app_module.app.test_client()

        conn = app_module.get_db_connection()
        try:
            self.child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Eiken Kid', '5', '準2級'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

    def tearDown(self):
        self.get_bank_path_patch.stop()
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def _set01_answers(self):
        question_set = app_module.get_eiken_pre2_set('SET01', include_correct=True)
        answers = {}
        for section in question_set['sections']:
            for question in section['questions']:
                answers[question['question_id']] = question['correct_option']
        return question_set, answers

    def test_can_list_question_sets(self):
        response = self.client.get('/api/eiken-pre2/sets')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertGreaterEqual(len(payload['sets']), 10)
        self.assertEqual([f'SET{index:02d}' for index in range(1, 11)], [item['set_id'] for item in payload['sets'][:10]])
        self.assertTrue(all(item['question_count'] == 30 for item in payload['sets'][:10]))
        first = payload['sets'][0]
        self.assertIn('set_id', first)
        self.assertIn('title', first)
        self.assertEqual(30, first['question_count'])

    def test_can_get_set_without_exposing_correct_option(self):
        response = self.client.get('/api/eiken-pre2/sets/SET01/questions')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual('SET01', payload['set_id'])
        self.assertEqual(30, payload['question_count'])
        self.assertTrue(payload['sections'])
        self.assertNotIn('correct_option', json.dumps(payload, ensure_ascii=False))
        self.assertNotIn('explanation_ja', json.dumps(payload, ensure_ascii=False))
        self.assertIn('question_text_ja', json.dumps(payload, ensure_ascii=False))
        self.assertIn('text_ja', json.dumps(payload, ensure_ascii=False))
        self.assertIn('弟は一人で料理するには幼すぎる', json.dumps(payload, ensure_ascii=False))

        reading_questions = [
            question
            for section in payload['sections']
            for question in section['questions']
            if question.get('passage_id')
        ]
        self.assertTrue(reading_questions)
        self.assertIn('passage', reading_questions[0])

    def test_submit_attempt_scores_and_saves_per_question_records(self):
        question_set, answers = self._set01_answers()
        first_question_id = question_set['sections'][0]['questions'][0]['question_id']
        answers[first_question_id] = 'A' if answers[first_question_id] != 'A' else 'B'

        response = self.client.post(
            '/api/eiken-pre2/attempts',
            json={
                'attempt_id': 'attempt-test-1',
                'student_id': self.child_id,
                'set_id': 'SET01',
                'started_at': '2026-05-10T10:00:00',
                'answers': answers,
            },
        )
        self.assertEqual(201, response.status_code)
        result = response.get_json()
        self.assertEqual('attempt-test-1', result['attempt_id'])
        self.assertEqual(30, result['total_questions'])
        self.assertEqual(29, result['correct_count'])
        self.assertEqual(96.7, result['score_percent'])
        self.assertEqual(1, len(result['wrong_questions']))
        self.assertEqual(first_question_id, result['wrong_questions'][0]['question_id'])
        self.assertIn('correct_option', result['wrong_questions'][0])
        self.assertIn('explanation_ja', result['wrong_questions'][0])
        self.assertTrue(result['wrong_questions'][0]['explanation_ja'])
        self.assertTrue(result['type_stats'])

        conn = app_module.get_eiken_pre2_bank_connection()
        try:
            attempt = conn.execute(
                'SELECT * FROM attempts WHERE attempt_id = ?',
                ('attempt-test-1',),
            ).fetchone()
            self.assertIsNotNone(attempt)
            self.assertEqual(str(self.child_id), attempt['student_id'])
            self.assertEqual(29, attempt['correct_count'])

            answer_count = conn.execute(
                'SELECT COUNT(*) AS count FROM student_answers WHERE attempt_id = ?',
                ('attempt-test-1',),
            ).fetchone()['count']
            self.assertEqual(30, answer_count)
        finally:
            conn.close()

    def test_can_fetch_attempt_result_and_wrong_questions(self):
        _, answers = self._set01_answers()
        first_question_id = next(iter(answers))
        answers[first_question_id] = 'A' if answers[first_question_id] != 'A' else 'B'

        submit_response = self.client.post(
            '/api/eiken-pre2/attempts',
            json={
                'attempt_id': 'attempt-test-2',
                'student_id': self.child_id,
                'set_id': 'SET01',
                'answers': answers,
            },
        )
        self.assertEqual(201, submit_response.status_code)

        result_response = self.client.get('/api/eiken-pre2/attempts/attempt-test-2/result')
        self.assertEqual(200, result_response.status_code)
        result_payload = result_response.get_json()
        self.assertEqual(1, len(result_payload['wrong_questions']))
        self.assertIn('explanation_ja', result_payload['wrong_questions'][0])
        self.assertTrue(result_payload['wrong_questions'][0]['explanation_ja'])
        self.assertIn('vocabulary_notes_ja', result_payload['wrong_questions'][0])
        self.assertTrue(result_payload['wrong_questions'][0]['vocabulary_notes_ja'])
        for key in ['question_text', 'question_text_ja', 'option_A', 'option_B', 'option_C', 'option_D', 'option_A_ja', 'option_B_ja', 'option_C_ja', 'option_D_ja', 'student_answer', 'correct_option']:
            self.assertIn(key, result_payload['wrong_questions'][0])

        wrong_response = self.client.get(f'/api/eiken-pre2/students/{self.child_id}/wrong-answers?latest_only=1')
        self.assertEqual(200, wrong_response.status_code)
        wrong_payload = wrong_response.get_json()
        self.assertEqual(1, len(wrong_payload['wrong_questions']))
        self.assertEqual(first_question_id, wrong_payload['wrong_questions'][0]['question_id'])
        self.assertIn('explanation_ja', wrong_payload['wrong_questions'][0])
        self.assertTrue(wrong_payload['wrong_questions'][0]['explanation_ja'])
        self.assertIn('vocabulary_notes_ja', wrong_payload['wrong_questions'][0])
        self.assertTrue(wrong_payload['wrong_questions'][0]['vocabulary_notes_ja'])

    def test_duplicate_attempt_id_is_rejected(self):
        _, answers = self._set01_answers()
        payload = {
            'attempt_id': 'attempt-duplicate',
            'student_id': self.child_id,
            'set_id': 'SET01',
            'answers': answers,
        }
        self.assertEqual(201, self.client.post('/api/eiken-pre2/attempts', json=payload).status_code)
        self.assertEqual(409, self.client.post('/api/eiken-pre2/attempts', json=payload).status_code)

    def test_review_attempt_can_save_only_selected_question_ids(self):
        question_set, answers = self._set01_answers()
        selected_questions = [
            question_set['sections'][0]['questions'][0]['question_id'],
            question_set['sections'][0]['questions'][1]['question_id'],
        ]
        response = self.client.post(
            '/api/eiken-pre2/attempts',
            json={
                'attempt_id': 'attempt-review-subset',
                'student_id': self.child_id,
                'set_id': 'SET01',
                'question_ids': selected_questions,
                'answers': {question_id: answers[question_id] for question_id in selected_questions},
            },
        )
        self.assertEqual(201, response.status_code)
        payload = response.get_json()
        self.assertEqual(2, payload['total_questions'])
        self.assertEqual(2, payload['correct_count'])

        conn = app_module.get_eiken_pre2_bank_connection()
        try:
            answer_count = conn.execute(
                'SELECT COUNT(*) AS count FROM student_answers WHERE attempt_id = ?',
                ('attempt-review-subset',),
            ).fetchone()['count']
            self.assertEqual(2, answer_count)
        finally:
            conn.close()

    def test_explanation_fallback_text_exists_in_result_and_review_ui(self):
        card = Path(app_module.app.root_path) / 'frontend' / 'src' / 'components' / 'WrongQuestionCard.jsx'
        practice_page = Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'EikenPre2PracticePage.jsx'
        review_page = Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'EikenPre2WrongReviewPage.jsx'

        self.assertIn('解説はまだ準備中です。', card.read_text(encoding='utf-8'))
        self.assertIn('WrongQuestionCard', practice_page.read_text(encoding='utf-8'))
        self.assertIn('WrongQuestionCard', review_page.read_text(encoding='utf-8'))

    def test_ai_training_start_answer_timeout_complete_and_retry(self):
        start_response = self.client.post(
            '/api/eiken-pre2/attempts/start',
            json={'student_id': str(self.child_id), 'set_id': 'SET02', 'mode': 'ai_training'},
        )
        self.assertEqual(201, start_response.status_code)
        started = start_response.get_json()
        self.assertEqual('in_progress', started['status'])
        self.assertEqual(30, started['total_questions'])

        question_response = self.client.get('/api/eiken-pre2/sets/SET02/questions')
        self.assertEqual(200, question_response.status_code)
        question_payload = question_response.get_json()
        self.assertNotIn('correct_option', json.dumps(question_payload, ensure_ascii=False))
        self.assertNotIn('explanation_ja', json.dumps(question_payload, ensure_ascii=False))
        first_question = question_payload['questions'][0]

        answer_response = self.client.post(
            f"/api/eiken-pre2/attempts/{started['attempt_id']}/answer",
            json={
                'question_id': first_question['question_id'],
                'student_answer': 'A',
                'time_spent_seconds': 18,
                'timed_out': False,
            },
        )
        self.assertEqual(200, answer_response.status_code)
        answer_payload = answer_response.get_json()
        self.assertIn('is_correct', answer_payload)
        self.assertIn('explanation_ja', answer_payload)

        duplicate_response = self.client.post(
            f"/api/eiken-pre2/attempts/{started['attempt_id']}/answer",
            json={
                'question_id': first_question['question_id'],
                'student_answer': 'B',
                'time_spent_seconds': 20,
                'timed_out': False,
            },
        )
        self.assertEqual(200, duplicate_response.status_code)

        second_question = question_payload['questions'][1]
        timeout_response = self.client.post(
            f"/api/eiken-pre2/attempts/{started['attempt_id']}/answer",
            json={
                'question_id': second_question['question_id'],
                'student_answer': '',
                'time_spent_seconds': 45,
                'timed_out': True,
            },
        )
        self.assertEqual(200, timeout_response.status_code)
        timeout_payload = timeout_response.get_json()
        self.assertFalse(timeout_payload['is_correct'])
        self.assertTrue(timeout_payload['timed_out'])
        self.assertEqual('', timeout_payload['student_answer'])

        conn = app_module.get_eiken_pre2_bank_connection()
        try:
            row_count = conn.execute(
                'SELECT COUNT(*) AS count FROM student_answers WHERE attempt_id = ? AND question_id = ?',
                (started['attempt_id'], first_question['question_id']),
            ).fetchone()['count']
            self.assertEqual(1, row_count)
        finally:
            conn.close()

        complete_response = self.client.post(f"/api/eiken-pre2/attempts/{started['attempt_id']}/complete", json={})
        self.assertEqual(200, complete_response.status_code)
        complete_payload = complete_response.get_json()
        self.assertEqual('completed', complete_payload['status'])
        self.assertIn('wrong_questions', complete_payload)
        self.assertEqual(2, complete_payload['answered_count'])

        retry_response = self.client.post(
            '/api/eiken-pre2/attempts/start',
            json={'student_id': str(self.child_id), 'source_attempt_id': started['attempt_id']},
        )
        self.assertEqual(201, retry_response.status_code)
        retry_payload = retry_response.get_json()
        self.assertNotEqual(started['attempt_id'], retry_payload['attempt_id'])
        self.assertEqual('wrong_review', retry_payload['mode'])
        self.assertGreaterEqual(retry_payload['total_questions'], 1)


if __name__ == '__main__':
    unittest.main()
