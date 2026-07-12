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


class GrammarLessonRewardGrantTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'grammar_reward_grant_test.db'
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
            ['grammar-hero-a'],
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
        app_module.init_db()
        self.lesson_id = 'GR-P2-CORE-001'
        self.hero_code = 'grammar-hero-a'
        self.hero_id = None
        self.child_id = self._prepare_test_data()
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.completion_code_patch.stop()
        self.reward_codes_patch.stop()
        self.get_db_path_patch.stop()
        self.env_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def _prepare_test_data(self):
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                '''
                CREATE TABLE grammar_lessons (
                    lesson_id TEXT PRIMARY KEY,
                    grammar_id INTEGER,
                    level TEXT NOT NULL,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL,
                    grammar_point TEXT,
                    jp_explanation TEXT,
                    jp_example TEXT,
                    en_example TEXT,
                    learning_goal TEXT,
                    display_order INTEGER NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    patterns_json TEXT
                )
                '''
            )
            conn.execute(
                '''
                CREATE TABLE grammar_quizzes (
                    quiz_id TEXT PRIMARY KEY,
                    lesson_id TEXT NOT NULL,
                    question_jp TEXT NOT NULL,
                    choice_a TEXT NOT NULL,
                    choice_b TEXT NOT NULL,
                    choice_c TEXT NOT NULL,
                    choice_d TEXT NOT NULL,
                    answer_index INTEGER NOT NULL,
                    explanation_jp TEXT,
                    difficulty INTEGER NOT NULL DEFAULT 2,
                    quiz_order INTEGER NOT NULL DEFAULT 0
                )
                '''
            )
            conn.execute(
                '''
                CREATE TABLE heroes (
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
            account_id = conn.execute('SELECT id FROM accounts ORDER BY id LIMIT 1').fetchone()['id']
            child_cursor = conn.execute(
                '''
                INSERT INTO children (account_id, name, grade, target_level)
                VALUES (?, 'Grammar Child', '4', 'eiken_pre2')
                ''',
                (account_id,),
            )
            conn.execute(
                '''
                INSERT INTO grammar_lessons (
                    lesson_id, grammar_id, level, category, title, grammar_point,
                    jp_explanation, jp_example, en_example, learning_goal,
                    display_order, is_active, patterns_json
                ) VALUES (?, 501, 'eiken_pre2', 'Core', 'Grammar Core 1', 'Point',
                    'Explanation', 'JP example', 'EN example', 'Goal', 1, 1, '[]')
                ''',
                (self.lesson_id,),
            )
            for index in range(5):
                conn.execute(
                    '''
                    INSERT INTO grammar_quizzes (
                        quiz_id, lesson_id, question_jp, choice_a, choice_b,
                        choice_c, choice_d, answer_index, explanation_jp, quiz_order
                    ) VALUES (?, ?, 'Question', 'A', 'B', 'C', 'D', 0, 'Explanation', ?)
                    ''',
                    (f'{self.lesson_id}-Q{index + 1}', self.lesson_id, index + 1),
                )
            hero_cursor = conn.execute(
                '''
                INSERT INTO heroes (
                    world_id, code, name_ja, name_cn, rarity, image_url,
                    description_ja, description_cn, collection_type, collection_key
                ) VALUES (
                    'wind', ?, 'Grammar Hero A', 'Grammar Hero A', 'SR',
                    '/assets/eigo-quest/learning-hub/grammar-cards/grammar-hero-a.png',
                    'Grammar hero reward', '', 'grammar', 'temple'
                )
                ''',
                (self.hero_code,),
            )
            self.hero_id = hero_cursor.lastrowid
            conn.execute(
                '''
                INSERT INTO heroes (code, name_ja, rarity, image_url, collection_type, collection_key)
                VALUES ('grammar-complete', 'Complete', 'LEGEND', '/complete.png', 'grammar', 'temple')
                '''
            )
            app_module.ensure_grammar_reward_tables(conn)
            conn.execute(
                '''
                INSERT INTO grammar_lesson_rewards (lesson_id, hero_id, reward_type, is_active)
                VALUES (?, ?, 'lesson', 1)
                ''',
                (self.lesson_id, self.hero_id),
            )
            conn.commit()
            return child_cursor.lastrowid
        finally:
            conn.close()

    def _answers(self, correct=True):
        return [
            {
                'quiz_id': f'{self.lesson_id}-Q{index + 1}',
                'selected_index': 0 if correct else 1,
            }
            for index in range(5)
        ]

    def _owned_count(self):
        conn = app_module.get_db_connection()
        try:
            row = conn.execute(
                '''
                SELECT COUNT(*) AS count
                FROM child_heroes
                WHERE child_id = ? AND hero_id = ?
                ''',
                (self.child_id, self.hero_id),
            ).fetchone()
            return int(row['count'] or 0)
        finally:
            conn.close()

    def test_final_lesson_submit_grants_new_hero_to_child_heroes(self):
        response = self.client.post(
            f'/api/grammar/lessons/{self.lesson_id}/submit',
            json={'child_id': self.child_id, 'answers': self._answers(correct=True)},
        )
        payload = response.get_json()

        self.assertEqual(200, response.status_code)
        self.assertTrue(payload['passed'])
        self.assertEqual(1, len(payload['reward_queue']))
        self.assertEqual(self.hero_code, payload['reward_queue'][0]['code'])
        self.assertFalse(payload['reward_queue'][0]['already_owned'])
        self.assertEqual(1, self._owned_count())

    def test_already_owned_reward_is_returned_without_duplicate_insert(self):
        first = self.client.post(
            f'/api/grammar/lessons/{self.lesson_id}/submit',
            json={'child_id': self.child_id, 'answers': self._answers(correct=True)},
        )
        self.assertEqual(200, first.status_code)

        second = self.client.post(
            f'/api/grammar/lessons/{self.lesson_id}/submit',
            json={'child_id': self.child_id, 'answers': self._answers(correct=True)},
        )
        payload = second.get_json()

        self.assertEqual(200, second.status_code)
        self.assertEqual(1, self._owned_count())
        self.assertEqual(1, len(payload['reward_queue']))
        self.assertTrue(payload['reward_queue'][0]['already_owned'])

    def test_missing_lesson_mapping_does_not_generate_fake_reward(self):
        conn = app_module.get_db_connection()
        try:
            conn.execute('DELETE FROM grammar_lesson_rewards WHERE lesson_id = ?', (self.lesson_id,))
            conn.commit()
        finally:
            conn.close()

        with patch.object(app_module, 'sync_grammar_lesson_reward_mappings', return_value={}):
            with self.assertRaises(LookupError):
                app_module.grant_child_grammar_lesson_reward(
                    self.child_id,
                    self.lesson_id,
                    lesson_title='Grammar Core 1',
                    correct_count=5,
                    total_count=5,
                )
        self.assertEqual(0, self._owned_count())

    def test_write_failure_does_not_return_reward_queue(self):
        with patch.object(app_module, 'grant_child_hero_rewards', return_value=[]):
            with self.assertRaises(RuntimeError):
                app_module.grant_child_grammar_lesson_reward(
                    self.child_id,
                    self.lesson_id,
                    lesson_title='Grammar Core 1',
                    correct_count=5,
                    total_count=5,
                )
        self.assertEqual(0, self._owned_count())


if __name__ == '__main__':
    unittest.main()
