import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module


class BattleSystemTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'battle_test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()
        self.client = app_module.app.test_client()
        conn = app_module.get_db_connection()
        try:
            self.child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Battle Kid', '5', '準2級'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_capture_rate_rules(self):
        self.assertEqual(1.0, app_module.calculateCaptureRate(5, 5))
        self.assertEqual(0.9, app_module.calculateCaptureRate(4, 5))
        self.assertEqual(0.7, app_module.calculateCaptureRate(3, 5))
        self.assertEqual(0.4, app_module.calculateCaptureRate(2, 5))
        self.assertEqual(0.0, app_module.calculateCaptureRate(1, 5))

    def test_start_battle_hides_answers(self):
        response = self.client.post('/api/battle/start', json={'child_id': self.child_id})
        self.assertEqual(201, response.status_code)
        payload = response.get_json()
        self.assertEqual(5, len(payload['questions']))
        self.assertEqual('in_progress', payload['battleSession']['status'])
        serialized = json.dumps(payload['questions'], ensure_ascii=False)
        self.assertNotIn('correctAnswer', serialized)
        self.assertNotIn('explanation', serialized)

    def test_answer_saves_wrong_question_and_prevents_duplicates(self):
        started = self.client.post('/api/battle/start', json={'child_id': self.child_id}).get_json()
        session_id = started['battleSession']['id']
        first_question = started['questions'][0]
        response = self.client.post(
            f'/api/battle/{session_id}/answer',
            json={'question_id': first_question['id'], 'selected_answer': '__wrong__'},
        )
        self.assertEqual(200, response.status_code)
        result = response.get_json()
        self.assertFalse(result['isCorrect'])
        self.assertIn('correctAnswer', result)
        self.assertIn('explanation', result)

        duplicate = self.client.post(
            f'/api/battle/{session_id}/answer',
            json={'question_id': first_question['id'], 'selected_answer': first_question['choices'][0]},
        )
        self.assertEqual(200, duplicate.status_code)

        conn = app_module.get_db_connection()
        try:
            answer_count = conn.execute(
                'SELECT COUNT(*) AS count FROM battle_answer_results WHERE battle_session_id = ? AND question_id = ?',
                (session_id, first_question['id']),
            ).fetchone()['count']
            wrong_count = conn.execute(
                'SELECT COUNT(*) AS count FROM grammar_wrong_questions WHERE child_id = ?',
                (self.child_id,),
            ).fetchone()['count']
            self.assertEqual(1, answer_count)
            self.assertEqual(1, wrong_count)
        finally:
            conn.close()

    def test_perfect_battle_can_capture_monster(self):
        started = self.client.post('/api/battle/start', json={'child_id': self.child_id}).get_json()
        session_id = started['battleSession']['id']

        conn = app_module.get_db_connection()
        try:
            correct_by_id = {
                row['id']: row['correct_answer']
                for row in conn.execute('SELECT id, correct_answer FROM grammar_questions').fetchall()
            }
        finally:
            conn.close()

        for question in started['questions']:
            response = self.client.post(
                f'/api/battle/{session_id}/answer',
                json={'question_id': question['id'], 'selected_answer': correct_by_id[question['id']]},
            )
            self.assertEqual(200, response.status_code)

        capture = self.client.post(f'/api/battle/{session_id}/capture', json={})
        self.assertEqual(200, capture.status_code)
        payload = capture.get_json()
        self.assertTrue(payload['success'])
        self.assertEqual('captured', payload['battleSession']['status'])

        collection = self.client.get(f'/api/battle/monsters?child_id={self.child_id}')
        self.assertEqual(200, collection.status_code)
        monsters = collection.get_json()['monsters']
        self.assertTrue(any(monster['captured'] for monster in monsters))


if __name__ == '__main__':
    unittest.main()
