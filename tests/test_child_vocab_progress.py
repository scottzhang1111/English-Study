import sqlite3
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module


class ChildVocabProgressSchemaTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def test_schema_and_foreign_keys_exist(self):
        conn = app_module.get_db_connection()
        try:
            tables = {
                row['name']
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('children', 'vocabulary', 'child_vocab_progress', 'daily_study_log', 'child_pokemon_collection', 'pokemon_catalog')"
                ).fetchall()
            }
            self.assertTrue({'children', 'vocabulary', 'child_vocab_progress', 'daily_study_log', 'child_pokemon_collection', 'pokemon_catalog'}.issubset(tables))

            children_columns = [row[1] for row in conn.execute('PRAGMA table_info(children)').fetchall()]
            expected_children_columns = [
                'id',
                'name',
                'grade',
                'target_level',
                'daily_target',
                'starter_pokemon_id',
                'created_at',
                'updated_at',
            ]
            self.assertTrue(set(expected_children_columns).issubset(children_columns))

            columns = [row[1] for row in conn.execute('PRAGMA table_info(child_vocab_progress)').fetchall()]
            expected_columns = [
                'id',
                'child_id',
                'vocab_id',
                'correct_count',
                'wrong_count',
                'review_count',
                'memory_level',
                'last_studied_at',
                'mastered',
                'created_at',
                'updated_at',
                'correct_streak',
            ]
            self.assertTrue(set(expected_columns).issubset(columns))

            fk_rows = conn.execute('PRAGMA foreign_key_list(child_vocab_progress)').fetchall()
            fk_targets = {(row[2], row[4]) for row in fk_rows}
            self.assertEqual({('children', 'id'), ('vocabulary', 'id')}, fk_targets)

            pet_columns = [row[1] for row in conn.execute('PRAGMA table_info(child_pokemon_collection)').fetchall()]
            expected_pet_columns = [
                'id',
                'child_id',
                'pokemon_id',
                'nickname',
                'pet_name',
                'level',
                'exp',
                'total_exp',
                'max_level',
                'is_active',
                'unlocked_at',
                'created_at',
                'updated_at',
            ]
            self.assertTrue(set(expected_pet_columns).issubset(pet_columns))

            pet_fk_rows = conn.execute('PRAGMA foreign_key_list(child_pokemon_collection)').fetchall()
            pet_fk_targets = {(row[2], row[4]) for row in pet_fk_rows}
            self.assertEqual({('children', 'id'), ('pokemon_catalog', 'pokemon_id')}, pet_fk_targets)

            collection_indexes = conn.execute('PRAGMA index_list(child_pokemon_collection)').fetchall()
            self.assertTrue(any(row[1] == 'idx_child_pokemon_collection_active' for row in collection_indexes))

            catalog_columns = [row[1] for row in conn.execute('PRAGMA table_info(pokemon_catalog)').fetchall()]
            expected_catalog_columns = [
                'id',
                'pokemon_id',
                'name',
                'image_url',
                'sprite_url',
                'type1',
                'type2',
                'generation',
                'cached_at',
                'pokemon_name',
                'types',
                'created_at',
                'updated_at',
            ]
            self.assertTrue(set(expected_catalog_columns).issubset(catalog_columns))

            catalog_indexes = conn.execute('PRAGMA index_list(pokemon_catalog)').fetchall()
            self.assertTrue(any(row[2] for row in catalog_indexes))

            conn.execute(
                '''
                INSERT INTO pokemon_catalog (
                    pokemon_id, name, image_url, sprite_url, type1, type2, generation, pokemon_name, types
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (999, 'custom', 'art.png', 'sprite.png', 'normal', None, 'generation-i', 'custom', '[]'),
            )
            conn.commit()

            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute(
                    '''
                    INSERT INTO pokemon_catalog (
                        pokemon_id, name, image_url, sprite_url, type1, type2, generation, pokemon_name, types
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (999, 'custom-2', 'art2.png', 'sprite2.png', 'normal', None, 'generation-i', 'custom-2', '[]'),
                )
                conn.commit()
        finally:
            conn.close()

    def test_constraints_work(self):
        conn = app_module.get_db_connection()
        try:
            conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (10,))
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Alice', '3', 'A2'),
            ).lastrowid
            pet_row = conn.execute(
                'SELECT child_id, pokemon_id, pet_name, level, exp, total_exp, max_level, is_active FROM child_pokemon_collection WHERE child_id = ?',
                (child_id,),
            ).fetchone()
            self.assertIsNotNone(pet_row)
            self.assertEqual(child_id, pet_row['child_id'])
            self.assertTrue(1 <= pet_row['pokemon_id'] <= 151)
            catalog_row = conn.execute(
                'SELECT pokemon_id FROM pokemon_catalog WHERE pokemon_id = ?',
                (pet_row['pokemon_id'],),
            ).fetchone()
            self.assertIsNotNone(catalog_row)
            self.assertEqual(1, pet_row['level'])
            self.assertEqual(0, pet_row['exp'])
            self.assertEqual(0, pet_row['total_exp'])
            self.assertEqual(10, pet_row['max_level'])
            self.assertEqual(1, pet_row['is_active'])
            conn.execute(
                '''
                INSERT INTO child_vocab_progress (
                    child_id, vocab_id, correct_count, wrong_count, review_count,
                    memory_level, last_studied_at, mastered
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (child_id, 10, 2, 1, 1, 3, '2026-05-09T12:00:00', 0),
            )
            conn.commit()
            self.assertEqual(0, conn.execute(
                'SELECT correct_streak FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, 10),
            ).fetchone()['correct_streak'])

            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute(
                    '''
                    INSERT INTO child_vocab_progress (
                        child_id, vocab_id, correct_count, wrong_count, review_count,
                        memory_level, last_studied_at, mastered
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (child_id, 10, 0, 0, 0, 0, None, 0),
                )
                conn.commit()

            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute(
                    '''
                    INSERT INTO child_vocab_progress (
                        child_id, vocab_id, correct_count, wrong_count, review_count,
                        memory_level, last_studied_at, mastered
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (999, 10, 0, 0, 0, 0, None, 0),
                )
                conn.commit()
        finally:
            conn.close()

    def test_default_pet_is_seeded_for_children(self):
        conn = app_module.get_db_connection()
        try:
            rows = conn.execute('SELECT id, name, grade, target_level FROM children ORDER BY id ASC').fetchall()
            self.assertGreaterEqual(len(rows), 2)

            for child in rows[:2]:
                pet = conn.execute(
                    'SELECT child_id, pokemon_id, pet_name, level, exp, total_exp, max_level, is_active FROM child_pokemon_collection WHERE child_id = ?',
                    (child['id'],),
                ).fetchone()
                self.assertIsNotNone(pet)
                self.assertEqual(child['id'], pet['child_id'])
                self.assertTrue(1 <= pet['pokemon_id'] <= 151)
                self.assertEqual(1, pet['level'])
                self.assertEqual(0, pet['exp'])
                self.assertEqual(0, pet['total_exp'])
                self.assertEqual(10, pet['max_level'])
                self.assertEqual(1, pet['is_active'])
        finally:
            conn.close()

    def test_migrates_existing_progress_table_with_correct_streak(self):
        legacy_temp_dir = tempfile.TemporaryDirectory()
        legacy_db_path = Path(legacy_temp_dir.name) / 'legacy.db'
        try:
            conn = sqlite3.connect(legacy_db_path)
            conn.row_factory = sqlite3.Row
            try:
                conn.execute(
                    '''
                    CREATE TABLE children (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        grade TEXT NOT NULL,
                        target_level TEXT NOT NULL,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    '''
                )
                conn.execute(
                    '''
                    CREATE TABLE vocabulary (
                        id INTEGER PRIMARY KEY AUTOINCREMENT
                    )
                    '''
                )
                conn.execute(
                    '''
                    CREATE TABLE child_vocab_progress (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        child_id INTEGER NOT NULL,
                        vocab_id INTEGER NOT NULL,
                        correct_count INTEGER NOT NULL DEFAULT 0,
                        wrong_count INTEGER NOT NULL DEFAULT 0,
                        review_count INTEGER NOT NULL DEFAULT 0,
                        memory_level INTEGER NOT NULL DEFAULT 0,
                        last_studied_at TEXT,
                        mastered INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                        FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE CASCADE,
                        UNIQUE (child_id, vocab_id)
                    )
                    '''
                )
                child_id = conn.execute(
                    'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                    ('Legacy', '3', 'A2'),
                ).lastrowid
                vocab_id = conn.execute('INSERT OR IGNORE INTO vocabulary DEFAULT VALUES').lastrowid
                if not vocab_id:
                    vocab_id = conn.execute('SELECT id FROM vocabulary ORDER BY id DESC LIMIT 1').fetchone()['id']
                conn.execute(
                    '''
                    INSERT INTO child_vocab_progress (
                        child_id, vocab_id, correct_count, wrong_count, review_count,
                        memory_level, last_studied_at, mastered
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (child_id, vocab_id, 1, 0, 1, 0, '2026-05-09T00:00:00', 0),
                )
                conn.commit()
            finally:
                conn.close()

            with patch.object(app_module, 'get_db_path', return_value=str(legacy_db_path)):
                app_module.init_db()
                conn = app_module.get_db_connection()
                try:
                    columns = [row[1] for row in conn.execute('PRAGMA table_info(child_vocab_progress)').fetchall()]
                    self.assertIn('correct_streak', columns)
                    row = conn.execute(
                        'SELECT correct_streak FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                        (child_id, vocab_id),
                    ).fetchone()
                    self.assertEqual(0, row['correct_streak'])
                finally:
                    conn.close()
        finally:
            legacy_temp_dir.cleanup()


class DailyStudyLogSchemaTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_schema_and_unique_constraint(self):
        conn = app_module.get_db_connection()
        try:
            columns = [row[1] for row in conn.execute('PRAGMA table_info(daily_study_log)').fetchall()]
            expected_columns = [
                'id',
                'child_id',
                'study_date',
                'studied_count',
                'correct_count',
                'wrong_count',
                'study_minutes',
                'created_at',
                'updated_at',
            ]
            self.assertTrue(set(expected_columns).issubset(columns))

            fk_rows = conn.execute('PRAGMA foreign_key_list(daily_study_log)').fetchall()
            fk_targets = {(row[2], row[4]) for row in fk_rows}
            self.assertEqual({('children', 'id')}, fk_targets)

            indexes = conn.execute('PRAGMA index_list(daily_study_log)').fetchall()
            unique_index_names = [row[1] for row in indexes if row[2]]
            self.assertTrue(unique_index_names)

            conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Bob', '2', 'A2'),
            )
            child_id = conn.execute('SELECT id FROM children WHERE name = ?', ('Bob',)).fetchone()['id']
            conn.execute(
                '''
                INSERT INTO daily_study_log (
                    child_id, study_date, studied_count, correct_count, wrong_count, study_minutes
                ) VALUES (?, ?, ?, ?, ?, ?)
                ''',
                (child_id, '2026-05-09', 12, 9, 3, 25),
            )
            conn.commit()

            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute(
                    '''
                    INSERT INTO daily_study_log (
                        child_id, study_date, studied_count, correct_count, wrong_count, study_minutes
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ''',
                    (child_id, '2026-05-09', 1, 1, 0, 5),
                )
                conn.commit()
        finally:
            conn.close()

    def test_seeded_children_exist(self):
        conn = app_module.get_db_connection()
        try:
            rows = conn.execute('SELECT name, grade, target_level FROM children ORDER BY id ASC').fetchall()
            self.assertGreaterEqual(len(rows), 2)
            self.assertEqual('Haru', rows[0]['name'])
            self.assertEqual('Mio', rows[1]['name'])
        finally:
            conn.close()


class RecordStudyResultTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_today_patch = patch.object(app_module, 'get_today', return_value='2026-05-09')
        self.get_db_path_patch.start()
        self.get_today_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_today_patch.stop()
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_creates_and_updates_child_vocab_progress_and_daily_log(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Mina', '4', 'B1'),
            ).lastrowid
            vocab_id = conn.execute(
                'INSERT OR IGNORE INTO vocabulary DEFAULT VALUES'
            ).lastrowid
            if not vocab_id:
                vocab_id = conn.execute('SELECT id FROM vocabulary ORDER BY id DESC LIMIT 1').fetchone()['id']
            conn.commit()
        finally:
            conn.close()

        first_result = app_module.recordStudyResult(child_id, vocab_id, True)
        self.assertIsNotNone(first_result['child_vocab_progress'])
        self.assertIsNotNone(first_result['daily_study_log'])

        conn = app_module.get_db_connection()
        try:
            progress = conn.execute(
                'SELECT * FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_id),
            ).fetchone()
            daily = conn.execute(
                'SELECT * FROM daily_study_log WHERE child_id = ? AND study_date = ?',
                (child_id, '2026-05-09'),
            ).fetchone()

            self.assertEqual(1, progress['correct_count'])
            self.assertEqual(0, progress['wrong_count'])
            self.assertEqual(1, progress['review_count'])
            self.assertEqual(1, progress['correct_streak'])
            self.assertTrue(progress['last_studied_at'])

            self.assertEqual(1, daily['studied_count'])
            self.assertEqual(1, daily['correct_count'])
            self.assertEqual(0, daily['wrong_count'])

            app_module.recordStudyResult(child_id, vocab_id, False)

            progress = conn.execute(
                'SELECT * FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_id),
            ).fetchone()
            daily = conn.execute(
                'SELECT * FROM daily_study_log WHERE child_id = ? AND study_date = ?',
                (child_id, '2026-05-09'),
            ).fetchone()

            self.assertEqual(1, progress['correct_count'])
            self.assertEqual(1, progress['wrong_count'])
            self.assertEqual(2, progress['review_count'])
            self.assertEqual(0, progress['correct_streak'])
            self.assertTrue(progress['last_studied_at'])

            self.assertEqual(2, daily['studied_count'])
            self.assertEqual(1, daily['correct_count'])
            self.assertEqual(1, daily['wrong_count'])
        finally:
            conn.close()

    def test_awards_pet_exp_for_new_words_and_consecutive_corrects(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Rin', '4', 'B1'),
            ).lastrowid
            vocab_one = conn.execute('INSERT OR IGNORE INTO vocabulary DEFAULT VALUES').lastrowid
            if not vocab_one:
                vocab_one = conn.execute('SELECT id FROM vocabulary ORDER BY id DESC LIMIT 1').fetchone()['id']
            vocab_two = conn.execute('INSERT OR IGNORE INTO vocabulary DEFAULT VALUES').lastrowid
            if not vocab_two:
                vocab_two = conn.execute('SELECT id FROM vocabulary ORDER BY id DESC LIMIT 1').fetchone()['id']
            conn.commit()
        finally:
            conn.close()

        result = app_module.recordStudyResult(child_id, vocab_one, True)
        self.assertEqual(15, result['pet_exp_awarded'])

        for _ in range(4):
            result = app_module.recordStudyResult(child_id, vocab_one, True)

        conn = app_module.get_db_connection()
        try:
            pet = conn.execute(
                'SELECT level, exp, total_exp, max_level, is_active FROM child_pokemon_collection WHERE child_id = ?',
                (child_id,),
            ).fetchone()
            progress = conn.execute(
                'SELECT correct_streak FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_one),
            ).fetchone()
            self.assertEqual(1, pet['level'])
            self.assertEqual(75, pet['exp'])
            self.assertEqual(75, pet['total_exp'])
            self.assertEqual(10, pet['max_level'])
            self.assertEqual(1, pet['is_active'])
            self.assertEqual(5, progress['correct_streak'])
        finally:
            conn.close()

        result = app_module.recordStudyResult(child_id, vocab_one, False)
        self.assertEqual(2, result['pet_exp_awarded'])

        result = app_module.recordStudyResult(child_id, vocab_two, False)
        self.assertEqual(7, result['pet_exp_awarded'])

        conn = app_module.get_db_connection()
        try:
            pet = conn.execute(
                'SELECT level, exp, total_exp, max_level, is_active FROM child_pokemon_collection WHERE child_id = ?',
                (child_id,),
            ).fetchone()
            progress_one = conn.execute(
                'SELECT correct_streak, wrong_count, review_count FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_one),
            ).fetchone()
            progress_two = conn.execute(
                'SELECT correct_streak, wrong_count, review_count FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_two),
            ).fetchone()
            self.assertEqual(84, pet['total_exp'])
            self.assertEqual(84, pet['exp'])
            self.assertEqual(0, progress_one['correct_streak'])
            self.assertEqual(1, progress_one['wrong_count'])
            self.assertEqual(6, progress_one['review_count'])
            self.assertEqual(0, progress_two['correct_streak'])
            self.assertEqual(1, progress_two['wrong_count'])
            self.assertEqual(1, progress_two['review_count'])
        finally:
            conn.close()


class ChildLearningStatsTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_today_patch = patch.object(app_module, 'get_today', return_value='2026-05-09')
        self.get_db_path_patch.start()
        self.get_today_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_today_patch.stop()
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_child_learning_stats(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Sora', '5', 'A1'),
            ).lastrowid

            vocab_candidates = [entry for entry in app_module.vocab_list if str(entry.get('ID', '')).strip().isdigit()]
            vocab_ids = [int(entry['ID']) for entry in vocab_candidates[:3]]
            for vocab_id in vocab_ids:
                conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
            conn.commit()
        finally:
            conn.close()

        app_module.recordStudyResult(child_id, vocab_ids[0], False)
        app_module.recordStudyResult(child_id, vocab_ids[0], False)
        app_module.recordStudyResult(child_id, vocab_ids[1], True)
        app_module.recordStudyResult(child_id, vocab_ids[2], False)

        stats = app_module.get_child_learning_stats(child_id)
        self.assertIsNotNone(stats['child'])
        self.assertEqual(child_id, stats['child']['id'])
        self.assertEqual(4, stats['today']['studied_count'])
        self.assertEqual(1, stats['today']['correct_count'])
        self.assertEqual(3, stats['today']['wrong_count'])
        self.assertEqual(3, stats['total_studied_words'])
        self.assertGreaterEqual(len(stats['top_wrong_words']), 2)
        self.assertEqual(vocab_ids[0], stats['top_wrong_words'][0]['vocab_id'])
        self.assertEqual(2, stats['top_wrong_words'][0]['wrong_count'])

    def test_child_stats_api(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Mika', '6', 'B1'),
            ).lastrowid
            vocab_id = next(int(entry['ID']) for entry in app_module.vocab_list if str(entry.get('ID', '')).strip().isdigit())
            conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
            conn.commit()
        finally:
            conn.close()

        app_module.recordStudyResult(child_id, vocab_id, True)

        client = app_module.app.test_client()
        response = client.get(f'/api/child-stats?child_id={child_id}')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(child_id, payload['child']['id'])
        self.assertEqual(1, payload['today']['studied_count'])
        self.assertEqual(1, payload['today']['correct_count'])
        self.assertEqual(0, payload['today']['wrong_count'])

    def test_record_study_result_recovers_missing_vocabulary_row(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Noa', '3', 'A2'),
            ).lastrowid
            vocab_id = next(int(entry['ID']) for entry in app_module.vocab_list if str(entry.get('ID', '')).strip().isdigit())
            conn.execute('DELETE FROM vocabulary WHERE id = ?', (vocab_id,))
            conn.commit()
        finally:
            conn.close()

        result = app_module.recordStudyResult(child_id, vocab_id, True)
        self.assertIsNotNone(result['child_vocab_progress'])

        conn = app_module.get_db_connection()
        try:
            vocab_row = conn.execute('SELECT id FROM vocabulary WHERE id = ?', (vocab_id,)).fetchone()
            progress_row = conn.execute(
                'SELECT id FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_id),
            ).fetchone()
            self.assertIsNotNone(vocab_row)
            self.assertIsNotNone(progress_row)
        finally:
            conn.close()

    def test_children_api_and_seeded_children(self):
        client = app_module.app.test_client()
        response = client.get('/api/children')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertGreaterEqual(len(payload['children']), 2)
        self.assertEqual('Haru', payload['children'][0]['name'])
        self.assertEqual('Mio', payload['children'][1]['name'])

    def test_home_api_uses_child_pet(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Niko', '2', 'A2'),
            ).lastrowid
            conn.execute(
                '''
                UPDATE child_pokemon_collection
                SET pokemon_id = ?, pet_name = ?, level = ?, exp = ?, total_exp = ?, is_active = 1
                WHERE child_id = ?
                ''',
                (147, 'Niko Pet', 3, 80, 240, child_id),
            )
            conn.commit()
        finally:
            conn.close()

        with patch.object(app_module, 'getPokemonById', return_value={
            'id': 147,
            'name': 'dratini',
            'name_jp': '繝溘ル繝ｪ繝･繧ｦ',
            'sprites': {
                'front_default': 'front.png',
                'other': {'official-artwork': {'front_default': 'art.png'}},
            },
            'types': [{'slot': 1, 'name': 'dragon'}],
        }) as mocked_get_pokemon:
            client = app_module.app.test_client()
            response = client.get(f'/api/home?child_id={child_id}')
            self.assertEqual(200, response.status_code)
            payload = response.get_json()
            self.assertEqual(child_id, payload['pet']['child_id'])
            self.assertEqual('Niko Pet', payload['pet']['name'])
            self.assertEqual('dragon', payload['pet']['pet_type'])
            self.assertEqual(147, payload['pet']['pokemon_id'])
            self.assertEqual(3, payload['pet']['level'])
            self.assertEqual(80, payload['pet']['exp'])
            self.assertEqual(147, payload['pet']['pokemon']['id'])
            self.assertEqual('繝溘ル繝ｪ繝･繧ｦ', payload['pet']['pokemon']['name'])
            self.assertEqual(1, payload['pet']['is_active'])
            self.assertEqual(1, mocked_get_pokemon.call_count)

            response = client.get(f'/api/home?child_id={child_id}')
            self.assertEqual(200, response.status_code)
            self.assertEqual(2, mocked_get_pokemon.call_count)


class AddPetExpTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_add_pet_exp_single_and_multi_level_up(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Yui', '1', 'A2'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        pet = app_module.addPetExp(child_id, 99)
        self.assertEqual(1, pet['level'])
        self.assertEqual(99, pet['exp'])
        self.assertEqual(99, pet['total_exp'])
        self.assertTrue(1 <= pet['pokemon_id'] <= 151)
        self.assertEqual(10, pet['max_level'])
        self.assertEqual(1, pet['is_active'])

        pet = app_module.addPetExp(child_id, 1)
        self.assertEqual(2, pet['level'])
        self.assertEqual(0, pet['exp'])
        self.assertEqual(100, pet['total_exp'])

        pet = app_module.addPetExp(child_id, 450)
        self.assertEqual(4, pet['level'])
        self.assertEqual(100, pet['exp'])
        self.assertEqual(550, pet['total_exp'])

    def test_add_pet_exp_creates_pet_when_missing(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Kai', '3', 'B1'),
            ).lastrowid
            conn.execute('DELETE FROM child_pokemon_collection WHERE child_id = ?', (child_id,))
            conn.commit()
        finally:
            conn.close()

        pet = app_module.addPetExp(child_id, 25)
        self.assertIsNotNone(pet)
        self.assertEqual(child_id, pet['child_id'])
        self.assertEqual(1, pet['level'])
        self.assertEqual(25, pet['exp'])
        self.assertEqual(25, pet['total_exp'])
        self.assertTrue(1 <= pet['pokemon_id'] <= 151)


class PokemonExpApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_pokemon_exp_api_awards_exp(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Mio', '2', 'A2'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        client = app_module.app.test_client()
        response = client.post(
            '/api/pokemon-exp',
            json={'child_id': child_id, 'exp_amount': 10},
        )
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(10, payload['pet_exp_awarded'])
        self.assertIsNotNone(payload['pet'])
        self.assertEqual(child_id, payload['pet']['child_id'])
        self.assertEqual(10, payload['pet']['total_exp'])
        self.assertEqual(10, payload['pet']['exp'])

    def test_pokemon_exp_api_rejects_bad_payload(self):
        client = app_module.app.test_client()
        response = client.post('/api/pokemon-exp', json={'child_id': 'abc', 'exp_amount': 'nope'})
        self.assertEqual(400, response.status_code)


class ChildProfileSettingsApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_child_starter_options_and_create_profile(self):
        client = app_module.app.test_client()
        options_response = client.get('/api/child-starter-options')
        self.assertEqual(200, options_response.status_code)
        options_payload = options_response.get_json()
        self.assertEqual(3, len(options_payload['options']))
        option_ids = [option['id'] for option in options_payload['options']]
        self.assertEqual(len(option_ids), len(set(option_ids)))
        self.assertEqual([4, 7, 1], option_ids)

        selected_option = options_payload['options'][0]
        create_response = client.post(
            '/api/children',
            json={
                'name': 'Aya',
                'grade': '2',
                'target_level': '\u4e09\u7d1a',
                'daily_target': 18,
                'starter_pokemon_id': selected_option['id'],
            },
        )
        self.assertEqual(200, create_response.status_code)
        created_payload = create_response.get_json()
        self.assertEqual('Aya', created_payload['child']['name'])
        self.assertEqual(18, created_payload['child']['daily_target'])
        self.assertEqual(selected_option['id'], created_payload['child']['starter_pokemon_id'])

        conn = app_module.get_db_connection()
        try:
            row = conn.execute(
                'SELECT name, grade, target_level, daily_target, starter_pokemon_id FROM children WHERE name = ?',
                ('Aya',),
            ).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(created_payload['child']['target_level'], row['target_level'])
            self.assertEqual(18, row['daily_target'])
            self.assertEqual(selected_option['id'], row['starter_pokemon_id'])

            active_pet = conn.execute(
                'SELECT pokemon_id, is_active FROM child_pokemon_collection WHERE child_id = ?',
                (created_payload['child']['id'],),
            ).fetchone()
            self.assertIsNotNone(active_pet)
            self.assertEqual(selected_option['id'], active_pet['pokemon_id'])
            self.assertEqual(1, active_pet['is_active'])
        finally:
            conn.close()

        home_response = client.get(f"/api/home?child_id={created_payload['child']['id']}")
        self.assertEqual(200, home_response.status_code)
        home_payload = home_response.get_json()
        self.assertEqual(18, home_payload['target'])
        self.assertEqual(selected_option['id'], home_payload['pet']['pokemon_id'])
        self.assertEqual(created_payload['child']['id'], home_payload['pet']['child_id'])

        delete_response = client.delete(f"/api/children/{created_payload['child']['id']}")
        self.assertEqual(200, delete_response.status_code)
        delete_payload = delete_response.get_json()
        self.assertTrue(delete_payload['deleted'])

        conn = app_module.get_db_connection()
        try:
            child_row = conn.execute(
                'SELECT id FROM children WHERE id = ?',
                (created_payload['child']['id'],),
            ).fetchone()
            self.assertIsNone(child_row)
            collection_row = conn.execute(
                'SELECT id FROM child_pokemon_collection WHERE child_id = ?',
                (created_payload['child']['id'],),
            ).fetchone()
            self.assertIsNone(collection_row)
        finally:
            conn.close()

    def test_child_starter_options_have_real_names_without_remote_fetch(self):
        with patch.object(app_module, 'get_cached_pokemon_by_id', side_effect=Exception('offline')):
            client = app_module.app.test_client()
            response = client.get('/api/child-starter-options')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        names = [option['name'] for option in payload['options']]
        self.assertEqual(['ヒトカゲ', 'ゼニガメ', 'フシギダネ'], names)


class PokemonCollectionSystemTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_unlock_random_pokemon_adds_new_collection_row(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Pika', '2', 'A2'),
            ).lastrowid
            conn.execute(
                'UPDATE child_pokemon_collection SET pokemon_id = ?, is_active = 1 WHERE child_id = ?',
                (1, child_id),
            )
            conn.commit()
        finally:
            conn.close()

        with patch.object(app_module.random, 'choice', return_value=2), patch.object(
            app_module, 'get_cached_pokemon_by_id',
            return_value={
                'id': 2,
                'name': 'ivysaur',
                'sprites': {
                    'front_default': 'front.png',
                    'other': {'official-artwork': {'front_default': 'art.png'}},
                },
                'types': [{'slot': 1, 'name': 'grass'}],
            },
        ):
            result = app_module.unlockRandomPokemon(child_id)

        self.assertIsNotNone(result)
        self.assertEqual(2, result['pokemon_id'])
        self.assertEqual(2, result['collection_owned'])

        conn = app_module.get_db_connection()
        try:
            owned = conn.execute(
                'SELECT COUNT(*) AS count FROM child_pokemon_collection WHERE child_id = ?',
                (child_id,),
            ).fetchone()['count']
            self.assertEqual(2, owned)
        finally:
            conn.close()

    def test_set_active_pokemon_switches_active_row(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Moka', '3', 'B1'),
            ).lastrowid
            conn.execute(
                'UPDATE child_pokemon_collection SET pokemon_id = ?, pet_name = ?, is_active = 1 WHERE child_id = ?',
                (1, 'First', child_id),
            )
            conn.execute(
                'INSERT INTO child_pokemon_collection (child_id, pokemon_id, pet_name, level, exp, total_exp, max_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                (child_id, 2, 'Second', 1, 0, 0, 10, 0),
            )
            conn.commit()
        finally:
            conn.close()

        with patch.object(
            app_module,
            'get_cached_pokemon_by_id',
            return_value={
                'id': 2,
                'name': 'ivysaur',
                'sprites': {
                    'front_default': 'front.png',
                    'other': {'official-artwork': {'front_default': 'art.png'}},
                },
                'types': [{'slot': 1, 'name': 'grass'}],
            },
        ):
            pet = app_module.setActivePokemon(child_id, 2)
        self.assertIsNotNone(pet)
        self.assertEqual(2, pet['pokemon_id'])
        self.assertEqual(1, pet['is_active'])

        conn = app_module.get_db_connection()
        try:
            active_rows = conn.execute(
                'SELECT pokemon_id FROM child_pokemon_collection WHERE child_id = ? AND is_active = 1',
                (child_id,),
            ).fetchall()
            self.assertEqual(1, len(active_rows))
            self.assertEqual(2, active_rows[0]['pokemon_id'])
        finally:
            conn.close()

    def test_cached_pokemon_without_images_is_enriched(self):
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                '''
                INSERT INTO pokemon_catalog (
                    pokemon_id, pokemon_name, image_url, sprite_url, types
                ) VALUES (?, ?, ?, ?, ?)
                ''',
                (9999, 'pikachu', None, None, '[{"slot": 1, "name": "electric"}]'),
            )
            conn.commit()
        finally:
            conn.close()

        with patch.object(
            app_module,
            'getPokemonById',
                return_value={
                'id': 9999,
                'name': 'pikachu',
                'sprites': {
                    'front_default': 'sprite.png',
                    'other': {'official-artwork': {'front_default': 'art.png'}},
                },
                'types': [{'slot': 1, 'name': 'electric'}],
            },
        ) as mocked_fetch:
            pokemon = app_module.get_cached_pokemon_by_id(9999)

        self.assertEqual(9999, pokemon['id'])
        self.assertEqual('art.png', pokemon['sprites']['other']['official-artwork']['front_default'])
        self.assertEqual('sprite.png', pokemon['sprites']['front_default'])
        self.assertEqual(1, mocked_fetch.call_count)

        conn = app_module.get_db_connection()
        try:
            row = conn.execute(
                'SELECT image_url, sprite_url, types FROM pokemon_catalog WHERE pokemon_id = ?',
                (9999,),
            ).fetchone()
            self.assertEqual('art.png', row['image_url'])
            self.assertEqual('sprite.png', row['sprite_url'])
            self.assertTrue(row['types'])
        finally:
            conn.close()


class TodayReviewQuizTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def create_child(self, name='Quest'):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                (name, '3', 'A2'),
            ).lastrowid
            conn.commit()
            return child_id
        finally:
            conn.close()

    def seed_heroes(self, codes):
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                '''
                CREATE TABLE IF NOT EXISTS heroes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    world_id TEXT NOT NULL,
                    code TEXT NOT NULL UNIQUE,
                    name_ja TEXT,
                    name_cn TEXT,
                    rarity TEXT,
                    image_url TEXT,
                    description_ja TEXT
                )
                '''
            )
            for code in codes:
                world_id = code.split('-', 1)[0]
                world_number = {
                    'wind': '1',
                    'fire': '2',
                    'water': '3',
                    'thunder': '4',
                    'wood': '5',
                    'rock': '6',
                    'light': '7',
                    'shadow': '8',
                }.get(world_id, world_id)
                conn.execute(
                    '''
                    INSERT OR IGNORE INTO heroes (
                        world_id, code, name_ja, name_cn, rarity, image_url, description_ja
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (world_number, code, code, code, 'SR', f'/assets/{code}.png', ''),
                )
            conn.commit()
        finally:
            conn.close()

    def passing_stage_answers(self, client, child_id, world, stage):
        quiz = client.get(f'/api/today-review-quiz?child_id={child_id}&world={world}&stage={stage}').get_json()
        return [
            {'id': question['id'], 'type': question['type'], 'selected': question['correct']}
            for question in quiz['questions']
        ]

    def clear_stage(self, client, child_id, world, stage):
        response = client.post(
            f'/api/children/{child_id}/world-stage-progress',
            json={'world': world, 'stage': stage, 'status': 'cleared'},
        )
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))
        return response.get_json()

    def seed_cleared_stages(self, child_id, plan):
        rows = [
            (child_id, world_id, stage, 'cleared', '2026-05-31T00:00:00')
            for world_id, stages in plan.items()
            for stage in stages
        ]
        conn = app_module.get_db_connection()
        try:
            conn.executemany(
                '''
                INSERT INTO child_world_stage_progress (
                    child_id, world_id, stage_number, status, cleared_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(child_id, world_id, stage_number) DO UPDATE SET
                    status = excluded.status,
                    cleared_at = COALESCE(child_world_stage_progress.cleared_at, excluded.cleared_at),
                    updated_at = CURRENT_TIMESTAMP
                ''',
                rows,
            )
            conn.commit()
        finally:
            conn.close()

    def quest_progress(self, client, child_id):
        response = client.get(f'/api/home?child_id={child_id}')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))
        return response.get_json()['eigo_quest_progress']

    def progress_world(self, progress, world_id):
        return next(world for world in progress['worlds'] if world['id'] == world_id)

    def test_stage_progress_payload_respects_in_progress_and_unlocks(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Alice', '3', 'A2'),
            ).lastrowid
            conn.executemany(
                '''
                INSERT INTO child_world_stage_progress (
                    child_id, world_id, stage_number, status, cleared_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(child_id, world_id, stage_number) DO UPDATE SET
                    status = excluded.status,
                    cleared_at = COALESCE(child_world_stage_progress.cleared_at, excluded.cleared_at),
                    updated_at = excluded.updated_at
                ''',
                [
                    (child_id, 'water', 5, 'cleared', '2026-05-31T00:00:00', '2026-05-31T00:00:00', '2026-05-31T00:00:00'),
                    (child_id, 'water', 6, 'in_progress', None, '2026-05-31T00:00:00', '2026-05-31T00:00:00'),
                ],
            )
            conn.commit()
        finally:
            conn.close()

        payload = app_module.get_child_eigo_quest_progress(child_id)
        water_world = next(world for world in payload['worlds'] if world['id'] == 'water')
        stage_5 = next(stage for stage in water_world['stages'] if stage['stage'] == 5)
        stage_6 = next(stage for stage in water_world['stages'] if stage['stage'] == 6)

        self.assertEqual('cleared', stage_5['status'])
        self.assertEqual('in_progress', stage_6['status'])
        self.assertTrue(stage_6['unlocked'])

    def test_generate_today_review_questions(self):
        mastered_words = [entry['English'] for entry in app_module.vocab_list[:20] if entry.get('English')]
        with patch.object(app_module, 'load_progress', return_value={'count': 20, 'mastered_words': mastered_words}), patch.object(
            app_module,
            'get_review_list',
            return_value=[],
        ):
            questions = app_module.generate_today_review_questions(limit=20)

        self.assertEqual(20, len(questions))
        question_types = {question['type'] for question in questions}
        self.assertEqual({'Listening', 'Meaning', 'Reverse', 'Cloze'}, question_types)
        for question in questions:
            self.assertIn('question', question)
            self.assertIn('choices', question)
            self.assertIn('correct', question)
            self.assertIn(question['correct'], question['choices'])

    def test_today_review_quiz_api(self):
        sample_questions = [
            {
                'type': 'Meaning',
                'question': 'apple の意味は？',
                'choices': ['りんご', 'ばなな', 'みかん'],
                'correct': 'りんご',
                'word': 'apple',
                'id': 1,
            }
        ]

        with patch.object(app_module, 'generate_today_review_questions', return_value=sample_questions), patch.object(
            app_module,
            'load_progress',
            return_value={'count': 20, 'mastered_words': []},
        ):
            client = app_module.app.test_client()
            response = client.get('/api/today-review-quiz')

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(20, payload['target'])
        self.assertEqual(20, payload['progress'])
        self.assertEqual(2, payload['day'])
        self.assertEqual(sample_questions, payload['questions'])

    def test_daily_review_score_prioritizes_review_low_memory_and_old_items(self):
        now = '2026-06-20T12:00:00'
        row = {
            'status': 'review',
            'wrong_count': 2,
            'memory_level': 1,
            'mastery': 35,
            'correct_streak': 1,
            'mastered': 0,
            'last_reviewed_at': '2026-06-05T12:00:00',
            'last_studied_at': '2026-06-01T12:00:00',
        }

        self.assertEqual(139, app_module.calculate_daily_review_score(row, now))

    def test_daily_review_score_keeps_mastered_words_in_low_probability_pool(self):
        now = '2026-06-20T12:00:00'
        row = {
            'status': 'mastered',
            'wrong_count': 0,
            'memory_level': 5,
            'mastery': 100,
            'correct_streak': 20,
            'mastered': 1,
            'last_reviewed_at': now,
            'last_studied_at': now,
        }

        self.assertEqual(1, app_module.calculate_daily_review_score(row, now))

    def test_daily_review_returns_all_eligible_words_when_pool_is_under_target(self):
        child_id = self.create_child('Daily Pool')
        entries = [entry for entry in app_module.vocab_list[:3] if str(entry.get('ID', '')).isdigit()]
        self.assertEqual(3, len(entries))
        conn = app_module.get_db_connection()
        try:
            for entry in entries:
                vocab_id = int(entry['ID'])
                conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
                conn.execute(
                    '''
                    INSERT INTO child_vocab_progress (
                        child_id, vocab_id, correct_count, wrong_count, review_count,
                        memory_level, last_studied_at, mastered, correct_streak, mastery, status,
                        last_reviewed_at
                    ) VALUES (?, ?, 1, 0, 1, 3, ?, 0, 1, 60, 'learning', ?)
                    ''',
                    (child_id, vocab_id, '2026-06-18T12:00:00', '2026-06-18T12:00:00'),
                )
            conn.commit()
        finally:
            conn.close()

        selected = app_module.get_daily_review_entries(child_id, target_count=10)

        self.assertEqual({entry['ID'] for entry in entries}, {entry['ID'] for entry in selected})

    def test_daily_review_context_cloze_uses_full_vocab_distractors_without_placeholders(self):
        target = {
            'ID': '1532',
            'English': 'become',
            'Japanese': 'になる',
            'Example_English': 'She became famous.',
            'Example_Japanese': '彼女は有名になりました。',
            'Level': 'eiken3',
            'Category': 'verb',
        }
        full_vocab = [
            target,
            {'ID': '1', 'English': 'go', 'Japanese': '行く', 'Level': 'eiken3', 'Category': 'verb'},
            {'ID': '2', 'English': 'take', 'Japanese': '取る', 'Level': 'eiken3', 'Category': 'verb'},
            {'ID': '3', 'English': 'give', 'Japanese': '与える', 'Level': 'eiken3', 'Category': 'verb'},
            {'ID': '4', 'English': 'table', 'Japanese': 'テーブル', 'Level': 'eiken3', 'Category': 'noun'},
        ]

        with patch.object(app_module, 'vocab_list', full_vocab):
            question = app_module.generate_daily_review_context_question(target, [target], 'normal', 'eiken3')

        self.assertEqual('vocabulary_cloze', question['type'])
        self.assertEqual('She _____ famous.', question['question'])
        self.assertEqual('became', question['correct'])
        self.assertIn(question['correct'], question['choices'])
        self.assertEqual(4, len(question['choices']))
        self.assertFalse(any(str(choice).startswith('choice_') for choice in question['choices']))

    def test_daily_review_easy_question_uses_safe_choices_when_child_pool_has_one_word(self):
        target = {
            'ID': '1532',
            'English': 'become',
            'Japanese': 'になる',
            'Example_English': 'She became famous.',
            'Level': 'eiken3',
            'Category': 'verb',
        }
        full_vocab = [
            target,
            {'ID': '1', 'English': 'go', 'Japanese': '行く', 'Level': 'eiken3', 'Category': 'verb'},
            {'ID': '2', 'English': 'take', 'Japanese': '取る', 'Level': 'eiken3', 'Category': 'verb'},
            {'ID': '3', 'English': 'give', 'Japanese': '与える', 'Level': 'eiken3', 'Category': 'verb'},
        ]

        with patch.object(app_module, 'vocab_list', full_vocab):
            questions = app_module.generate_daily_review_questions_from_entries(
                [target],
                limit=10,
                difficulty='easy',
                target_level='eiken3',
            )

        self.assertEqual(1, len(questions))
        self.assertIn(questions[0]['correct'], questions[0]['choices'])
        self.assertFalse(any(str(choice).startswith('choice_') for choice in questions[0]['choices']))

    def test_daily_review_submit_updates_progress_with_fsrs_like_rules(self):
        child_id = self.create_child('Daily Submit')
        correct_vocab = int(app_module.vocab_list[0]['ID'])
        wrong_vocab = int(app_module.vocab_list[1]['ID'])
        conn = app_module.get_db_connection()
        try:
            for vocab_id in [correct_vocab, wrong_vocab]:
                conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
            conn.execute(
                '''
                INSERT INTO child_vocab_progress (
                    child_id, vocab_id, correct_count, wrong_count, review_count,
                    memory_level, last_studied_at, mastered, correct_streak, mastery, status
                ) VALUES (?, ?, 1, 1, 1, 2, '2026-06-18T12:00:00', 0, 1, 75, 'review')
                ''',
                (child_id, correct_vocab),
            )
            conn.execute(
                '''
                INSERT INTO child_vocab_progress (
                    child_id, vocab_id, correct_count, wrong_count, review_count,
                    memory_level, last_studied_at, mastered, correct_streak, mastery, status
                ) VALUES (?, ?, 3, 0, 2, 3, '2026-06-18T12:00:00', 1, 4, 90, 'mastered')
                ''',
                (child_id, wrong_vocab),
            )
            conn.commit()
        finally:
            conn.close()

        result = app_module.submit_daily_review_answers(
            child_id,
            [
                {'vocab_id': correct_vocab, 'selected_answer': 'ok', 'correct_answer': 'ok'},
                {'vocab_id': wrong_vocab, 'selected_answer': 'bad', 'correct_answer': 'good'},
            ],
        )

        self.assertEqual({'total': 2, 'correct': 1, 'wrong': 1}, {key: result[key] for key in ['total', 'correct', 'wrong']})
        conn = app_module.get_db_connection()
        try:
            correct_row = conn.execute(
                'SELECT correct_count, review_count, correct_streak, memory_level, mastery, status, mastered, mastered_at, last_reviewed_at FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, correct_vocab),
            ).fetchone()
            wrong_row = conn.execute(
                'SELECT wrong_count, review_count, correct_streak, memory_level, mastery, status, mastered, last_reviewed_at FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, wrong_vocab),
            ).fetchone()
        finally:
            conn.close()

        self.assertEqual(2, correct_row['correct_count'])
        self.assertEqual(2, correct_row['review_count'])
        self.assertEqual(2, correct_row['correct_streak'])
        self.assertEqual(3, correct_row['memory_level'])
        self.assertEqual(85, correct_row['mastery'])
        self.assertEqual('mastered', correct_row['status'])
        self.assertEqual(1, correct_row['mastered'])
        self.assertTrue(correct_row['mastered_at'])
        self.assertTrue(correct_row['last_reviewed_at'])

        self.assertEqual(1, wrong_row['wrong_count'])
        self.assertEqual(3, wrong_row['review_count'])
        self.assertEqual(0, wrong_row['correct_streak'])
        self.assertEqual(2, wrong_row['memory_level'])
        self.assertEqual(75, wrong_row['mastery'])
        self.assertEqual('review', wrong_row['status'])
        self.assertEqual(0, wrong_row['mastered'])
        self.assertTrue(wrong_row['last_reviewed_at'])

    def test_stage_review_quiz_uses_stage_words_and_tracks_clear_status(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Aki', '3', 'A2'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        client = app_module.app.test_client()
        status_response = client.get(f'/api/children/{child_id}/world-stage-progress?world=wind&stage=1')
        self.assertEqual(200, status_response.status_code)
        self.assertFalse(status_response.get_json()['cleared'])

        quiz_response = client.get(f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1')
        self.assertEqual(200, quiz_response.status_code)
        payload = quiz_response.get_json()
        self.assertEqual('stage', payload['review_mode'])
        self.assertEqual('wind', payload['world'])
        self.assertEqual(1, payload['stage'])
        self.assertFalse(payload['stage_cleared'])
        self.assertEqual(20, len(payload['questions']))
        stage_words = {entry['English'] for entry in app_module.select_stage_vocab_entries('wind', 1, 20)}
        self.assertTrue({question['word'] for question in payload['questions']}.issubset(stage_words))

        clear_response = client.post(
            f'/api/children/{child_id}/world-stage-progress',
            json={'world': 'wind', 'stage': 1, 'status': 'cleared'},
        )
        self.assertEqual(200, clear_response.status_code)
        self.assertTrue(clear_response.get_json()['cleared'])

    def test_stage_review_quiz_uses_each_stage_word_once_with_balanced_types(self):
        child_id = self.create_child('Stage Quiz Balance')
        client = app_module.app.test_client()

        quiz_response = client.get(f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1')
        self.assertEqual(200, quiz_response.status_code)
        questions = quiz_response.get_json()['questions']

        self.assertEqual(20, len(questions))
        self.assertEqual(20, len({str(question['id']) for question in questions}))

        type_counts = {}
        for question in questions:
            type_counts[question['type']] = type_counts.get(question['type'], 0) + 1
            self.assertTrue(question['correct'])
            self.assertIn(question['correct'], question['choices'])
            self.assertEqual(1, question['choices'].count(question['correct']))
            self.assertEqual(len(question['choices']), len(set(question['choices'])))

        self.assertEqual(
            {'Listening': 5, 'Meaning': 5, 'Reverse': 5, 'Cloze': 5},
            type_counts,
        )

    def test_stage_review_quiz_same_attempt_is_stable_until_submission(self):
        child_id = self.create_child('Stable Quiz')
        client = app_module.app.test_client()
        attempt_id = f'stable-{child_id}-a'

        first = client.get(
            f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1&attempt_id={attempt_id}'
        ).get_json()['questions']
        second = client.get(
            f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1&attempt_id={attempt_id}'
        ).get_json()['questions']

        self.assertEqual(first, second)

        answers = [
            {'id': question['id'], 'type': question['type'], 'selected': question['correct']}
            for question in first
        ]
        submit_response = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': attempt_id, 'answers': answers},
        )
        self.assertEqual(201, submit_response.status_code, submit_response.get_data(as_text=True))

        next_attempt = client.get(
            f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1&attempt_id=stable-{child_id}-b'
        ).get_json()['questions']
        self.assertNotEqual(first, next_attempt)

    def test_stage_review_quiz_uses_stage_words_after_stage_is_cleared(self):
        child_id = self.create_child('Cleared Quiz')
        client = app_module.app.test_client()
        self.clear_stage(client, child_id, 'fire', 3)

        quiz_response = client.get(f'/api/today-review-quiz?child_id={child_id}&world=fire&stage=3')
        self.assertEqual(200, quiz_response.status_code)
        payload = quiz_response.get_json()
        self.assertEqual('stage', payload['review_mode'])
        self.assertEqual('fire', payload['world'])
        self.assertEqual(3, payload['stage'])
        self.assertTrue(payload['stage_cleared'])
        self.assertEqual(20, len(payload['questions']))
        stage_words = {entry['English'] for entry in app_module.select_stage_vocab_entries('fire', 3, 20)}
        self.assertTrue({question['word'] for question in payload['questions']}.issubset(stage_words))

    def test_eigo_quest_world_config_matches_product_stage_plan(self):
        expected_worlds = [
            ('wind', 1, 10, 200, 0),
            ('fire', 2, 10, 200, 200),
            ('water', 3, 10, 200, 400),
            ('thunder', 4, 10, 200, 600),
            ('wood', 5, 10, 200, 800),
            ('rock', 6, 10, 200, 1000),
            ('light', 7, 10, 200, 1200),
            ('shadow', 8, 5, 100, 1400),
        ]

        self.assertEqual([world_id for world_id, *_ in expected_worlds], app_module.EIGO_QUEST_WORLD_ORDER)
        self.assertEqual(75, app_module.EIGO_QUEST_TOTAL_STAGES)
        self.assertEqual(1500, app_module.EIGO_QUEST_TOTAL_WORDS)
        self.assertEqual(20, app_module.EIGO_QUEST_WORDS_PER_STAGE)
        self.assertEqual('water', app_module.EIGO_QUEST_WORLDS[2]['id'])
        self.assertEqual('light', app_module.EIGO_QUEST_WORLDS[6]['id'])
        self.assertEqual('shadow', app_module.EIGO_QUEST_WORLDS[7]['id'])

        for world_id, order, stage_count, word_count, word_start_index in expected_worlds:
            self.assertEqual(
                {
                    'id': world_id,
                    'order': order,
                    'stage_count': stage_count,
                    'word_count': word_count,
                    'word_start_index': word_start_index,
                },
                app_module.EIGO_QUEST_WORLD_MAP[world_id],
            )

    def test_frontend_world_config_matches_product_stage_plan(self):
        config_path = Path(app_module.app.root_path) / 'frontend' / 'src' / 'config' / 'eigoQuestWorlds.js'
        config_text = config_path.read_text(encoding='utf-8')

        ordered_ids = re.findall(r"id: '([^']+)'", config_text)
        self.assertEqual(
            ['wind', 'fire', 'water', 'thunder', 'wood', 'rock', 'light', 'shadow'],
            ordered_ids,
        )
        self.assertIn('export const EIGO_QUEST_WORDS_PER_STAGE = 20', config_text)
        self.assertIn('export const EIGO_QUEST_TOTAL_WORDS', config_text)
        self.assertIn('export const EIGO_QUEST_TOTAL_STAGES', config_text)
        self.assertRegex(config_text, r"id: 'shadow',[\s\S]*?stageCount: 5,[\s\S]*?wordCount: 100,[\s\S]*?wordStartIndex: 1400")

    def test_stage_vocab_boundaries_follow_1500_word_plan(self):
        expected_worlds = [
            ('wind', 10, 1, 200),
            ('fire', 10, 201, 400),
            ('water', 10, 401, 600),
            ('thunder', 10, 601, 800),
            ('wood', 10, 801, 1000),
            ('rock', 10, 1001, 1200),
            ('light', 10, 1201, 1400),
            ('shadow', 5, 1401, 1500),
        ]

        for world_id, stage_count, first_id, last_id in expected_worlds:
            seen_ids = []
            for stage in range(1, stage_count + 1):
                entries = app_module.select_stage_vocab_entries(world_id, stage, 20)
                self.assertEqual(20, len(entries), (world_id, stage))
                ids = [int(entry['ID']) for entry in entries]
                self.assertEqual(list(range(ids[0], ids[0] + 20)), ids)
                seen_ids.extend(ids)

            self.assertEqual(first_id, seen_ids[0])
            self.assertEqual(last_id, seen_ids[-1])
            self.assertEqual(list(range(first_id, last_id + 1)), seen_ids)

        shadow_stage_5 = app_module.select_stage_vocab_entries('shadow', 5, 20)
        self.assertEqual(list(range(1481, 1501)), [int(entry['ID']) for entry in shadow_stage_5])
        self.assertIsNone(app_module.select_stage_vocab_entries('shadow', 6, 20))

    def test_invalid_shadow_stage_is_rejected_by_stage_apis(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Mio', '3', 'A2'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        client = app_module.app.test_client()
        daily_response = client.get(f'/api/daily-words?child_id={child_id}&world=shadow&stage=6&limit=20')
        self.assertEqual(400, daily_response.status_code)

        quiz_response = client.get(f'/api/today-review-quiz?child_id={child_id}&world=shadow&stage=6')
        self.assertEqual(400, quiz_response.status_code)

        progress_response = client.get(f'/api/children/{child_id}/world-stage-progress?world=shadow&stage=6')
        self.assertEqual(400, progress_response.status_code)

    def test_new_child_only_unlocks_wind_stage_one(self):
        child_id = self.create_child('New Quest')
        client = app_module.app.test_client()

        progress = self.quest_progress(client, child_id)
        wind = self.progress_world(progress, 'wind')
        fire = self.progress_world(progress, 'fire')

        self.assertEqual('child_world_stage_progress', progress['source'])
        self.assertEqual('wind', progress['current_world'])
        self.assertEqual(1, progress['current_stage'])
        self.assertFalse(progress['mainline_complete'])
        self.assertTrue(wind['stages'][0]['unlocked'])
        self.assertEqual('current', wind['stages'][0]['status'])
        self.assertFalse(wind['stages'][1]['unlocked'])
        self.assertFalse(fire['unlocked'])

    def test_stage_clear_unlocks_next_stage_and_next_world(self):
        child_id = self.create_child('Wind Clear')
        client = app_module.app.test_client()

        self.clear_stage(client, child_id, 'wind', 1)
        progress = self.quest_progress(client, child_id)
        wind = self.progress_world(progress, 'wind')
        self.assertEqual('wind', progress['current_world'])
        self.assertEqual(2, progress['current_stage'])
        self.assertEqual('cleared', wind['stages'][0]['status'])
        self.assertEqual('current', wind['stages'][1]['status'])

        self.seed_cleared_stages(child_id, {'wind': range(2, 11)})
        progress = self.quest_progress(client, child_id)
        fire = self.progress_world(progress, 'fire')
        self.assertEqual('fire', progress['current_world'])
        self.assertEqual(1, progress['current_stage'])
        self.assertTrue(fire['unlocked'])
        self.assertEqual('current', fire['stages'][0]['status'])

    def test_light_stage_ten_unlocks_shadow_stage_one(self):
        child_id = self.create_child('Shadow Open')
        client = app_module.app.test_client()

        self.seed_cleared_stages(
            child_id,
            {world_id: range(1, 11) for world_id in ['wind', 'fire', 'water', 'thunder', 'wood', 'rock', 'light']},
        )

        progress = self.quest_progress(client, child_id)
        shadow = self.progress_world(progress, 'shadow')
        self.assertEqual('shadow', progress['current_world'])
        self.assertEqual(1, progress['current_stage'])
        self.assertTrue(shadow['unlocked'])
        self.assertEqual(5, len(shadow['stages']))
        self.assertEqual('current', shadow['stages'][0]['status'])

    def test_shadow_stage_five_completes_mainline_without_stage_six(self):
        child_id = self.create_child('Mainline Done')
        client = app_module.app.test_client()

        plan = {world_id: range(1, 11) for world_id in ['wind', 'fire', 'water', 'thunder', 'wood', 'rock', 'light']}
        plan['shadow'] = range(1, 6)
        self.seed_cleared_stages(child_id, plan)

        progress = self.quest_progress(client, child_id)
        shadow = self.progress_world(progress, 'shadow')
        self.assertTrue(progress['mainline_complete'])
        self.assertIsNone(progress['current_world'])
        self.assertIsNone(progress['current_stage'])
        self.assertEqual(75, progress['completed_stage_count'])
        self.assertEqual(5, len(shadow['stages']))
        self.assertFalse(any(stage['stage'] == 6 for stage in shadow['stages']))

    def test_mastered_words_do_not_unlock_stages_without_stage_clear(self):
        child_id = self.create_child('Mastered Only')
        conn = app_module.get_db_connection()
        try:
            conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (1,))
            conn.execute(
                '''
                INSERT INTO child_vocab_progress (
                    child_id, vocab_id, correct_count, wrong_count, review_count,
                    memory_level, last_studied_at, mastered, correct_streak
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (child_id, 1, 5, 0, 5, 5, '2026-05-31T00:00:00', 1, 5),
            )
            conn.commit()
        finally:
            conn.close()

        progress = self.quest_progress(app_module.app.test_client(), child_id)
        wind = self.progress_world(progress, 'wind')
        self.assertEqual('wind', progress['current_world'])
        self.assertEqual(1, progress['current_stage'])
        self.assertEqual('locked', wind['stages'][1]['status'])

    def test_repeated_stage_clear_is_idempotent(self):
        child_id = self.create_child('Repeat Clear')
        client = app_module.app.test_client()

        first = self.clear_stage(client, child_id, 'wind', 1)
        second = self.clear_stage(client, child_id, 'wind', 1)
        progress = self.quest_progress(client, child_id)
        wind = self.progress_world(progress, 'wind')

        self.assertTrue(first['cleared'])
        self.assertTrue(second['cleared'])
        self.assertEqual(1, progress['completed_stage_count'])
        self.assertEqual('wind', progress['current_world'])
        self.assertEqual(2, progress['current_stage'])
        self.assertEqual('cleared', wind['stages'][0]['status'])

    def test_mark_mastered_records_studied_today_without_mastering_word(self):
        child_id = self.create_child('Study Semantics')
        vocab = app_module.vocab_list[0]
        client = app_module.app.test_client()

        response = client.post(
            '/api/mark-mastered',
            json={'child_id': child_id, 'vocab_id': int(vocab['ID']), 'word': vocab['English']},
        )
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))
        payload = response.get_json()
        self.assertEqual(1, payload['progress'])
        self.assertEqual(1, payload['studied_today'])
        self.assertEqual(0, payload['mastered_total'])

        home_response = client.get(f'/api/home?child_id={child_id}')
        self.assertEqual(200, home_response.status_code)
        home_payload = home_response.get_json()
        self.assertEqual(1, home_payload['progress'])
        self.assertEqual(1, home_payload['studied_today'])
        self.assertEqual(0, home_payload['mastered_total'])

        conn = app_module.get_db_connection()
        try:
            row = conn.execute(
                'SELECT mastered, status FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, int(vocab['ID'])),
            ).fetchone()
            self.assertEqual(0, row['mastered'])
            self.assertEqual('learning', row['status'])
        finally:
            conn.close()

        with patch.object(app_module, 'get_today', return_value='2026-06-02'):
            next_day_response = client.get(f'/api/home?child_id={child_id}')
        self.assertEqual(200, next_day_response.status_code)
        self.assertEqual(0, next_day_response.get_json()['studied_today'])

    def test_stage_quiz_failed_attempt_does_not_clear_stage(self):
        child_id = self.create_child('Quiz Fail')
        client = app_module.app.test_client()
        quiz = client.get(f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1').get_json()
        answers = [
            {'id': question['id'], 'type': question['type'], 'selected': '__wrong__'}
            for question in quiz['questions']
        ]

        response = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'fail-{child_id}', 'answers': answers},
        )
        self.assertEqual(201, response.status_code, response.get_data(as_text=True))
        payload = response.get_json()
        self.assertFalse(payload['passed'])
        self.assertFalse(payload['stage_cleared'])

        stage_response = client.get(f'/api/children/{child_id}/world-stage-progress?world=wind&stage=1')
        self.assertFalse(stage_response.get_json()['cleared'])

    def test_stage_quiz_passed_attempt_immediately_clears_and_survives_refresh(self):
        child_id = self.create_child('Quiz Pass')
        client = app_module.app.test_client()
        quiz = client.get(f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1').get_json()
        answers = [
            {'id': question['id'], 'type': question['type'], 'selected': question['correct']}
            for question in quiz['questions']
        ]

        response = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'pass-{child_id}', 'answers': answers},
        )
        self.assertEqual(201, response.status_code, response.get_data(as_text=True))
        payload = response.get_json()
        self.assertTrue(payload['passed'])
        self.assertTrue(payload['stage_cleared'])

        stage_response = client.get(f'/api/children/{child_id}/world-stage-progress?world=wind&stage=1')
        self.assertTrue(stage_response.get_json()['cleared'])
        progress = self.quest_progress(client, child_id)
        self.assertEqual('wind', progress['current_world'])
        self.assertEqual(2, progress['current_stage'])

    def test_stage_quiz_attempt_submission_is_idempotent(self):
        child_id = self.create_child('Quiz Repeat')
        client = app_module.app.test_client()
        quiz = client.get(f'/api/today-review-quiz?child_id={child_id}&world=wind&stage=1').get_json()
        answers = [
            {'id': question['id'], 'type': question['type'], 'selected': question['correct']}
            for question in quiz['questions']
        ]
        attempt_id = f'repeat-{child_id}'
        body = {'world': 'wind', 'stage': 1, 'attempt_id': attempt_id, 'answers': answers}

        first = client.post(f'/api/children/{child_id}/stage-quiz-attempts', json=body)
        second = client.post(f'/api/children/{child_id}/stage-quiz-attempts', json=body)
        self.assertEqual(201, first.status_code)
        self.assertEqual(201, second.status_code)
        self.assertFalse(first.get_json()['duplicate'])
        self.assertTrue(second.get_json()['duplicate'])
        self.assertTrue(second.get_json()['stage_cleared'])

        conn = app_module.get_db_connection()
        try:
            count = conn.execute(
                'SELECT COUNT(*) AS count FROM child_stage_quiz_attempts WHERE attempt_id = ?',
                (attempt_id,),
            ).fetchone()['count']
            self.assertEqual(1, count)
        finally:
            conn.close()

    def test_stage_quiz_first_clear_awards_single_stage_card_once(self):
        self.seed_heroes(['wind-guardian-zephyrus'])
        child_id = self.create_child('Reward Wind')
        client = app_module.app.test_client()
        answers = self.passing_stage_answers(client, child_id, 'wind', 1)

        first = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'reward-wind-{child_id}-1', 'answers': answers},
        )
        second = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'reward-wind-{child_id}-2', 'answers': answers},
        )

        self.assertEqual(201, first.status_code, first.get_data(as_text=True))
        self.assertEqual(['wind-guardian-zephyrus'], [card['code'] for card in first.get_json()['reward_queue']])
        self.assertEqual([], second.get_json()['reward_queue'])

        conn = app_module.get_db_connection()
        try:
            count = conn.execute(
                'SELECT COUNT(*) AS count FROM child_heroes WHERE child_id = ?',
                (child_id,),
            ).fetchone()['count']
            self.assertEqual(1, count)
        finally:
            conn.close()

    def test_shadow_stage_five_awards_stage_card_and_final_pack_once(self):
        reward_codes = [
            'shadow-guardian-kali',
            'shadow-guardian-simayi',
            'shadow-guardian-chiyou',
            'shadow-guardian-hanchou',
            'shadow-guardian-tsukuyomi',
            'shadow-boss-anubis',
        ]
        self.seed_heroes(reward_codes)
        child_id = self.create_child('Reward Shadow')
        client = app_module.app.test_client()
        answers = self.passing_stage_answers(client, child_id, 'shadow', 5)

        first = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'shadow', 'stage': 5, 'attempt_id': f'reward-shadow-{child_id}-1', 'answers': answers},
        )
        second = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'shadow', 'stage': 5, 'attempt_id': f'reward-shadow-{child_id}-2', 'answers': answers},
        )

        self.assertEqual(201, first.status_code, first.get_data(as_text=True))
        self.assertEqual(reward_codes, [card['code'] for card in first.get_json()['reward_queue']])
        self.assertEqual([], second.get_json()['reward_queue'])

        conn = app_module.get_db_connection()
        try:
            count = conn.execute(
                'SELECT COUNT(*) AS count FROM child_heroes WHERE child_id = ?',
                (child_id,),
            ).fetchone()['count']
            self.assertEqual(6, count)
        finally:
            conn.close()

    def test_child_heroes_api_reports_owned_cards_from_backend(self):
        self.seed_heroes(['wind-guardian-zephyrus', 'fire-guardian-hephaestus'])
        child_id = self.create_child('Collection Source')
        app_module.grant_child_hero_rewards(child_id, ['wind-guardian-zephyrus'], world_id='wind', stage=1)

        response = app_module.app.test_client().get(f'/api/children/{child_id}/heroes')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))
        cards = {card['code']: card for card in response.get_json()['heroes']}

        self.assertTrue(cards['wind-guardian-zephyrus']['owned'])
        self.assertFalse(cards['fire-guardian-hephaestus']['owned'])

    def test_stage_reward_falls_back_to_legacy_hero_code_slots(self):
        self.seed_heroes(['wind-guardian1', 'wind-guardian2'])
        child_id = self.create_child('Legacy Hero Code')

        reward_queue = app_module.grant_child_stage_rewards(child_id, 'wind', 1)
        self.assertEqual(['wind-guardian1'], [card['code'] for card in reward_queue])

        response = app_module.app.test_client().get(f'/api/children/{child_id}/heroes')
        self.assertEqual(200, response.status_code, response.get_data(as_text=True))
        cards = {card['code']: card for card in response.get_json()['heroes']}
        self.assertTrue(cards['wind-guardian1']['owned'])
        self.assertFalse(cards['wind-guardian2']['owned'])

    def test_e2e_wind_stage_one_clear_awards_card_and_unlocks_stage_two(self):
        self.seed_heroes(['wind-guardian-zephyrus'])
        child_id = self.create_child('E2E Wind 1')
        client = app_module.app.test_client()
        answers = self.passing_stage_answers(client, child_id, 'wind', 1)

        response = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'e2e-wind-1-{child_id}', 'answers': answers},
        )
        self.assertEqual(201, response.status_code, response.get_data(as_text=True))
        payload = response.get_json()
        self.assertTrue(payload['passed'])
        self.assertEqual(['wind-guardian-zephyrus'], [card['code'] for card in payload['reward_queue']])

        progress = self.quest_progress(client, child_id)
        wind = self.progress_world(progress, 'wind')
        self.assertEqual('cleared', wind['stages'][0]['status'])
        self.assertEqual('current', wind['stages'][1]['status'])
        self.assertEqual('wind', progress['current_world'])
        self.assertEqual(2, progress['current_stage'])

    def test_e2e_wind_stage_ten_clear_unlocks_fire(self):
        self.seed_heroes(['wind-boss-typhoeus'])
        child_id = self.create_child('E2E Wind 10')
        client = app_module.app.test_client()
        self.seed_cleared_stages(child_id, {'wind': range(1, 10)})
        answers = self.passing_stage_answers(client, child_id, 'wind', 10)

        response = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 10, 'attempt_id': f'e2e-wind-10-{child_id}', 'answers': answers},
        )
        self.assertEqual(201, response.status_code, response.get_data(as_text=True))
        self.assertEqual(['wind-boss-typhoeus'], [card['code'] for card in response.get_json()['reward_queue']])

        progress = self.quest_progress(client, child_id)
        fire = self.progress_world(progress, 'fire')
        self.assertEqual('fire', progress['current_world'])
        self.assertEqual(1, progress['current_stage'])
        self.assertEqual('current', fire['stages'][0]['status'])

    def test_e2e_cleared_stage_can_retest_without_duplicate_reward_and_refresh_keeps_clear(self):
        self.seed_heroes(['wind-guardian-zephyrus'])
        child_id = self.create_child('E2E Retest')
        client = app_module.app.test_client()
        answers = self.passing_stage_answers(client, child_id, 'wind', 1)

        first = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'e2e-retest-{child_id}-1', 'answers': answers},
        )
        second = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'wind', 'stage': 1, 'attempt_id': f'e2e-retest-{child_id}-2', 'answers': answers},
        )

        self.assertEqual(['wind-guardian-zephyrus'], [card['code'] for card in first.get_json()['reward_queue']])
        self.assertEqual([], second.get_json()['reward_queue'])
        refresh = client.get(f'/api/children/{child_id}/world-stage-progress?world=wind&stage=1')
        self.assertTrue(refresh.get_json()['cleared'])

    def test_e2e_new_day_starts_today_progress_from_zero(self):
        child_id = self.create_child('E2E New Day')
        vocab_id = next(int(entry['ID']) for entry in app_module.vocab_list if str(entry.get('ID', '')).strip().isdigit())

        with patch.object(app_module, 'get_today', return_value='2026-06-01'):
            app_module.recordStudyResult(child_id, vocab_id, True)
            day_one = app_module.app.test_client().get(f'/api/home?child_id={child_id}').get_json()
        with patch.object(app_module, 'get_today', return_value='2026-06-02'):
            day_two = app_module.app.test_client().get(f'/api/home?child_id={child_id}').get_json()

        self.assertEqual(1, day_one['studied_today'])
        self.assertEqual(0, day_two['studied_today'])
        self.assertEqual(20, day_two['target'])

    def test_e2e_shadow_stage_five_completes_mainline_no_stage_six_and_backend_collection_recovers(self):
        reward_codes = [
            'shadow-guardian-kali',
            'shadow-guardian-simayi',
            'shadow-guardian-chiyou',
            'shadow-guardian-hanchou',
            'shadow-guardian-tsukuyomi',
            'shadow-boss-anubis',
        ]
        self.seed_heroes(reward_codes)
        child_id = self.create_child('E2E Shadow Complete')
        client = app_module.app.test_client()
        self.seed_cleared_stages(
            child_id,
            {
                'wind': range(1, 11),
                'fire': range(1, 11),
                'water': range(1, 11),
                'thunder': range(1, 11),
                'wood': range(1, 11),
                'rock': range(1, 11),
                'light': range(1, 11),
                'shadow': range(1, 5),
            },
        )
        answers = self.passing_stage_answers(client, child_id, 'shadow', 5)

        response = client.post(
            f'/api/children/{child_id}/stage-quiz-attempts',
            json={'world': 'shadow', 'stage': 5, 'attempt_id': f'e2e-shadow-5-{child_id}', 'answers': answers},
        )
        self.assertEqual(201, response.status_code, response.get_data(as_text=True))
        self.assertEqual(reward_codes, [card['code'] for card in response.get_json()['reward_queue']])

        progress = self.quest_progress(client, child_id)
        shadow = self.progress_world(progress, 'shadow')
        self.assertTrue(progress['mainline_complete'])
        self.assertIsNone(progress['current_world'])
        self.assertEqual(5, len(shadow['stages']))
        self.assertFalse(any(stage['stage'] == 6 for stage in shadow['stages']))

        collection = client.get(f'/api/children/{child_id}/heroes').get_json()
        owned_codes = {card['code'] for card in collection['heroes'] if card['owned']}
        self.assertTrue(set(reward_codes).issubset(owned_codes))


class AiPracticeSystemTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_ai_practice_next_stores_json_question(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Sora', '3', 'A2'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        client = app_module.app.test_client()
        response = client.get(f'/api/ai-practice/next?child_id={child_id}')

        self.assertEqual(200, response.status_code)
        question = response.get_json()['question']
        self.assertIn(question['type'], app_module.AI_AUTO_QUESTION_TYPES)
        self.assertEqual('rule', question['source'])
        self.assertIn('question_id', question)

        conn = app_module.get_db_connection()
        try:
            row = conn.execute('SELECT choices_json FROM ai_questions WHERE id = ?', (question['question_id'],)).fetchone()
            self.assertIsInstance(json.loads(row['choices_json']), list)
        finally:
            conn.close()

    def test_ai_practice_answer_records_mastery_and_xp(self):
        conn = app_module.get_db_connection()
        try:
            child_id = conn.execute(
                'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                ('Rin', '4', 'A2'),
            ).lastrowid
            conn.execute('INSERT OR IGNORE INTO vocabulary (id, word, meaning) VALUES (?, ?, ?)', (1, 'apple', 'りんご'))
            question_id = conn.execute(
                '''
                INSERT INTO ai_questions (
                    child_id, vocab_id, question_type, prompt, choices_json, correct_answer, explanation
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''',
                (child_id, 1, 'multiple_choice', '"apple" の意味はどれ？', '["りんご","水","本","空"]', 'りんご', 'apple は りんご です。'),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        client = app_module.app.test_client()
        response = client.post(
            '/api/ai-practice/answer',
            json={'child_id': child_id, 'question_id': question_id, 'selected_answer': 'りんご'},
        )

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertTrue(payload['correct'])
        self.assertGreaterEqual(payload['xp_awarded'], 10)
        self.assertGreater(payload['mastery'], 0)

        conn = app_module.get_db_connection()
        try:
            record = conn.execute('SELECT is_correct, mastery_after FROM ai_study_records WHERE question_id = ?', (question_id,)).fetchone()
            progress = conn.execute('SELECT mastery FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?', (child_id, 1)).fetchone()
            self.assertEqual(1, record['is_correct'])
            self.assertEqual(progress['mastery'], record['mastery_after'])
        finally:
            conn.close()


class FlashcardStageQuizFlowSourceTests(unittest.TestCase):
    def flashcard_source(self):
        path = Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'FlashcardPage.jsx'
        return path.read_text(encoding='utf-8')

    def test_twentieth_stage_word_always_loads_stage_quiz(self):
        source = self.flashcard_source()
        handle_next = source[
            source.index('const handleNextStudy = async () => {'):
            source.index('const handlePreviousStudy = async () => {')
        ]

        self.assertNotIn('getWorldStageProgress', source)
        self.assertNotIn('stageProgress?.cleared', handle_next)
        self.assertNotIn('world-stage?world=', handle_next)
        self.assertIn('await loadReviewQuiz();', handle_next)

    def test_review_quiz_api_failure_enters_visible_error_state(self):
        source = self.flashcard_source()
        load_review = source[
            source.index('const loadReviewQuiz = async () => {'):
            source.index('useEffect(() => {')
        ]

        self.assertLess(load_review.index("setMode('review');"), load_review.index('await getTodayReviewQuiz'))
        self.assertIn('Stage Quizを読み込めませんでした', load_review)
        self.assertIn("if (reviewError && mode === 'review')", source)

    def test_reward_queue_uses_local_storage_only_for_pending_display(self):
        reward_helper = (
            Path(app_module.app.root_path) / 'frontend' / 'src' / 'helpers' / 'eigoQuestRewards.js'
        ).read_text(encoding='utf-8')
        collection_source = (
            Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'CardCollectionPage.jsx'
        ).read_text(encoding='utf-8')
        reward_source = (
            Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'CardRewardPage.jsx'
        ).read_text(encoding='utf-8')

        self.assertIn('getPendingRewardQueue', reward_helper)
        self.assertIn('savePendingRewardQueue', reward_helper)
        self.assertNotIn('eigo_quest_owned_card_ids', reward_helper)
        self.assertNotIn('createMissionReward', reward_helper)
        self.assertIn('getChildHeroCards(childId)', collection_source)
        self.assertNotIn('getProgressOwnedCardIds', collection_source)
        self.assertNotIn('getHomeData', collection_source)
        self.assertIn('hasNextReward', reward_source)
        self.assertIn('setRewardIndex(nextIndex)', reward_source)

    def test_reachable_frontend_paths_do_not_use_old_reward_or_forced_pass(self):
        grammar_quest = (
            Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'GrammarQuestPage.jsx'
        ).read_text(encoding='utf-8')
        grammar_form = (
            Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'GrammarFormPracticePage.jsx'
        ).read_text(encoding='utf-8')
        daily_words = (
            Path(app_module.app.root_path) / 'frontend' / 'src' / 'pages' / 'DailyWordUnitPage.jsx'
        ).read_text(encoding='utf-8')
        next_study_word = daily_words[
            daily_words.index('const nextStudyWord = () => {'):
            daily_words.index('const chooseAnswer = (choice) => {')
        ]

        self.assertNotIn('createMissionReward', grammar_quest)
        self.assertNotIn('createMissionReward', grammar_form)
        self.assertNotIn("navigate('/card-reward')", grammar_quest)
        self.assertNotIn("navigate('/card-reward')", grammar_form)
        self.assertNotIn('const passed = true', daily_words)
        self.assertIn('today-review-quiz', next_study_word)
        self.assertNotIn("setStage('quiz')", next_study_word)


class QuizReviewApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_quiz_reports_no_review_words_without_mastered_words(self):
        with patch.object(app_module, 'load_progress', return_value={'count': 0, 'mastered_words': []}):
            response = app_module.app.test_client().get('/api/quiz')

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(0, payload['mastered_count'])
        self.assertEqual([], payload['choices'])
        self.assertEqual('mastered_words', payload['review_mode'])

    def test_quiz_returns_mastered_count_and_error_count(self):
        vocab = next(entry for entry in app_module.vocab_list if entry.get('ID') and entry.get('English'))
        app_module.log_error(vocab['ID'])
        app_module.log_error(vocab['ID'])

        with patch.object(app_module, 'load_progress', return_value={'count': 1, 'mastered_words': [vocab['English']]}):
            response = app_module.app.test_client().get(f"/api/quiz?word={vocab['English']}")

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(1, payload['mastered_count'])
        self.assertEqual(2, payload['error_count'])
        self.assertEqual(vocab['English'], payload['word'])
        self.assertTrue(payload['choices'])


if __name__ == '__main__':
    unittest.main()



