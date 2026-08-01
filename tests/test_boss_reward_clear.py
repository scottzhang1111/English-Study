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
        self.child_id, self.hero_ids = self._prepare_test_data()
        self.hero_id = self.hero_ids[self.boss_id]
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
            hero_ids = {}
            boss_rows = [
                ('wind-stage-4-mini-boss-1', 'Wind Mini Boss 1', '/assets/eigo-quest/cards/boss/wind-mini-boss1.png'),
                ('wind-stage-8-mini-boss-2', 'Wind Mini Boss 2', '/assets/eigo-quest/cards/boss/wind-mini-boss2.png'),
                ('wind-stage-10-world-boss', 'Wind World Boss', '/assets/eigo-quest/cards/boss/wind-world-boss.png'),
            ]
            for boss_id, name, image_url in boss_rows:
                hero_cursor = conn.execute(
                    '''
                    INSERT INTO heroes (
                        world_id, code, name_ja, name_cn, rarity, image_url,
                        description_ja, description_cn, collection_type, collection_key
                    ) VALUES (
                        'wind', ?, ?,
                        ?, 'SR', ?,
                        '', '', 'boss', 'boss'
                    )
                    ''',
                    (boss_id, name, name, image_url),
                )
                hero_ids[boss_id] = hero_cursor.lastrowid
            conn.executemany(
                '''
                INSERT INTO child_world_stage_progress (child_id, world_id, stage_number, status, cleared_at)
                VALUES (?, 'wind', ?, 'cleared', CURRENT_TIMESTAMP)
                ''',
                [(child_cursor.lastrowid, stage) for stage in range(1, 11)],
            )
            conn.commit()
            return child_cursor.lastrowid, hero_ids
        finally:
            conn.close()

    def _owned_count(self, hero_id=None):
        conn = app_module.get_db_connection()
        try:
            row = conn.execute(
                '''
                SELECT COUNT(*) AS count
                FROM child_heroes
                WHERE child_id = ? AND hero_id = ?
                ''',
                (self.child_id, hero_id or self.hero_id),
            ).fetchone()
            return int(row['count'] or 0)
        finally:
            conn.close()

    def _progress_count(self, boss_id=None):
        conn = app_module.get_db_connection()
        try:
            row = conn.execute(
                '''
                SELECT COUNT(*) AS count
                FROM child_boss_progress
                WHERE child_id = ? AND boss_id = ? AND status = 'cleared'
                ''',
                (self.child_id, boss_id or self.boss_id),
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
        self.assertEqual(self.boss_id, payload['bossProgress']['bossId'])
        self.assertEqual('cleared', payload['bossProgress']['status'])
        self.assertEqual('code=boss_id collection_type=boss_or_boss_card', payload['match_method'])
        self.assertEqual(1, self._owned_count())
        self.assertEqual(1, self._progress_count())

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
        self.assertEqual(1, self._progress_count())

    def test_mini_boss_2_clear_writes_progress(self):
        boss_id = 'wind-stage-8-mini-boss-2'
        response = self.client.post(
            f'/api/children/{self.child_id}/boss-progress/clear',
            json={
                'boss_id': boss_id,
                'world_id': 'wind',
                'stage_number': 8,
                'boss_type': 'mini_boss',
            },
        )
        payload = response.get_json()

        self.assertEqual(200, response.status_code)
        self.assertEqual(boss_id, payload['bossProgress']['bossId'])
        self.assertEqual(1, self._progress_count(boss_id))
        self.assertEqual(1, self._owned_count(self.hero_ids[boss_id]))

    def test_final_boss_clear_updates_world_progress_unlock(self):
        boss_id = 'wind-stage-10-world-boss'
        response = self.client.post(
            f'/api/children/{self.child_id}/boss-progress/clear',
            json={
                'boss_id': boss_id,
                'world_id': 'wind',
                'stage_number': 10,
                'boss_type': 'world_boss',
            },
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual(1, self._progress_count(boss_id))

        progress = app_module.get_child_eigo_quest_progress(self.child_id)
        wind = next(world for world in progress['worlds'] if world['id'] == 'wind')
        fire = next(world for world in progress['worlds'] if world['id'] == 'fire')
        self.assertTrue(wind['cleared'])
        self.assertTrue(wind['final_boss_cleared'])
        self.assertTrue(fire['unlocked'])

    def test_invalid_boss_id_returns_400(self):
        response = self.client.post(
            f'/api/children/{self.child_id}/boss-progress/clear',
            json={'boss_id': 'not-a-boss'},
        )
        self.assertEqual(400, response.status_code)

    def test_boss_payload_mismatch_returns_400(self):
        response = self.client.post(
            f'/api/children/{self.child_id}/boss-progress/clear',
            json={
                'boss_id': self.boss_id,
                'world_id': 'fire',
                'stage_number': 4,
                'boss_type': 'mini_boss',
            },
        )
        self.assertEqual(400, response.status_code)

    def test_missing_child_returns_404(self):
        response = self.client.post(
            '/api/children/999999/boss-progress/clear',
            json={'boss_id': self.boss_id},
        )
        self.assertEqual(404, response.status_code)

    def test_get_boss_progress_only_returns_current_child(self):
        conn = app_module.get_db_connection()
        try:
            account_id = conn.execute('SELECT account_id FROM children WHERE id = ?', (self.child_id,)).fetchone()['account_id']
            other_child = conn.execute(
                '''
                INSERT INTO children (account_id, name, grade, target_level)
                VALUES (?, 'Other Boss Child', '4', 'eiken_pre2')
                ''',
                (account_id,),
            ).lastrowid
            conn.execute(
                '''
                INSERT INTO child_boss_progress (child_id, boss_id, world_id, stage_number, boss_type, status, cleared_at)
                VALUES (?, 'wind-stage-4-mini-boss-1', 'wind', 4, 'mini_boss', 'cleared', CURRENT_TIMESTAMP)
                ''',
                (other_child,),
            )
            conn.commit()
        finally:
            conn.close()

        self.client.post(f'/api/children/{self.child_id}/bosses/{self.boss_id}/clear')
        response = self.client.get(f'/api/children/{self.child_id}/boss-progress')
        payload = response.get_json()

        self.assertEqual(200, response.status_code)
        self.assertEqual([self.boss_id], [item['bossId'] for item in payload['items']])

    def test_missing_boss_card_rolls_back_progress(self):
        boss_id = 'fire-stage-4-mini-boss-1'
        response = self.client.post(
            f'/api/children/{self.child_id}/boss-progress/clear',
            json={'boss_id': boss_id},
        )

        self.assertEqual(404, response.status_code)
        self.assertEqual(0, self._progress_count(boss_id))

    def test_legacy_boss_clear_rejects_invalid_boss_id(self):
        response = self.client.post(
            f'/api/children/{self.child_id}/bosses/missing-boss/clear'
        )

        self.assertEqual(400, response.status_code)
        self.assertEqual(0, self._owned_count())


if __name__ == '__main__':
    unittest.main()
