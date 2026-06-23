import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ['DATABASE_URL'] = ' '

import app as app_module
from scripts import seed_pre2_interview as seed_module


class FakeGeminiResponse:
    def __init__(self, text):
        self.text = text


class FakeGeminiModels:
    def __init__(self, responses, calls):
        self.responses = responses
        self.calls = calls

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.responses:
            response = self.responses.pop(0)
        else:
            response = '{}'
        if isinstance(response, Exception):
            raise response
        return FakeGeminiResponse(response)


class FakeGeminiClient:
    responses = ['{}']
    calls = []

    def __init__(self, api_key):
        self.api_key = api_key
        self.models = FakeGeminiModels(self.responses, self.calls)


class FakeGeminiError(Exception):
    def __init__(self, status_code, message='Gemini error'):
        super().__init__(f'{status_code} {message}')
        self.status_code = status_code


def fake_gemini_modules(responses):
    if not isinstance(responses, list):
        responses = [responses]
    FakeGeminiClient.responses = list(responses)
    FakeGeminiClient.calls = []
    fake_genai = SimpleNamespace(Client=FakeGeminiClient)
    fake_google = SimpleNamespace(genai=fake_genai)
    return {
        'google': fake_google,
        'google.genai': fake_genai,
    }, FakeGeminiClient.calls


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
        login_response = self.client.post(
            '/api/auth/login',
            json={'email': 'interview-api-test@example.test'},
        )
        self.assertEqual(200, login_response.status_code)
        account_id = login_response.get_json()['account']['id']
        conn = app_module.get_db_connection()
        try:
            now = app_module.get_now_iso()
            conn.execute(
                '''
                INSERT INTO children (
                    account_id, name, avatar, learning_goal, grade, target_level,
                    daily_target, daily_word_target, study_mode, created_at, updated_at
                ) VALUES (?, 'Interview Test', '', 'eiken_pre2', '小学生', 'eiken_pre2',
                          10, 10, 'normal', ?, ?)
                ''',
                (account_id, now, now),
            )
            conn.commit()
            self.child_id = conn.execute(
                'SELECT id FROM children WHERE account_id = ? AND name = ?',
                (account_id, 'Interview Test'),
            ).fetchone()['id']
            first_set = conn.execute(
                "SELECT id, passage_text FROM eiken_interview_sets WHERE external_id = 'PRE2_INT_001'",
            ).fetchone()
            self.set_id = first_set['id']
            self.first_passage = first_set['passage_text']
            self.first_question = dict(conn.execute(
                '''
                SELECT question_text, model_answer, tip_ja
                FROM eiken_interview_questions
                WHERE set_id = ? AND question_order = 1
                ''',
                (self.set_id,),
            ).fetchone())
        finally:
            conn.close()

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

    def feedback_request(self, **overrides):
        payload = {
            'child_id': self.child_id,
            'set_id': self.set_id,
            'question_order': 1,
            'question_text': self.first_question['question_text'],
            'student_answer': 'Because it is useful for students.',
            'model_answer': self.first_question['model_answer'],
            'tip_ja': self.first_question['tip_ja'],
        }
        payload.update(overrides)
        return self.client.post('/api/eiken-interview/feedback', json=payload)

    def test_feedback_rejects_empty_answer_without_calling_ai(self):
        with patch.object(
            app_module,
            'generate_eiken_interview_feedback',
            side_effect=AssertionError('AI should not be called for an empty answer'),
        ):
            response = self.feedback_request(student_answer='   ')
        self.assertEqual(400, response.status_code)
        self.assertEqual('まず答えを書いてね', response.get_json()['message'])

    def test_feedback_without_api_key_returns_fallback(self):
        response = None
        with patch.object(app_module, 'get_openai_api_key', return_value=''), patch.object(
            app_module.urllib.request,
            'urlopen',
            side_effect=AssertionError('OpenAI should not be called without an API key'),
        ):
            response = self.feedback_request(model_answer='Do not trust client model answer')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertIsNone(payload['total_score'])
        self.assertEqual('回答を保存しました。', payload['good_point_ja'])
        self.assertEqual(
            'AIチェックは現在利用できません。お手本を見て復習しましょう。',
            payload['fix_point_ja'],
        )
        self.assertEqual(self.first_question['model_answer'], payload['model_answer_en'])

    def test_feedback_returns_normalized_structured_ai_result(self):
        ai_payload = {
            'content_score': 3,
            'grammar_score': 2,
            'fluency_score': 1,
            'total_score': 0,
            'good_point_ja': '質問にしっかり答えています。',
            'fix_point_ja': 'もう一文加えるともっと自然です。',
            'model_answer_en': 'Because it is useful for students.',
            'model_answer_ja': '生徒にとって役に立つからです。',
        }

        class FakeOpenAiResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return json.dumps({'output_text': json.dumps(ai_payload, ensure_ascii=False)}).encode('utf-8')

        with patch.object(app_module, 'get_openai_api_key', return_value='test-key'), patch.object(
            app_module.urllib.request,
            'urlopen',
            return_value=FakeOpenAiResponse(),
        ) as mocked_urlopen:
            response = self.feedback_request()

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(3, payload['content_score'])
        self.assertEqual(2, payload['grammar_score'])
        self.assertEqual(1, payload['fluency_score'])
        self.assertEqual(6, payload['total_score'])
        self.assertEqual(ai_payload['good_point_ja'], payload['good_point_ja'])
        self.assertEqual(ai_payload['model_answer_ja'], payload['model_answer_ja'])
        mocked_urlopen.assert_called_once()
        openai_request = mocked_urlopen.call_args.args[0]
        request_body = json.loads(openai_request.data.decode('utf-8'))
        rendered_prompt = request_body['input']
        self.assertIn(self.first_question['question_text'], rendered_prompt)
        self.assertIn(self.first_question['model_answer'], rendered_prompt)
        self.assertIn('Because it is useful for students.', rendered_prompt)
        self.assertNotIn('{{question_text}}', rendered_prompt)

    def test_feedback_rejects_unknown_question(self):
        response = self.feedback_request(set_id=999999)
        self.assertEqual(404, response.status_code)

    def reading_feedback_request(self, **overrides):
        payload = {
            'child_id': self.child_id,
            'set_id': self.set_id,
            'transcript': self.first_passage,
            'passage_text': 'Do not trust this client passage.',
        }
        payload.update(overrides)
        return self.client.post('/api/eiken-interview/reading-feedback', json=payload)

    def test_reading_feedback_rejects_empty_transcript_without_calling_ai(self):
        with patch.object(
            app_module,
            'generate_eiken_interview_reading_feedback',
            side_effect=AssertionError('AI should not be called for an empty transcript'),
        ):
            response = self.reading_feedback_request(transcript='   ')
        self.assertEqual(400, response.status_code)
        self.assertEqual('まず音読してね', response.get_json()['message'])

    def test_reading_feedback_without_api_key_returns_fallback(self):
        with patch.object(app_module, 'get_gemini_api_key', return_value=''), patch.object(
            app_module,
            'generate_eiken_interview_reading_feedback',
            side_effect=AssertionError('Gemini should not be called without an API key'),
        ):
            response = self.reading_feedback_request()
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertIsNone(payload['reading_score'])
        self.assertIsNone(payload['completion_score'])
        self.assertEqual('音読を記録しました。最後まで読めたら大きな一歩です。', payload['good_point_ja'])
        self.assertEqual(
            'AIチェックは現在利用できません。もう一度ゆっくり読んでみよう。',
            payload['fix_point_ja'],
        )

    def test_reading_feedback_uses_database_passage_and_normalizes_scores(self):
        ai_payload = {
            'reading_score': 5,
            'completion_score': 3,
            'pronunciation_score': 2,
            'fluency_score': 2,
            'confidence_score': 2,
            'good_point_ja': '最後までよく読めました。',
            'fix_point_ja': '文の区切りで少し休みましょう。',
            'try_again_phrase': 'Many schools are improving their libraries.',
        }

        fake_modules, gemini_calls = fake_gemini_modules(json.dumps(ai_payload, ensure_ascii=False))
        with patch.object(app_module, 'get_gemini_api_key', return_value='test-key'), patch.dict(sys.modules, fake_modules):
            response = self.reading_feedback_request()

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertEqual(5, payload['reading_score'])
        self.assertEqual(3, payload['completion_score'])
        self.assertEqual(2, payload['pronunciation_score'])
        self.assertEqual(ai_payload['try_again_phrase'], payload['try_again_phrase'])
        self.assertEqual(1, len(gemini_calls))
        rendered_prompt = gemini_calls[0]['contents']
        self.assertEqual('gemini-2.5-flash', gemini_calls[0]['model'])
        self.assertNotIn('config', gemini_calls[0])
        self.assertIn(self.first_passage, rendered_prompt)
        self.assertNotIn('Do not trust this client passage.', rendered_prompt)
        self.assertNotIn('{{passage_text}}', rendered_prompt)

    def test_reading_feedback_retries_503_and_falls_back_to_gemini_20_model(self):
        ai_payload = {
            'reading_score': 4,
            'completion_score': 3,
            'pronunciation_score': 2,
            'fluency_score': 1,
            'confidence_score': 2,
            'good_point_ja': 'よく読めています。',
            'fix_point_ja': '少しゆっくり読みましょう。',
            'try_again_phrase': 'Many schools are improving their libraries.',
        }
        fake_modules, gemini_calls = fake_gemini_modules([
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            json.dumps(ai_payload, ensure_ascii=False),
        ])

        with patch.object(app_module, 'get_gemini_api_key', return_value='test-key'), patch.dict(sys.modules, fake_modules), patch.object(app_module.time, 'sleep') as mocked_sleep:
            response = self.reading_feedback_request()

        self.assertEqual(200, response.status_code)
        self.assertEqual(4, response.get_json()['reading_score'])
        self.assertEqual(
            ['gemini-2.5-flash'] * 4 + ['gemini-2.0-flash'],
            [call['model'] for call in gemini_calls],
        )
        self.assertEqual([1, 2, 4], [call.args[0] for call in mocked_sleep.call_args_list])

    def test_reading_feedback_returns_fallback_only_after_all_gemini_retries_fail(self):
        fake_modules, gemini_calls = fake_gemini_modules([
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
            FakeGeminiError(503, 'high demand'),
        ])

        with patch.object(app_module, 'get_gemini_api_key', return_value='test-key'), patch.dict(sys.modules, fake_modules), patch.object(app_module.time, 'sleep'):
            response = self.reading_feedback_request()

        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertIsNone(payload['reading_score'])
        self.assertEqual(
            ['gemini-2.5-flash'] * 4 + ['gemini-2.0-flash'] * 4,
            [call['model'] for call in gemini_calls],
        )

    def test_reading_feedback_rejects_unknown_set(self):
        response = self.reading_feedback_request(set_id=999999)
        self.assertEqual(404, response.status_code)

    def test_debug_prompts_reports_files_only_in_development(self):
        with patch.object(app_module, 'is_production_env', return_value=False):
            response = self.client.get('/api/debug/prompts')
        self.assertEqual(200, response.status_code)
        self.assertEqual({
            'reading_prompt_loaded': True,
            'qa_prompt_loaded': True,
            'attitude_prompt_loaded': True,
            'summary_prompt_loaded': True,
        }, response.get_json())

        with patch.object(app_module, 'is_production_env', return_value=True):
            response = self.client.get('/api/debug/prompts')
        self.assertEqual(404, response.status_code)


if __name__ == '__main__':
    unittest.main()
