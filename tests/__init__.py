import os

# Prevent the developer's local .env or shell environment from leaking into pytest runs.
# Tests should use isolated temporary databases and mocked API keys where needed.
for name in ('DATABASE_URL', 'OPENAI_API_KEY', 'GEMINI_API_KEY'):
    os.environ.pop(name, None)

# Force app imports during test collection to use a test-local SQLite database path
# rather than the real local DB or any production DATABASE_URL configuration.
os.environ.setdefault('EIGO_QUEST_DB_FILENAME', 'tests/test_eigo_quest_local_v1.sqlite')

