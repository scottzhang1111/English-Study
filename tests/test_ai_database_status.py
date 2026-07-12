import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['DATABASE_URL'] = ''
os.environ['USE_POSTGRES'] = ''

import app as app_module


class AIDatabaseStatusTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'ai_status_test.db'
        self.env_patch = patch.dict(
            os.environ,
            {
                'DATABASE_URL': '',
                'USE_POSTGRES': '',
                'AI_DATA_API_KEY': 'test-ai-key',
            },
            clear=False,
        )
        self.get_db_path_patch = patch.object(
            app_module,
            'get_db_path',
            return_value=str(self.db_path),
        )
        self.env_patch.start()
        self.get_db_path_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db()
        self._prepare_test_data()
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.env_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def _prepare_test_data(self):
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                '''
                CREATE TABLE IF NOT EXISTS heroes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    world_id TEXT,
                    code TEXT UNIQUE,
                    name_ja TEXT,
                    name_cn TEXT,
                    rarity TEXT,
                    image_url TEXT,
                    description_ja TEXT,
                    description_cn TEXT,
                    collection_type TEXT,
                    collection_key TEXT
                )
                '''
            )
            account_cursor = conn.execute(
                '''
                INSERT INTO accounts (email, provider, display_name)
                VALUES (?, 'test', 'AI Status Test')
                ''',
                ('ai-status@example.test',),
            )
            account_id = account_cursor.lastrowid
            child_cursor = conn.execute(
                '''
                INSERT INTO children (account_id, name, grade, target_level)
                VALUES (?, 'AI Status Child', '4', 'eiken_pre2')
                ''',
                (account_id,),
            )
            child_id = child_cursor.lastrowid
            hero_cursor = conn.execute(
                '''
                INSERT INTO heroes (code, name_ja, rarity, image_url)
                VALUES ('ai-status-hero', 'AI Status Hero', 'R', '/hero.png')
                '''
            )
            hero_id = hero_cursor.lastrowid
            conn.execute(
                '''
                INSERT INTO child_heroes (child_id, hero_id, hero_code, reward_type)
                VALUES (?, ?, 'ai-status-hero', 'test')
                ''',
                (child_id, hero_id),
            )
            conn.commit()
            self.expected_counts = {
                'children': self._count(conn, 'children'),
                'heroes': self._count(conn, 'heroes'),
                'child_heroes': self._count(conn, 'child_heroes'),
            }
        finally:
            conn.close()

    def _count(self, conn, table_name):
        row = conn.execute(f'SELECT COUNT(*) AS count FROM {table_name}').fetchone()
        return int(row['count'] or 0)

    def _authorized_get(self, query_string=''):
        return self.client.get(
            f'/api/ai/database-status{query_string}',
            headers={'X-AI-API-Key': 'test-ai-key'},
        )

    def test_unconfigured_api_key_returns_503(self):
        with patch.dict(os.environ, {'AI_DATA_API_KEY': ''}, clear=False):
            response = self.client.get(
                '/api/ai/database-status',
                headers={'X-AI-API-Key': 'test-ai-key'},
            )

        self.assertEqual(503, response.status_code)
        self.assertFalse(response.get_json()['ok'])

    def test_missing_api_key_header_returns_401(self):
        response = self.client.get('/api/ai/database-status')

        self.assertEqual(401, response.status_code)
        self.assertEqual('Unauthorized', response.get_json()['error'])

    def test_wrong_api_key_returns_401(self):
        response = self.client.get(
            '/api/ai/database-status',
            headers={'X-AI-API-Key': 'wrong-key'},
        )

        self.assertEqual(401, response.status_code)
        self.assertEqual('Unauthorized', response.get_json()['error'])

    def test_correct_api_key_returns_safe_database_counts(self):
        response = self._authorized_get()
        payload = response.get_json()
        body = json.dumps(payload).lower()

        self.assertEqual(200, response.status_code)
        self.assertTrue(payload['ok'])
        self.assertEqual('sqlite', payload['database']['backend'])
        self.assertEqual(str(self.db_path), payload['database']['location'])
        self.assertEqual(self.expected_counts, payload['counts'])
        self.assertNotIn('database_url', body)
        self.assertNotIn('password', body)
        self.assertNotIn('ai-status@example.test', body)
        self.assertNotIn('ai status child', body)

    def test_post_request_returns_405(self):
        response = self.client.post(
            '/api/ai/database-status',
            headers={'X-AI-API-Key': 'test-ai-key'},
        )

        self.assertEqual(405, response.status_code)

    def test_client_sql_and_table_parameters_are_ignored(self):
        response = self._authorized_get(
            '?sql=SELECT%20name%20FROM%20children&table=children'
        )
        payload = response.get_json()
        body = json.dumps(payload).lower()

        self.assertEqual(200, response.status_code)
        self.assertEqual({'ok', 'database', 'counts'}, set(payload.keys()))
        self.assertEqual(self.expected_counts, payload['counts'])
        self.assertNotIn('select name', body)
        self.assertNotIn('sql', payload)
        self.assertNotIn('table', payload)


if __name__ == '__main__':
    unittest.main()
