import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['DATABASE_URL'] = ''
os.environ['USE_POSTGRES'] = ''

import app as app_module


class GrammarLessonRewardSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'grammar_rewards_test.db'
        self.env_patch = patch.dict(
            os.environ,
            {
                'DATABASE_URL': '',
                'USE_POSTGRES': '',
            },
            clear=False,
        )
        self.get_db_path_patch = patch.object(
            app_module,
            'get_db_path',
            return_value=str(self.db_path),
        )
        self.reward_codes_patch = patch.object(
            app_module,
            'GRAMMAR_LESSON_REWARD_HERO_CODES',
            ['grammar-hero-a', 'grammar-hero-b', 'grammar-hero-c'],
        )
        self.completion_code_patch = patch.object(
            app_module,
            'GRAMMAR_COMPLETION_REWARD_HERO_CODE',
            'grammar-complete',
        )
        self.env_patch.start()
        self.get_db_path_patch.start()
        self.reward_codes_patch.start()
        self.completion_code_patch.start()
        app_module._DB_INITIALIZED = False

    def tearDown(self):
        self.completion_code_patch.stop()
        self.reward_codes_patch.stop()
        self.get_db_path_patch.stop()
        self.env_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def _create_schema(self):
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                '''
                CREATE TABLE grammar_lessons (
                    lesson_id TEXT PRIMARY KEY,
                    level TEXT,
                    display_order INTEGER,
                    is_active INTEGER DEFAULT 1
                )
                '''
            )
            conn.execute(
                '''
                CREATE TABLE heroes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE
                )
                '''
            )
            for code in [
                'grammar-hero-a',
                'grammar-hero-b',
                'grammar-hero-c',
                'grammar-complete',
            ]:
                conn.execute('INSERT INTO heroes (code) VALUES (?)', (code,))
            conn.commit()
            return conn
        except Exception:
            conn.close()
            raise

    def _insert_lessons(self, conn, lesson_ids):
        for index, lesson_id in enumerate(lesson_ids, start=1):
            conn.execute(
                '''
                INSERT INTO grammar_lessons (lesson_id, level, display_order, is_active)
                VALUES (?, 'eiken_pre2', ?, 1)
                ''',
                (lesson_id, index),
            )
        conn.commit()

    def _reward_rows(self, conn):
        return conn.execute(
            '''
            SELECT lesson_id, is_active
            FROM grammar_lesson_rewards
            ORDER BY lesson_id
            '''
        ).fetchall()

    def test_sync_multiple_lesson_ids(self):
        conn = self._create_schema()
        try:
            self._insert_lessons(conn, ['GR-P2-CORE-001', 'GR-P2-CORE-002'])
            result = app_module.sync_grammar_lesson_reward_mappings(conn)
            rows = self._reward_rows(conn)

            self.assertEqual(['GR-P2-CORE-001', 'GR-P2-CORE-002'], result['lesson_ids'])
            self.assertEqual(2, result['mapped_count'])
            self.assertEqual(['GR-P2-CORE-001', 'GR-P2-CORE-002'], [row['lesson_id'] for row in rows])
            self.assertEqual([1, 1], [row['is_active'] for row in rows])
        finally:
            conn.close()

    def test_sync_single_lesson_id(self):
        conn = self._create_schema()
        try:
            self._insert_lessons(conn, ['GR-P2-CORE-001'])
            result = app_module.sync_grammar_lesson_reward_mappings(conn)
            rows = self._reward_rows(conn)

            self.assertEqual(['GR-P2-CORE-001'], result['lesson_ids'])
            self.assertEqual(1, result['mapped_count'])
            self.assertEqual(1, len(rows))
            self.assertEqual('GR-P2-CORE-001', rows[0]['lesson_id'])
        finally:
            conn.close()

    def test_sync_empty_lesson_ids_returns_before_dynamic_in_clause(self):
        conn = self._create_schema()
        try:
            result = app_module.sync_grammar_lesson_reward_mappings(conn)

            self.assertEqual({'lesson_ids': [], 'mapped_count': 0, 'missing_hero_codes': []}, result)
            self.assertEqual([], self._reward_rows(conn))
        finally:
            conn.close()

    def test_postgres_transformed_like_placeholders_match_params(self):
        lesson_ids = ['GR-P2-CORE-001', 'GR-P2-CORE-002']
        placeholders = ', '.join(['?'] * len(lesson_ids))
        sql = f'''
            UPDATE grammar_lesson_rewards
            SET is_active = 0
            WHERE lesson_id NOT IN ({placeholders})
              AND lesson_id LIKE ?
        '''
        params = (*lesson_ids, 'G-PREP2-%')

        transformed = app_module._pg_transform_sql(sql)

        self.assertEqual(len(params), transformed.count('%s'))
        self.assertNotIn("LIKE 'G-PREP2-%'", transformed)
        try:
            transformed % params
        except (IndexError, TypeError, ValueError) as exc:
            self.fail(f'PostgreSQL placeholder formatting failed: {exc}')


if __name__ == '__main__':
    unittest.main()
