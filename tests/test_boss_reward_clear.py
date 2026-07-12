import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['DATABASE_URL'] = ''
os.environ['USE_POSTGRES'] = ''

import app as app_module


class BossRewardClearTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'boss_reward_test.db'
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
        self.env_patch.start()
        self.get_db_path_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db()
        self.boss_id = 'wind-stage-4-mini-boss-1'
        self.child_id, self.hero_id = self._prepare_test_data()
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
                VALUES (?, 'test', 'Boss Reward Test')
                ''',
                ('boss-reward@example.test',),
            )
            child_cursor = conn.execute(
                '''
                INSERT INTO children (account_id, name, grade, target_level)
                VALUES (?, 'Boss Child', '4', 'eiken_pre2')
                ''',
                (account_cursor.lastrowid,),
            )
            hero_cursor = conn.execute(
                '''
                INSERT INTO heroes (
                    world_id, code, name_ja, name_cn, rarity, image_url,
                    description_ja, description_cn, collection_type, collection_key
                ) VALUES (
                    'wind', ?, 'Wind Mini Boss',
                    'Wind Mini Boss', 'SR', '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
                    '', '', 'boss', 'boss'
                )
                ''',
                (self.boss_id,),
            )
            conn.commit()
            return child_cursor.lastrowid, hero_cursor.lastrowid
        finally:
            conn.close()

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

    def test_boss_clear_grants_card_and_returns_reward_queue(self):
        response = self.client.post(
            f'/api/children/{self.child_id}/bosses/{self.boss_id}/clear'
        )
        payload = response.get_json()

        self.assertEqual(200, response.status_code)
        self.assertTrue(payload['success'])
        self.assertFalse(payload['already_owned'])
        self.assertEqual(1, len(payload['reward_queue']))
        self.assertEqual(self.boss_id, payload['reward_queue'][0]['boss_id'])
        self.assertEqual('boss_card', payload['reward_queue'][0]['reward_type'])
        self.assertEqual('code=boss_id collection_type=boss_or_boss_card', payload['match_method'])
        self.assertEqual(1, self._owned_count())

    def test_boss_clear_returns_queue_when_card_already_owned(self):
        first = self.client.post(
            f'/api/children/{self.child_id}/bosses/{self.boss_id}/clear'
        )
        self.assertEqual(200, first.status_code)

        second = self.client.post(
            f'/api/children/{self.child_id}/bosses/{self.boss_id}/clear'
        )
        payload = second.get_json()

        self.assertEqual(200, second.status_code)
        self.assertTrue(payload['success'])
        self.assertTrue(payload['already_owned'])
        self.assertEqual(1, len(payload['reward_queue']))
        self.assertEqual(1, self._owned_count())

    def test_boss_clear_returns_404_when_no_matching_boss_card(self):
        response = self.client.post(
            f'/api/children/{self.child_id}/bosses/missing-boss/clear'
        )

        self.assertEqual(404, response.status_code)
        self.assertEqual(0, self._owned_count())


if __name__ == '__main__':
    unittest.main()
