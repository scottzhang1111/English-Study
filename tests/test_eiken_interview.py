import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['DATABASE_URL'] = ' '

import app as app_module
from scripts import seed_pre2_interview as seed_module


class EikenInterviewApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.db_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.db_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db()

        self.records = seed_module.validate_source(seed_module.DEFAULT_SOURCE_DIR)
        conn = app_module.get_db_connection()
        try:
            seed_module.ensure_schema(conn)
            seed_module.upsert_records(conn, self.records)
            seed_module.upsert_records(conn, self.records)
            conn.commit()
        finally:
            conn.close()
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.db_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def test_schema_and_idempotent_seed_have_ten_sets_and_fifty_questions(self):
        conn = app_module.get_db_connection()
        try:
            set_count = conn.execute('SELECT COUNT(*) AS count FROM eiken_interview_sets').fetchone()['count']
            question_count = conn.execute('SELECT COUNT(*) AS count FROM eiken_interview_questions').fetchone()['count']
            per_set = conn.execute(
                '''
                SELECT set_id, COUNT(*) AS count
                FROM eiken_interview_questions
                GROUP BY set_id
                ORDER BY set_id
                '''
            ).fetchall()
            foreign_keys = conn.execute('PRAGMA foreign_key_list(eiken_interview_questions)').fetchall()
        finally:
            conn.close()
        self.assertEqual(10, set_count)
        self.assertEqual(50, question_count)
        self.assertEqual([5] * 10, [row['count'] for row in per_set])
        self.assertTrue(any(row[2] == 'eiken_interview_sets' and row[3] == 'set_id' for row in foreign_keys))

    def test_list_and_detail_endpoints_return_seeded_content(self):
        list_response = self.client.get('/api/eiken-interview/sets')
        self.assertEqual(200, list_response.status_code)
        sets = list_response.get_json()['sets']
        self.assertEqual(10, len(sets))
        self.assertEqual('PRE2_INT_001', sets[0]['external_id'])
        self.assertNotIn('passage_text', sets[0])

        detail_response = self.client.get('/api/eiken-interview/sets/1')
        self.assertEqual(200, detail_response.status_code)
        payload = detail_response.get_json()['set']
        self.assertEqual('PRE2_INT_001', payload['external_id'])
        self.assertTrue(payload['passage_text'])
        self.assertEqual(5, len(payload['questions']))
        self.assertEqual([1, 2, 3, 4, 5], [item['question_order'] for item in payload['questions']])
        self.assertEqual('/api/eiken-interview/assets/PRE2_INT_001.png', payload['image_url'])

    def test_asset_route_serves_only_whitelisted_png_files(self):
        response = self.client.get('/api/eiken-interview/assets/PRE2_INT_001.png')
        try:
            self.assertEqual(200, response.status_code)
            self.assertEqual('image/png', response.content_type)
            self.assertTrue(response.data.startswith(b'\x89PNG\r\n\x1a\n'))
        finally:
            response.close()

        self.assertEqual(404, self.client.get('/api/eiken-interview/assets/PRE2_INT_011.png').status_code)
        self.assertEqual(404, self.client.get('/api/eiken-interview/assets/..%2Fapp.py').status_code)
        self.assertEqual(404, self.client.get('/api/eiken-interview/assets/nested%2FPRE2_INT_001.png').status_code)

    def test_seed_default_mode_is_dry_run(self):
        with patch.object(seed_module, 'connect_database', side_effect=AssertionError('dry-run connected to DB')):
            self.assertEqual(0, seed_module.main(['--source-dir', str(seed_module.DEFAULT_SOURCE_DIR)]))


if __name__ == '__main__':
    unittest.main()
