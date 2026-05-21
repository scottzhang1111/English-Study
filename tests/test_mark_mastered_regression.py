import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as app_module


class MarkMasteredRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.get_db_path_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.get_db_path_patch.start()
        app_module.init_db(force=True)

    def tearDown(self):
        self.get_db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_mark_mastered_returns_not_found_for_missing_child(self):
        response = app_module.app.test_client().post(
            '/api/mark-mastered',
            json={'word': 'apple', 'child_id': 9999, 'vocab_id': 1},
        )

        self.assertEqual(404, response.status_code)

    def test_migrates_existing_progress_table_without_unique_index(self):
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
                conn.execute('CREATE TABLE vocabulary (id INTEGER PRIMARY KEY AUTOINCREMENT)')
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
                        FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE CASCADE
                    )
                    '''
                )
                child_id = conn.execute(
                    'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
                    ('Legacy', '3', 'A2'),
                ).lastrowid
                vocab_id = conn.execute('INSERT INTO vocabulary DEFAULT VALUES').lastrowid
                conn.executemany(
                    '''
                    INSERT INTO child_vocab_progress (
                        child_id, vocab_id, correct_count, wrong_count, review_count,
                        memory_level, last_studied_at, mastered
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    [
                        (child_id, vocab_id, 1, 0, 1, 0, '2026-05-09T00:00:00', 0),
                        (child_id, vocab_id, 2, 1, 3, 2, '2026-05-10T00:00:00', 1),
                    ],
                )
                conn.commit()
            finally:
                conn.close()

            with patch.object(app_module, 'get_db_path', return_value=str(legacy_db_path)):
                app_module.init_db(force=True)
                conn = app_module.get_db_connection()
                try:
                    indexes = conn.execute('PRAGMA index_list(child_vocab_progress)').fetchall()
                    self.assertTrue(
                        any(row['name'] == 'idx_child_vocab_progress_child_vocab' and row['unique'] for row in indexes)
                    )
                    rows = conn.execute(
                        'SELECT * FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                        (child_id, vocab_id),
                    ).fetchall()
                    self.assertEqual(1, len(rows))
                    self.assertEqual(3, rows[0]['correct_count'])
                    conn.execute(
                        '''
                        INSERT INTO child_vocab_progress (child_id, vocab_id, correct_count)
                        VALUES (?, ?, 1)
                        ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                            correct_count = child_vocab_progress.correct_count + excluded.correct_count
                        ''',
                        (child_id, vocab_id),
                    )
                    row = conn.execute(
                        'SELECT correct_count FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                        (child_id, vocab_id),
                    ).fetchone()
                    self.assertEqual(4, row['correct_count'])
                finally:
                    conn.close()
        finally:
            legacy_temp_dir.cleanup()


if __name__ == '__main__':
    unittest.main()
