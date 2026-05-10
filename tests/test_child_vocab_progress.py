import sqlite3
import json
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
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
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
        app_module.init_db()

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

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



