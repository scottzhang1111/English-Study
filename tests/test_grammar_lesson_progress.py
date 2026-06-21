import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['DATABASE_URL'] = ' '

import app as app_module
from scripts import seed_pre2_grammar_patterns as seed_patterns


LESSONS = [
    ('G-PREP2-PATTERN-DOING', 'Doing', 101, 15),
    ('G-PREP2-PATTERN-DO', 'Do', 102, 4),
    ('G-PREP2-PATTERN-TO-DO', 'To Do', 103, 3),
]


class GrammarLessonProgressApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'test.db'
        self.db_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.db_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db()

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
            account_id = conn.execute('SELECT id FROM accounts ORDER BY id LIMIT 1').fetchone()['id']
            conn.execute(
                "INSERT INTO children (account_id, name, grade, target_level) VALUES (?, 'A', '小5', '準2級')",
                (account_id,),
            )
            self.child_a = conn.execute("SELECT id FROM children WHERE name = 'A'").fetchone()['id']
            conn.execute(
                "INSERT INTO children (account_id, name, grade, target_level) VALUES (?, 'B', '小5', '準2級')",
                (account_id,),
            )
            self.child_b = conn.execute("SELECT id FROM children WHERE name = 'B'").fetchone()['id']
            conn.execute(
                "INSERT INTO children (account_id, name, grade, target_level) VALUES (?, 'C', '小5', '三級')",
                (account_id,),
            )
            self.child_eiken3 = conn.execute("SELECT id FROM children WHERE name = 'C'").fetchone()['id']

            for grammar_id, (lesson_id, title, order, pattern_count) in enumerate(LESSONS, start=1):
                patterns = [{'pattern': f'pattern-{index}'} for index in range(pattern_count)]
                conn.execute(
                    '''
                    INSERT INTO grammar_lessons (
                        lesson_id, grammar_id, level, category, title, grammar_point,
                        display_order, is_active, patterns_json
                    ) VALUES (?, ?, 'eiken_pre2', '高頻句型', ?, '重要句型', ?, 1, ?)
                    ''',
                    (lesson_id, grammar_id, title, order, json.dumps(patterns)),
                )
                for index in range(10):
                    conn.execute(
                        '''
                        INSERT INTO grammar_quizzes (
                            quiz_id, lesson_id, question_jp, choice_a, choice_b,
                            choice_c, choice_d, answer_index, explanation_jp, quiz_order
                        ) VALUES (?, ?, 'Question', 'A', 'B', 'C', 'D', 0, 'Explanation', ?)
                        ''',
                        (f'{lesson_id}-Q{index + 1}', lesson_id, index + 1),
                    )
            conn.commit()
        finally:
            conn.close()
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.db_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def answers(self, correct_count):
        lesson_id = LESSONS[0][0]
        return [
            {'quiz_id': f'{lesson_id}-Q{index + 1}', 'selected_index': 0 if index < correct_count else 1}
            for index in range(10)
        ]

    def lessons_for(self, child_id):
        response = self.client.get(f'/api/grammar/lessons?child_id={child_id}')
        self.assertEqual(200, response.status_code)
        return response.get_json()

    def test_seed_lessons_are_listed_as_not_started_and_eiken3_is_filtered(self):
        payload = self.lessons_for(self.child_a)
        self.assertEqual(['Doing', 'Do', 'To Do'], [lesson['title'] for lesson in payload['lessons']])
        self.assertTrue(all(lesson['status'] == '未学習' for lesson in payload['lessons']))
        self.assertEqual(15, payload['lessons'][0]['pattern_count'])
        self.assertEqual(10, payload['lessons'][0]['question_count'])

        eiken3_payload = self.lessons_for(self.child_eiken3)
        self.assertEqual([], eiken3_payload['lessons'])
        self.assertTrue(eiken3_payload['preparing'])

    def test_doing_do_to_do_seed_is_idempotent(self):
        conn = app_module.get_db_connection()
        try:
            for _ in range(2):
                seed_patterns.ensure_patterns_column(conn)
                for lesson in seed_patterns.LESSONS:
                    seed_patterns.upsert_lesson(conn, lesson)
                    for index, quiz in enumerate(lesson['quizzes'], start=1):
                        seed_patterns.upsert_quiz(conn, lesson, index, quiz)
                conn.commit()
            lesson_count = conn.execute(
                "SELECT COUNT(*) AS count FROM grammar_lessons WHERE title IN ('Doing', 'Do', 'To Do')"
            ).fetchone()['count']
            quiz_count = conn.execute(
                "SELECT COUNT(*) AS count FROM grammar_quizzes WHERE quiz_id LIKE 'Q-PREP2-PATTERN-%'"
            ).fetchone()['count']
        finally:
            conn.close()
        self.assertEqual(3, lesson_count)
        self.assertEqual(30, quiz_count)

    def test_view_test_status_best_score_and_child_isolation(self):
        lesson_id = LESSONS[0][0]
        viewed = self.client.post(
            f'/api/grammar/lessons/{lesson_id}/viewed',
            json={'child_id': self.child_a},
        )
        self.assertEqual(200, viewed.status_code)
        self.assertEqual('学習中', self.lessons_for(self.child_a)['lessons'][0]['status'])
        self.assertEqual('未学習', self.lessons_for(self.child_b)['lessons'][0]['status'])

        failed = self.client.post(
            f'/api/grammar/lessons/{lesson_id}/submit',
            json={'child_id': self.child_a, 'answers': self.answers(7)},
        )
        self.assertEqual(200, failed.status_code)
        self.assertEqual('テスト未合格', failed.get_json()['status'])
        self.assertEqual(7, failed.get_json()['best_score'])

        passed = self.client.post(
            f'/api/grammar/lessons/{lesson_id}/submit',
            json={'child_id': self.child_a, 'answers': self.answers(9)},
        )
        self.assertEqual(200, passed.status_code)
        self.assertEqual('合格', passed.get_json()['status'])
        self.assertEqual(9, passed.get_json()['best_score'])

        lower_score = self.client.post(
            f'/api/grammar/lessons/{lesson_id}/submit',
            json={'child_id': self.child_a, 'answers': self.answers(8)},
        ).get_json()
        self.assertEqual(8, lower_score['last_score'])
        self.assertEqual(9, lower_score['best_score'])
        self.assertEqual(3, lower_score['attempts_count'])


if __name__ == '__main__':
    unittest.main()
