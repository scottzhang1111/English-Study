import datetime
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ['DATABASE_URL'] = ' '
IMPORT_DB_PATH = Path(tempfile.gettempdir()) / 'eigo_quest_auth_import_test.sqlite'
os.environ['EIGO_QUEST_DB_FILENAME'] = str(IMPORT_DB_PATH)

import app as app_module


class AuthSessionTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            IMPORT_DB_PATH.unlink(missing_ok=True)
        except OSError:
            pass

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'auth-test.db'
        self.db_patch = patch.object(app_module, 'get_db_path', return_value=str(self.db_path))
        self.db_patch.start()
        self.days_patch = patch.object(app_module, 'AUTH_SESSION_DAYS', 365)
        self.days_patch.start()
        app_module._DB_INITIALIZED = False
        app_module.init_db(force=True)
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.days_patch.stop()
        self.db_patch.stop()
        app_module._DB_INITIALIZED = False
        self.temp_dir.cleanup()

    def _login(self):
        response = self.client.post('/api/auth/login', json={'email': 'auth-session@example.test'})
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertTrue(payload['ok'])
        self.assertIn('children', payload)
        return payload

    def _session_row(self):
        conn = app_module.get_db_connection()
        try:
            return conn.execute(
                'SELECT session_token, expires_at FROM auth_sessions ORDER BY id DESC LIMIT 1',
            ).fetchone()
        finally:
            conn.close()

    def test_login_creates_long_lived_auth_session(self):
        before = datetime.datetime.now()
        self._login()
        row = self._session_row()
        self.assertIsNotNone(row)
        expires_at = datetime.datetime.fromisoformat(row['expires_at'])
        days_ahead = (expires_at - before).days
        self.assertGreaterEqual(days_ahead, 364)
        self.assertLessEqual(days_ahead, 365)

    def test_auth_me_refreshes_expires_at_and_returns_children(self):
        self._login()
        row = self._session_row()
        old_expires_at = (datetime.datetime.now() + datetime.timedelta(days=10)).isoformat(timespec='seconds')
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                'UPDATE auth_sessions SET expires_at = ? WHERE session_token = ?',
                (old_expires_at, row['session_token']),
            )
            conn.commit()
        finally:
            conn.close()

        response = self.client.get('/api/auth/me')
        self.assertEqual(200, response.status_code)
        payload = response.get_json()
        self.assertTrue(payload['ok'])
        self.assertIn('account', payload)
        self.assertIn('children', payload)

        refreshed_row = self._session_row()
        self.assertGreater(refreshed_row['expires_at'], old_expires_at)

    def test_expired_session_returns_401_and_deletes_old_session(self):
        self._login()
        row = self._session_row()
        expired_at = (datetime.datetime.now() - datetime.timedelta(days=1)).isoformat(timespec='seconds')
        conn = app_module.get_db_connection()
        try:
            conn.execute(
                'UPDATE auth_sessions SET expires_at = ? WHERE session_token = ?',
                (expired_at, row['session_token']),
            )
            conn.commit()
        finally:
            conn.close()

        response = self.client.get('/api/auth/me')
        self.assertEqual(401, response.status_code)
        conn = app_module.get_db_connection()
        try:
            count_row = conn.execute(
                'SELECT COUNT(*) AS c FROM auth_sessions WHERE session_token = ?',
                (row['session_token'],),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(0, int(count_row['c']))

    def test_logout_deletes_session_and_cookie(self):
        self._login()
        row = self._session_row()
        response = self.client.post('/api/auth/logout', json={})
        self.assertEqual(200, response.status_code)
        conn = app_module.get_db_connection()
        try:
            count_row = conn.execute(
                'SELECT COUNT(*) AS c FROM auth_sessions WHERE session_token = ?',
                (row['session_token'],),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(0, int(count_row['c']))
        set_cookie = response.headers.get('Set-Cookie', '')
        self.assertIn(app_module.AUTH_SESSION_COOKIE_NAME, set_cookie)
        self.assertIn('Expires=', set_cookie)


if __name__ == '__main__':
    unittest.main()
