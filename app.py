from flask import Flask, abort, request, Response, jsonify, redirect, send_from_directory
import csv
import datetime
import html
import json
import os
import random
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from werkzeug.exceptions import HTTPException

try:
    import psycopg2
    from psycopg2.extras import DictCursor
except ImportError:
    psycopg2 = None
    DictCursor = None

from pokeapi_service import PokeApiError

try:
    from flask_cors import CORS
except ImportError:
    def CORS(*args, **kwargs):
        return None

app = Flask(__name__)
_DB_INITIALIZED = False

DB_FILENAME = 'eigo_quest_local_v1.sqlite'
VOCAB_FILENAME = os.path.join('data', 'eiken', 'eiken_pre2', 'eiken_pre2_web_ready_db', 'eiken_vocab_database_with_synonyms_utf8_bom.csv')
EIKEN_PRE2_BANK_FILENAME = os.path.join('data', 'eiken', 'eiken_pre2', 'eiken_pre2_web_ready_db', 'eiken_pre2_web_ready.sqlite')
EIKEN_REAL_EXAM_DIR = os.path.join('data', 'eiken', 'eiken real exam', 'Listening', 'www.cloudsemi.com', 'member', 'eiken', 'eikenj2')
EIKEN_REAL_EXAM_LISTENING_ANSWER_DIR = os.path.join(EIKEN_REAL_EXAM_DIR, 'listening_answers')
EIKEN_REAL_EXAM_WRITTEN_ANSWER_DIR = os.path.join(EIKEN_REAL_EXAM_DIR, 'written_answers')
EIKEN_REAL_EXAM_LEGACY_ANSWER_DIR = os.path.join(EIKEN_REAL_EXAM_DIR, 'cloudsemi_eikenj2_answers')
EIKEN_REAL_EXAM_ANSWER_KEY_FILENAME = os.path.join('data', 'eiken', 'eiken_real_exam_answer_key.json')
GRAMMAR_LESSON_DB_FILENAME = os.path.join('data', 'eiken', 'eiken_pre2', 'eiken_pre2 grammar', 'eiken_pre2_grammar_lessons.db')
GRAMMAR_FORM_TEST_DB_FILENAME = os.path.join('data', 'eiken', 'eiken_pre2', 'eiken_pre2 grammar', 'eiken_pre2_grammar_form_test_sample_17.db')
OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
AI_QUESTION_TYPES = ['Vocabulary', 'Grammar', 'Conversation', 'Reading Cloze']
AI_AUTO_QUESTION_TYPES = ['multiple_choice', 'fill_blank', 'en_to_ja', 'ja_to_en', 'sentence', 'reading', 'writing']
EIGO_QUEST_WORDS_PER_STAGE = 20
EIGO_QUEST_WORLDS = [
    {'id': 'wind', 'order': 1, 'stage_count': 10, 'word_count': 200, 'word_start_index': 0},
    {'id': 'fire', 'order': 2, 'stage_count': 10, 'word_count': 200, 'word_start_index': 200},
    {'id': 'water', 'order': 3, 'stage_count': 10, 'word_count': 200, 'word_start_index': 400},
    {'id': 'thunder', 'order': 4, 'stage_count': 10, 'word_count': 200, 'word_start_index': 600},
    {'id': 'wood', 'order': 5, 'stage_count': 10, 'word_count': 200, 'word_start_index': 800},
    {'id': 'rock', 'order': 6, 'stage_count': 10, 'word_count': 200, 'word_start_index': 1000},
    {'id': 'light', 'order': 7, 'stage_count': 10, 'word_count': 200, 'word_start_index': 1200},
    {'id': 'shadow', 'order': 8, 'stage_count': 5, 'word_count': 100, 'word_start_index': 1400},
]
EIGO_QUEST_WORLD_MAP = {world['id']: world for world in EIGO_QUEST_WORLDS}
EIGO_QUEST_WORLD_ORDER = [world['id'] for world in EIGO_QUEST_WORLDS]
EIGO_QUEST_TOTAL_STAGES = sum(world['stage_count'] for world in EIGO_QUEST_WORLDS)
EIGO_QUEST_TOTAL_WORDS = sum(world['word_count'] for world in EIGO_QUEST_WORLDS)
AUTH_SESSION_COOKIE_NAME = 'eq_auth_session'
AUTH_SESSION_DAYS = 30
# Stage reward cards use the existing official heroes rows in the database.
# The heroes table already contains 80 cards using codes such as
# wind-guardian1 ... shadow-guardian10.
EIGO_QUEST_STAGE_REWARD_CODES = {
    'wind': [f'wind-guardian{i}' for i in range(1, 11)],
    'fire': [f'fire-guardian{i}' for i in range(1, 11)],
    'water': [f'water-guardian{i}' for i in range(1, 11)],
    'thunder': [f'thunder-guardian{i}' for i in range(1, 11)],
    'wood': [f'wood-guardian{i}' for i in range(1, 11)],
    'rock': [f'rock-guardian{i}' for i in range(1, 11)],
    'light': [f'light-guardian{i}' for i in range(1, 11)],
    'shadow': [f'shadow-guardian{i}' for i in range(1, 6)],
}

# Final reward pack after clearing shadow Stage 5.
EIGO_QUEST_FINAL_REWARD_CODES = [
    f'shadow-guardian{i}' for i in range(6, 11)
]

# Kept for compatibility with older helper code.
# New rewards should resolve directly to the official database hero codes.
EIGO_QUEST_LEGACY_REWARD_CODE_MAP = {}



STARTER_POKEMON_IDS = [1, 10, 19]
POKEMON_NAME_FALLBACKS = {
    1: 'フシギダネ',
    4: 'ヒトカゲ',
    7: 'ゼニガメ',
}
PET_CATALOG = [
    {'name': 'Panda Tutor', 'emoji': 'PT', 'unlock_at': 0},
    {'name': 'Sunny Buddy', 'emoji': 'SB', 'unlock_at': 1},
    {'name': 'Tiny Fox', 'emoji': 'TF', 'unlock_at': 25},
    {'name': 'Dream Dragon', 'emoji': 'DD', 'unlock_at': 50},
    {'name': 'Sleepy Koala', 'emoji': 'SK', 'unlock_at': 75},
    {'name': 'Mint Bird', 'emoji': 'MB', 'unlock_at': 100},
    {'name': 'Star Penguin', 'emoji': 'SP', 'unlock_at': 100},
    {'name': 'Cloud Frog', 'emoji': 'CF', 'unlock_at': 100},
    {'name': 'Lion Buddy', 'emoji': 'LB', 'unlock_at': 100},
]


def load_pet_master():
    path = os.path.join(app.root_path, 'frontend', 'src', 'pet_master_ja.json')
    try:
        with open(path, 'r', encoding='utf-8') as file:
            pets = json.load(file)
    except (OSError, json.JSONDecodeError):
        pets = []
    catalog = []
    for index, pet in enumerate(pets, start=1):
        item = dict(pet)
        item['catalog_id'] = index
        item['image_url'] = item.get('image')
        item['sprite_url'] = item.get('image')
        item['types'] = [{'name': item.get('element') or 'pet'}]
        catalog.append(item)
    return catalog


CUSTOM_PET_MASTER = load_pet_master()
CUSTOM_PET_BY_CATALOG_ID = {pet['catalog_id']: pet for pet in CUSTOM_PET_MASTER}
CUSTOM_PET_TOTAL = len(CUSTOM_PET_MASTER) or 24


def get_custom_pet_by_id(pet_id):
    try:
        normalized_id = int(pet_id)
    except (TypeError, ValueError):
        normalized_id = 1
    return CUSTOM_PET_BY_CATALOG_ID.get(normalized_id) or (CUSTOM_PET_MASTER[0] if CUSTOM_PET_MASTER else None)


def load_env_file(path):
    if not os.path.exists(path):
        return

    with open(path, 'r', encoding='utf-8-sig') as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or '=' not in stripped:
                continue

            key, value = stripped.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def load_local_env():
    env_paths = [
        os.path.join(app.root_path, '.env'),
        os.path.join(os.getcwd(), '.env'),
        os.path.abspath(os.path.join(app.root_path, '..', '.env')),
    ]

    seen = set()
    for path in env_paths:
        normalized = os.path.normcase(os.path.abspath(path))
        if normalized not in seen:
            seen.add(normalized)
            load_env_file(path)


load_local_env()


def get_cors_origins():
    configured = ','.join(
        value
        for value in [os.getenv('FRONTEND_ORIGIN', ''), os.getenv('FRONTEND_URL', '')]
        if value
    )
    origins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        r'https://.*\.vercel\.app',
    ]
    origins.extend(origin.strip() for origin in configured.split(',') if origin.strip())
    return origins


CORS(
    app,
    resources={r'/api/*': {'origins': get_cors_origins()}, r'/debug/*': {'origins': get_cors_origins()}, r'/health': {'origins': get_cors_origins()}},
    supports_credentials=True,
)


@app.errorhandler(HTTPException)
def handle_http_exception(error):
    return jsonify(
        error=error.name,
        message=error.description,
        status=error.code,
    ), error.code


@app.errorhandler(Exception)
def handle_unexpected_exception(error):
    app.logger.exception('Unhandled exception during %s %s', request.method, request.path)
    return jsonify(
        error='internal_server_error',
        message='サーバーで問題が起きました。時間をおいてもう一度ためしてください。',
        status=500,
    ), 500


def get_openai_api_key():
    return os.getenv('OPENAI_API_KEY', '').strip()


def get_openai_model():
    return os.getenv('OPENAI_MODEL', 'gpt-5-mini').strip() or 'gpt-5-mini'


def get_openai_reasoning_effort(model):
    configured = os.getenv('OPENAI_REASONING_EFFORT', '').strip()
    if configured:
        return configured
    if model.startswith('gpt-5.1'):
        return 'none'
    if model.startswith('gpt-5'):
        return 'minimal'
    return None


def data_path(filename):
    return os.path.join(app.root_path, filename)


def ensure_parent_dir(path):
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)


def get_database_url():
    return os.getenv('DATABASE_URL', '').strip()


def use_postgres():
    return bool(get_database_url())


def _pg_transform_sql(sql):
    transformed = sql.strip()
    if not transformed:
        return transformed

    upper = transformed.upper()
    if upper.startswith('PRAGMA FOREIGN_KEYS'):
        return ''
    if upper.startswith('CREATE TRIGGER') or upper.startswith('DROP TRIGGER'):
        return ''

    pragma_match = re.fullmatch(r'PRAGMA\s+table_info\(([^)]+)\)', transformed, flags=re.I)
    if pragma_match:
        table_name = pragma_match.group(1).strip().strip('"').strip("'")
        return (
            "SELECT ordinal_position - 1 AS cid, column_name AS name, data_type AS type, "
            "CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END AS notnull, "
            "column_default AS dflt_value, CASE WHEN column_name IN ("
            "SELECT a.attname FROM pg_index i "
            "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
            "WHERE i.indrelid = %s::regclass AND i.indisprimary"
            ") THEN 1 ELSE 0 END AS pk "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s "
            "ORDER BY ordinal_position"
        ), (table_name, table_name)

    transformed = re.sub(
        r'\b(\w+)\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b',
        r'\1 INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY',
        transformed,
        flags=re.I,
    )
    transformed = re.sub(r'\bAUTOINCREMENT\b', '', transformed, flags=re.I)
    if re.match(r'\s*CREATE\s+TABLE\b', transformed, flags=re.I):
        transformed = '\n'.join(
            line for line in transformed.splitlines()
            if not re.search(r'\bFOREIGN\s+KEY\b', line, flags=re.I)
        )
        transformed = re.sub(r',\s*\)', '\n)', transformed, flags=re.S)
    transformed = re.sub(
        r"SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type='table'\s+AND\s+name\s*=\s*\?",
        "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename = %s",
        transformed,
        flags=re.I,
    )
    transformed = re.sub(
        r"CASE\s+WHEN\s+json_valid\(types\)\s+THEN\s+json_extract\(types,\s*'\$\[[01]\]\.name'\)\s+END",
        "NULL",
        transformed,
        flags=re.I,
    )

    if re.match(r'\s*INSERT\s+OR\s+IGNORE\s+INTO\b', transformed, flags=re.I):
        transformed = re.sub(r'\bINSERT\s+OR\s+IGNORE\s+INTO\b', 'INSERT INTO', transformed, flags=re.I)
        if 'ON CONFLICT' not in transformed.upper():
            transformed = f'{transformed} ON CONFLICT DO NOTHING'

    transformed = transformed.replace('?', '%s')
    return transformed


def _pg_insert_table(sql):
    match = re.match(r'\s*INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\b', sql, flags=re.I)
    return match.group(1).lower() if match else ''


class PostgresCursor:
    def __init__(self, cursor):
        self.cursor = cursor
        self.lastrowid = None

    def execute(self, sql, params=None):
        self.lastrowid = None
        transformed = _pg_transform_sql(sql)
        extra_params = None
        if isinstance(transformed, tuple):
            transformed, extra_params = transformed
        if not transformed:
            return self

        final_params = extra_params if extra_params is not None else params
        table_name = _pg_insert_table(transformed)
        should_return_id = (
            table_name in {'children', 'ai_questions'}
            and 'RETURNING' not in transformed.upper()
            and 'ON CONFLICT' not in transformed.upper()
        )
        if should_return_id:
            transformed = f'{transformed} RETURNING id'

        self.cursor.execute(transformed, final_params)
        if should_return_id:
            row = self.cursor.fetchone()
            if row:
                self.lastrowid = row[0]
        return self

    def executemany(self, sql, seq_of_params):
        transformed = _pg_transform_sql(sql)
        if isinstance(transformed, tuple):
            transformed = transformed[0]
        if not transformed:
            return self
        self.cursor.executemany(transformed, seq_of_params)
        return self

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()


class PostgresConnection:
    def __init__(self, conn):
        self.conn = conn

    def execute(self, sql, params=None):
        cursor = PostgresCursor(self.conn.cursor())
        return cursor.execute(sql, params)

    def executemany(self, sql, seq_of_params):
        cursor = PostgresCursor(self.conn.cursor())
        return cursor.executemany(sql, seq_of_params)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def _read_csv_with_fallback(filename):
    csv_path = data_path(filename)
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'Vocabulary database not found: {filename}')

    last_error = None
    for encoding in ['utf-8-sig', 'cp932', 'shift_jis']:
        try:
            with open(csv_path, 'r', encoding=encoding, newline='') as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError as exc:
            last_error = exc

    raise last_error or UnicodeDecodeError('utf-8', b'', 0, 1, 'Unable to decode CSV')


def _clean_csv_value(value):
    if value is None:
        return ''
    return str(value).strip()


def _row_value(row, key, default=None):
    if row is None:
        return default
    try:
        value = row[key]
    except (KeyError, IndexError, TypeError):
        return default
    return default if value is None else value


def _is_japanese_text(value):
    text = _clean_csv_value(value)
    if not text:
        return False
    for char in text:
        code = ord(char)
        if (
            0x3040 <= code <= 0x30FF
            or 0x3400 <= code <= 0x4DBF
            or 0x4E00 <= code <= 0x9FFF
            or 0xF900 <= code <= 0xFAFF
        ):
            return True
    return False


def _looks_like_pokemon_japanese_name(value):
    text = _clean_csv_value(value)
    if not text:
        return False
    allowed = set('繝ｼ繝ｻ・･ ')
    for char in text:
        code = ord(char)
        if (
            0x3040 <= code <= 0x309F
            or 0x30A0 <= code <= 0x30FF
            or 0xFF65 <= code <= 0xFF9F
            or char in allowed
        ):
            continue
        return False
    return True


def normalize_vocab_row(row):
    english = _clean_csv_value(row.get('English'))
    if not english:
        return None

    return {
        'ID': _clean_csv_value(row.get('ID') or row.get('No')),
        'No': _clean_csv_value(row.get('No') or row.get('ID')),
        'English': english,
        'Category': _clean_csv_value(row.get('词性') or row.get('category') or row.get('Category')),
        'Japanese': _clean_csv_value(row.get('日文释义') or row.get('Japanese')),
        'Chinese': _clean_csv_value(row.get('中文翻译') or row.get('Chinese')),
        'Example_English_Short': _clean_csv_value(row.get('Example_English short') or row.get('英文例句')),
        'Example_English': _clean_csv_value(row.get('英文例句') or row.get('Example_English')),
        'Example_Japanese': _clean_csv_value(row.get('例句日文') or row.get('Example_Japanese')),
        'Example_Chinese': _clean_csv_value(row.get('例句中文') or row.get('Example_Chinese')),
        'Phrase': _clean_csv_value(row.get('熟语/搭配') or row.get('Phrase')),
        'Importance': _clean_csv_value(row.get('重要度') or row.get('Importance')),
        'Review_Count': _clean_csv_value(row.get('复习次数') or row.get('Review_Count')),
        'Mistake_Time': _clean_csv_value(row.get('错误次数') or row.get('mistake time')),
        'Frequency_In_Test': _clean_csv_value(row.get('出现频率') or row.get('Frequncy in test') or row.get('Frequency in test')),
        'Antonyms': _clean_csv_value(row.get('反义词') or row.get('Antonyms')),
        'Antonyms_Japanese': _clean_csv_value(row.get('反义词日语翻译') or row.get('Antonyms_Japanese')),
        'Synonyms': _clean_csv_value(row.get('近义词') or row.get('Synonyms')),
        'Synonyms_Japanese': _clean_csv_value(row.get('近义词日语翻译') or row.get('Synonyms_Japanese')),
    }


def get_vocab_key(entry):
    return _clean_csv_value(entry.get('ID') or entry.get('No') or entry.get('English')).lower()


def get_vocab_index(entries=None):
    entries = entries or vocab_list
    index = {}
    for entry in entries:
        key = get_vocab_key(entry)
        if key:
            index[key] = entry
    return index


def resolve_vocab_entry(identifier, entries=None):
    if not identifier:
        return None

    entries = entries or vocab_list
    target = _clean_csv_value(identifier).lower()
    by_id = get_vocab_index(entries)
    match = by_id.get(target)
    if match:
        return match

    for entry in entries:
        if _clean_csv_value(entry.get('English')).lower() == target:
            return entry
    return None


def ensure_vocab_entry_exists(identifier):
    entry = resolve_vocab_entry(identifier, vocab_list)
    if not entry:
        abort(404, 'word not found')
    return entry


def filter_vocab_entries(entries, importance=None, frequency=None):
    filtered = list(entries)
    importance = _clean_csv_value(importance).upper()
    frequency = _clean_csv_value(frequency).upper()

    if importance and importance != 'ALL':
        filtered = [entry for entry in filtered if _clean_csv_value(entry.get('Importance')).upper() == importance]

    if frequency and frequency != 'ALL':
        filtered = [
            entry for entry in filtered
            if _clean_csv_value(entry.get('Frequency_In_Test')).upper() == frequency
        ]

    return filtered


def split_related_vocab_terms(value):
    text = _clean_csv_value(value)
    if not text:
        return []
    terms = re.split(r'[;,/、，；]+', text)
    return [term.strip() for term in terms if term.strip()]


def get_vocab_expansion_entries(entries=None):
    entries = entries or vocab_list
    return [
        entry for entry in entries
        if split_related_vocab_terms(entry.get('Synonyms')) or split_related_vocab_terms(entry.get('Antonyms'))
    ]


def build_example_cloze_question(sentence, word):
    sentence = _clean_csv_value(sentence)
    word = _clean_csv_value(word)
    if not sentence or not word:
        return ''
    escaped = re.escape(word)
    question = re.sub(rf'\b{escaped}\b', '____', sentence, count=1, flags=re.IGNORECASE)
    if question != sentence:
        return question
    question = re.sub(escaped, '____', sentence, count=1, flags=re.IGNORECASE)
    return question if question != sentence else ''


def build_vocab_expansion_question(mode=None, child_id=None):
    learned_entries = get_child_mastered_vocab_entries(child_id)
    learned_words = {
        entry.get('English', '').strip().lower()
        for entry in learned_entries
        if entry.get('English', '').strip()
    }
    candidates = get_vocab_expansion_entries(learned_entries)
    if not candidates:
        raise LookupError('まだ練習できる単語がありません。まず単語カードで覚えましょう。')

    requested_mode = _clean_csv_value(mode).lower()
    if requested_mode not in ['synonym', 'antonym']:
        requested_mode = random.choice(['synonym', 'antonym'])

    mode_key = 'Synonyms' if requested_mode == 'synonym' else 'Antonyms'
    available = [
        entry for entry in candidates
        if any(term.lower() in learned_words for term in split_related_vocab_terms(entry.get(mode_key)))
    ]
    if not available:
        fallback_mode = 'antonym' if requested_mode == 'synonym' else 'synonym'
        mode_key = 'Synonyms' if fallback_mode == 'synonym' else 'Antonyms'
        available = [
            entry for entry in candidates
            if any(term.lower() in learned_words for term in split_related_vocab_terms(entry.get(mode_key)))
        ]
        requested_mode = fallback_mode
    if not available:
        raise LookupError('まだ練習できる単語がありません。まず単語カードで覚えましょう。')

    entry = random.choice(available)
    correct_terms = [
        term for term in split_related_vocab_terms(entry.get(mode_key))
        if term.lower() in learned_words
    ]
    if not correct_terms:
        raise LookupError('まだ練習できる単語がありません。まず単語カードで覚えましょう。')
    correct = random.choice(correct_terms)
    distractor_pool = []
    for other in candidates:
        if get_vocab_key(other) == get_vocab_key(entry):
            continue
        distractor_pool.extend(
            term for term in split_related_vocab_terms(other.get('Synonyms'))
            if term.lower() in learned_words
        )
        distractor_pool.extend(
            term for term in split_related_vocab_terms(other.get('Antonyms'))
            if term.lower() in learned_words
        )

    seen = {correct.lower(), entry.get('English', '').strip().lower()}
    distractors = []
    for term in random.sample(distractor_pool, len(distractor_pool)):
        normalized = term.lower()
        if normalized and normalized not in seen:
            distractors.append(term)
            seen.add(normalized)
        if len(distractors) >= 3:
            break

    choices = [correct] + distractors
    random.shuffle(choices)
    label = 'synonym' if requested_mode == 'synonym' else 'antonym'
    return {
        'id': entry.get('ID', ''),
        'word': entry.get('English', ''),
        'mode': requested_mode,
        'question': f'Choose the best {label} for "{entry.get("English", "")}".',
        'choices': choices,
        'correct': correct,
        'japanese': entry.get('Japanese', ''),
        'chinese': entry.get('Chinese', ''),
        'example': entry.get('Example_English', ''),
        'example_jp': entry.get('Example_Japanese', ''),
        'phrase': entry.get('Phrase', ''),
        'synonyms': split_related_vocab_terms(entry.get('Synonyms')),
        'synonyms_japanese': entry.get('Synonyms_Japanese', ''),
        'antonyms': split_related_vocab_terms(entry.get('Antonyms')),
        'antonyms_japanese': entry.get('Antonyms_Japanese', ''),
    }


""" def load_vocabulary(filename=VOCAB_FILENAME):
    if use_postgres():
        database_vocab = load_vocabulary_from_postgres_words()
        if database_vocab:
            return database_vocab
        raise RuntimeError("DATABASE_URL is set, but no vocabulary was loaded from PostgreSQL words table.")

    vocab = []
    for row in _read_csv_with_fallback(filename):
        normalized = normalize_vocab_row(row)
        if normalized:
            vocab.append(normalized)
    return vocab """

def load_vocabulary(filename=VOCAB_FILENAME):
    database_vocab = load_vocabulary_from_database_words()

    if database_vocab:
        return database_vocab

    if use_postgres():
        raise RuntimeError(
            "DATABASE_URL is set, but no vocabulary was loaded from PostgreSQL words table."
        )

    app.logger.warning(
        "No vocabulary was loaded from SQLite words table. Falling back to CSV: %s",
        filename,
    )

    vocab = []
    for row in _read_csv_with_fallback(filename):
        normalized = normalize_vocab_row(row)
        if normalized:
            vocab.append(normalized)
    return vocab
def load_vocabulary_from_database_words():
    try:
        conn = get_db_connection()
        try:
            if use_postgres():
                table_row = conn.execute(
                    "SELECT to_regclass('public.words') AS table_name"
                ).fetchone()
                if not table_row or not table_row['table_name']:
                    return []
            else:
                table_row = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='words'"
                ).fetchone()
                if not table_row:
                    return []

            rows = conn.execute(
                '''
                SELECT
                    id,
                    word,
                    level,
                    frequency,
                    part_of_speech,
                    meaning_ja,
                    meaning_cn,
                    phrase,
                    example_en,
                    example_ja,
                    example_cn,
                    synonyms,
                    antonyms
                FROM words
                ORDER BY frequency ASC, id ASC
                '''
            ).fetchall()
        finally:
            conn.close()
    except Exception:
        app.logger.exception('Failed to load vocabulary from database words table')
        return []

    def importance_for_frequency(value):
        try:
            frequency = int(value)
        except (TypeError, ValueError):
            return ''
        if frequency <= 500:
            return 'A'
        if frequency <= 1000:
            return 'B'
        return 'C'

    return [
        {
            'ID': str(row['id']),
            'No': str(row['id']),
            'English': _clean_csv_value(row['word']),
            'Category': _clean_csv_value(row['part_of_speech']),
            'Japanese': _clean_csv_value(row['meaning_ja']),
            'Chinese': _clean_csv_value(row['meaning_cn']),
            'Example_English_Short': _clean_csv_value(row['example_en']),
            'Example_English': _clean_csv_value(row['example_en']),
            'Example_Japanese': _clean_csv_value(row['example_ja']),
            'Example_Chinese': _clean_csv_value(row['example_cn']),
            'Phrase': _clean_csv_value(row['phrase']),
            'Importance': importance_for_frequency(row['frequency']),
            'Review_Count': '',
            'Mistake_Time': '',
            'Synonyms': _clean_csv_value(row['synonyms']),
            'Synonyms_Japanese': '',
            'Antonyms': _clean_csv_value(row['antonyms']),
            'Antonyms_Japanese': '',
            'Frequency_In_Test': _clean_csv_value(row['frequency']),
            'Source': 'database.words',
            'Eiken_Level': _clean_csv_value(row['level']),
        }
        for row in rows
        if _clean_csv_value(row['word'])
    ]

""" def load_vocabulary_from_postgres_words():
    try:
        conn = get_db_connection()
        try:
            table_row = conn.execute(
                "SELECT to_regclass('public.words') AS table_name"
            ).fetchone()
            if not table_row or not table_row['table_name']:
                return []
            rows = conn.execute(
                '''
                SELECT id, word, level, frequency, part_of_speech, meaning_ja, meaning_cn,
                       phrase, example_en, example_ja, example_cn, synonyms, antonyms
                FROM words
                ORDER BY frequency ASC, id ASC
                '''
            ).fetchall()
        finally:
            conn.close()
    except Exception:
        app.logger.exception('Failed to load vocabulary from PostgreSQL words table')
        return []

    def importance_for_frequency(value):
        try:
            frequency = int(value)
        except (TypeError, ValueError):
            return ''
        if frequency <= 500:
            return 'A'
        if frequency <= 1000:
            return 'B'
        return 'C'

    return [
        {
            'ID': str(row['id']),
            'No': str(row['id']),
            'English': _clean_csv_value(row['word']),
            'Category': _clean_csv_value(row['part_of_speech']),
            'Japanese': _clean_csv_value(row['meaning_ja']),
            'Chinese': _clean_csv_value(row['meaning_cn']),
            'Example_English_Short': _clean_csv_value(row['example_en']),
            'Example_English': _clean_csv_value(row['example_en']),
            'Example_Japanese': _clean_csv_value(row['example_ja']),
            'Example_Chinese': _clean_csv_value(row['example_cn']),
            'Phrase': _clean_csv_value(row['phrase']),
            'Importance': importance_for_frequency(row['frequency']),
            'Review_Count': '',
            'Mistake_Time': '',
            'Synonyms': _clean_csv_value(row['synonyms']),
            'Synonyms_Japanese': '',
            'Antonyms': _clean_csv_value(row['antonyms']),
            'Antonyms_Japanese': '',
            'Frequency_In_Test': _clean_csv_value(row['frequency']),
            'Source': 'postgres.words',
            'Eiken_Level': _clean_csv_value(row['level']),
        }
        for row in rows
        if _clean_csv_value(row['word'])
    ]
 """

def load_vocabulary_from_postgres_words():
    return load_vocabulary_from_database_words()

def load_vocabulary_from_csv(filename):
    return load_vocabulary(filename)


def load_context():
    context_entries = []
    context_path = data_path('context.csv')
    if not os.path.exists(context_path):
        return context_entries

    with open(context_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            context_entries.append(row)
    return context_entries


def load_json_file(filename, default_value):
    path = data_path(filename)
    if not os.path.exists(path):
        return default_value
    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception:
        return default_value


def save_json_file(filename, data):
    path = data_path(filename)
    ensure_parent_dir(path)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_today():
    return datetime.date.today().isoformat()


def get_now_iso():
    return datetime.datetime.now().isoformat(timespec='seconds')


def load_settings():
    return load_json_file('settings.json', {'daily_target': 20})


def save_settings(settings):
    save_json_file('settings.json', settings)


def load_progress():
    today = get_today()
    progress = load_json_file('progress_store.json', {'date': today, 'count': 0, 'mastered_words': []})
    if progress.get('date') != today:
        progress = {'date': today, 'count': 0, 'mastered_words': []}
    if 'mastered_words' not in progress:
        progress['mastered_words'] = []
    progress['count'] = len(progress['mastered_words'])
    return progress


def save_progress(progress):
    progress['count'] = len(progress.get('mastered_words', []))
    progress['date'] = get_today()
    save_json_file('progress_store.json', progress)


def mark_word_mastered(word):
    if not word:
        raise ValueError('word is required')
    progress = load_progress()
    normalized = word.strip()
    if normalized not in progress['mastered_words']:
        progress['mastered_words'].append(normalized)
        save_progress(progress)
    return progress


def get_pet_state(progress=None, settings=None):
    if progress is None:
        progress = load_progress()
    if settings is None:
        settings = load_settings()

    target = max(1, int(settings.get('daily_target', 20) or 20))
    learned = progress.get('count', 0)
    completion = min(100, round((learned / target) * 100))
    level = max(1, 1 + learned // target)
    exp = completion if learned < target else 100

    if completion >= 100:
        mood = 'Proud'
    elif completion >= 50:
        mood = 'Focused'
    elif learned > 0:
        mood = 'Curious'
    else:
        mood = 'Ready'

    active_pet = PET_CATALOG[min(level - 1, len(PET_CATALOG) - 1)]
    return {
        'name': active_pet['name'],
        'emoji': active_pet['emoji'],
        'level': level,
        'exp': exp,
        'max_exp': 100,
        'mood': mood,
        'completion': completion,
        'learned_today': learned,
        'daily_target': target,
    }


def get_pet_collection(progress=None, settings=None):
    pet = get_pet_state(progress, settings)
    completion = pet['completion']
    return [
        {
            'name': item['name'],
            'emoji': item['emoji'],
            'unlocked': completion >= item['unlock_at'],
            'unlock_at': item['unlock_at'],
        }
        for item in PET_CATALOG
    ]


def get_pet_pokemon_id(pet_type):
    mapping = {
        'cat': 52,
        'dog': 58,
        'dragon': 147,
    }
    normalized = (pet_type or 'cat').strip().lower()
    return mapping.get(normalized, 52)


def get_random_pokemon_id(conn=None):
    return random.randint(1, CUSTOM_PET_TOTAL)


def _pokemon_to_cache_record(pokemon):
    sprites = pokemon.get('sprites') or {}
    other = sprites.get('other') or {}
    artwork = other.get('official-artwork') or {}
    pokemon_id = pokemon.get('id')
    fallback_image_url, fallback_sprite_url = get_pokemon_fallback_image_urls(pokemon_id)
    types = pokemon.get('types') or []
    type1 = types[0].get('name') if len(types) > 0 and isinstance(types[0], dict) else None
    type2 = types[1].get('name') if len(types) > 1 and isinstance(types[1], dict) else None
    cached_name = pokemon.get('name_jp') or pokemon.get('name')
    return {
        'pokemon_id': pokemon_id,
        'name': cached_name,
        'image_url': artwork.get('front_default') or fallback_image_url,
        'sprite_url': sprites.get('front_default') or fallback_sprite_url,
        'type1': type1,
        'type2': type2,
        'generation': pokemon.get('generation'),
        'pokemon_name': cached_name,
        'types': json.dumps(types, ensure_ascii=False),
    }


def get_pokemon_fallback_image_urls(pokemon_id):
    pet = get_custom_pet_by_id(pokemon_id)
    image_url = pet.get('image_url') if pet else None
    return image_url, image_url


def get_pokemon_fallback_name(pokemon_id):
    pet = get_custom_pet_by_id(pokemon_id)
    return pet.get('nameJa') if pet else None


def _row_to_pokemon_record(row):
    if not row:
        return None

    try:
        types = json.loads(_row_value(row, 'types')) if _row_value(row, 'types') else []
    except (TypeError, json.JSONDecodeError):
        types = []

    fallback_image_url, fallback_sprite_url = get_pokemon_fallback_image_urls(_row_value(row, 'pokemon_id'))
    fallback_name = get_pokemon_fallback_name(_row_value(row, 'pokemon_id'))
    display_name = _row_value(row, 'name') or _row_value(row, 'pokemon_name')
    if not _is_japanese_text(display_name):
        display_name = fallback_name or 'ポケモン'
    type1 = _row_value(row, 'type1')
    type2 = _row_value(row, 'type2')
    if not type1 or not type2:
        if types:
            if not type1 and len(types) > 0 and isinstance(types[0], dict):
                type1 = types[0].get('name')
            if not type2 and len(types) > 1 and isinstance(types[1], dict):
                type2 = types[1].get('name')
    return {
        'id': _row_value(row, 'pokemon_id'),
        'name': display_name,
        'name_jp': display_name,
        'sprites': {
            'front_default': _row_value(row, 'sprite_url') or fallback_sprite_url,
            'other': {
                'official-artwork': {
                    'front_default': _row_value(row, 'image_url') or fallback_image_url,
                }
            },
        },
        'type1': type1,
        'type2': type2,
        'generation': _row_value(row, 'generation'),
        'types': types,
    }


def _child_collection_row_to_state(row, pokemon=None, pokemon_error=None, collection_count=None):
    if not row:
        return None

    pokemon_id = int(row['pokemon_id'])
    pokemon = pokemon or get_custom_pet_by_id(pokemon_id)
    pokemon_error = pokemon_error or None
    pet_type = (pokemon or {}).get('element') or get_pokemon_primary_type(pokemon)
    pet_emoji = 'PET'
    max_level = int(row['max_level'] or 10)
    level = int(row['level'] or 1)
    max_exp = get_pet_exp_required(level)
    if level >= max_level:
      max_exp = get_pet_exp_required(level)

    progress_percent = None
    if collection_count is not None:
        progress_percent = round((collection_count / max(1, CUSTOM_PET_TOTAL)) * 100, 1)

    state = {
        'child_id': row['child_id'],
        'child_name': row['child_name'],
        'name': _row_value(row, 'nickname') or _row_value(row, 'pet_name'),
        'nickname': _row_value(row, 'nickname') or _row_value(row, 'pet_name'),
        'emoji': pet_emoji,
        'pet_type': pet_type,
        'pokemon_id': pokemon_id,
        'pokemon': pokemon,
        'pokemon_error': pokemon_error,
        'pet_id': (pokemon or {}).get('id'),
        'nameJa': (pokemon or {}).get('nameJa'),
        'image_url': (pokemon or {}).get('image_url'),
        'sprite_url': (pokemon or {}).get('sprite_url'),
        'level': level,
        'exp': int(row['exp'] or 0),
        'total_exp': int(row['total_exp'] or 0),
        'max_exp': max_exp,
        'max_level': max_level,
        'is_active': int(row['is_active'] or 0),
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }
    if collection_count is not None:
        state['collection_owned'] = int(collection_count)
        state['collection_total'] = CUSTOM_PET_TOTAL
        state['collection_progress'] = progress_percent
    return state


def get_pokemon_primary_type(pokemon):
    if not pokemon:
        return 'normal'
    types = pokemon.get('types') or []
    if not types:
        return 'normal'
    primary = types[0] or {}
    name = primary.get('name')
    return (name or 'normal').strip().lower() or 'normal'


def get_cached_pokemon_by_id(pokemon_id):
    try:
        normalized_id = int(pokemon_id)
    except (TypeError, ValueError):
        raise PokeApiError('pokemon_id must be an integer')

    if normalized_id <= 0:
        raise PokeApiError('pokemon_id must be positive')

    pet = get_custom_pet_by_id(normalized_id)
    if pet:
        return pet
    raise PokeApiError('pet not found')

    conn = get_db_connection()
    try:
        cached_row = conn.execute(
            '''
            SELECT
                id, pokemon_id, name, image_url, sprite_url, type1, type2, generation, cached_at,
                pokemon_name, types, created_at, updated_at
            FROM pokemon_catalog
            WHERE pokemon_id = ?
            ''',
            (normalized_id,),
        ).fetchone()
        cached_name = _row_value(cached_row, 'name') or _row_value(cached_row, 'pokemon_name')
        cached_has_payload = bool(cached_row and cached_name and (_row_value(cached_row, 'type1') or _row_value(cached_row, 'types')))
        cached_has_japanese_name = bool(cached_row and _looks_like_pokemon_japanese_name(cached_name))
        cached_has_visual = bool(cached_row and (_row_value(cached_row, 'image_url') or _row_value(cached_row, 'sprite_url')))
        if cached_has_payload and cached_has_visual and cached_has_japanese_name:
            return _row_to_pokemon_record(cached_row)
        if not cached_row:
            conn.execute(
                'INSERT OR IGNORE INTO pokemon_catalog (pokemon_id, name, image_url, sprite_url, type1, type2, generation, cached_at, pokemon_name, types) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)',
                (normalized_id, '', None, None, None, None, None, '', ''),
            )
    finally:
        conn.close()

    try:
        pokemon = {}
        cache_record = _pokemon_to_cache_record(pokemon)
    except PokeApiError:
        if cached_has_payload:
            return _row_to_pokemon_record(cached_row)
        raise
    except Exception:
        if cached_has_payload:
            return _row_to_pokemon_record(cached_row)
        raise

    if cached_row and cached_has_payload and not cached_has_visual:
        cache_record['name'] = cache_record['name'] or cached_name
        cache_record['pokemon_name'] = cache_record['pokemon_name'] or cached_name
        cache_record['image_url'] = cache_record['image_url'] or _row_value(cached_row, 'image_url')
        cache_record['sprite_url'] = cache_record['sprite_url'] or _row_value(cached_row, 'sprite_url')
        cache_record['types'] = cache_record['types'] or _row_value(cached_row, 'types')
        cache_record['type1'] = cache_record['type1'] or _row_value(cached_row, 'type1')
        cache_record['type2'] = cache_record['type2'] or _row_value(cached_row, 'type2')
    if not _is_japanese_text(cache_record.get('name')):
        cache_record['name'] = get_pokemon_fallback_name(normalized_id) or 'ポケモン'
        cache_record['pokemon_name'] = cache_record['name']

    if not cache_record.get('types') and (cache_record.get('type1') or cache_record.get('type2')):
        cache_record['types'] = json.dumps(
            [
                {'slot': 1, 'name': cache_record.get('type1')},
                {'slot': 2, 'name': cache_record.get('type2')},
            ],
            ensure_ascii=False,
        )

    conn = get_db_connection()
    try:
        conn.execute(
            '''
            INSERT INTO pokemon_catalog (
                pokemon_id, name, image_url, sprite_url, type1, type2, generation, cached_at, pokemon_name, types, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(pokemon_id) DO UPDATE SET
                name = excluded.name,
                image_url = excluded.image_url,
                sprite_url = excluded.sprite_url,
                type1 = excluded.type1,
                type2 = excluded.type2,
                generation = excluded.generation,
                cached_at = excluded.cached_at,
                pokemon_name = excluded.pokemon_name,
                types = excluded.types,
                updated_at = excluded.updated_at
            ''',
            (
                cache_record['pokemon_id'],
                cache_record['name'],
                cache_record['image_url'],
                cache_record['sprite_url'],
                cache_record.get('type1'),
                cache_record.get('type2'),
                cache_record.get('generation'),
                cache_record['name'],
                cache_record['types'],
            ),
        )
        conn.commit()
        cached_row = conn.execute(
            '''
            SELECT
                id, pokemon_id, name, image_url, sprite_url, type1, type2, generation, cached_at,
                pokemon_name, types, created_at, updated_at
            FROM pokemon_catalog
            WHERE pokemon_id = ?
            ''',
            (normalized_id,),
        ).fetchone()
        return _row_to_pokemon_record(cached_row)
    finally:
        conn.close()


def get_child_pet_state(child_id):
    if child_id is None:
        return None

    conn = get_db_connection()
    try:
        row = conn.execute(
            '''
            SELECT
                p.child_id,
                p.pokemon_id,
                p.nickname,
                p.pet_name,
                p.level,
                p.exp,
                p.total_exp,
                p.max_level,
                p.is_active,
                p.created_at,
                p.updated_at,
                c.name AS child_name
            FROM child_pokemon_collection AS p
            JOIN children AS c ON c.id = p.child_id
            WHERE p.child_id = ? AND p.is_active = 1
            ORDER BY p.id ASC
            LIMIT 1
            ''',
            (child_id,),
        ).fetchone()
        if not row:
            row = conn.execute(
                '''
                SELECT
                    p.child_id,
                    p.pokemon_id,
                    p.nickname,
                    p.pet_name,
                    p.level,
                    p.exp,
                    p.total_exp,
                    p.max_level,
                    p.is_active,
                    p.created_at,
                    p.updated_at,
                    c.name AS child_name
                FROM child_pokemon_collection AS p
                JOIN children AS c ON c.id = p.child_id
                WHERE p.child_id = ?
                ORDER BY p.is_active DESC, p.id ASC
                LIMIT 1
                ''',
                (child_id,),
            ).fetchone()
    finally:
        conn.close()

    if not row:
        return None

    pokemon_id = int(row['pokemon_id'])
    pokemon = get_custom_pet_by_id(pokemon_id)
    pokemon_error = None
    collection_count = None
    conn = get_db_connection()
    try:
        collection_count = conn.execute(
            'SELECT COUNT(*) AS count FROM child_pokemon_collection WHERE child_id = ? AND pokemon_id BETWEEN 1 AND ?',
            (child_id, CUSTOM_PET_TOTAL),
        ).fetchone()
    finally:
        conn.close()
    return _child_collection_row_to_state(
        row,
        pokemon=pokemon,
        pokemon_error=pokemon_error,
        collection_count=collection_count['count'] if collection_count else None,
    )


def get_child_pokedex_collection(child_id=None):
    def clean_pokemon_name(row, pokemon_id):
        custom_pet = get_custom_pet_by_id(pokemon_id)
        fallback_name = custom_pet.get('nameJa') if custom_pet else None
        raw_name = _row_value(row, 'catalog_name') or _row_value(row, 'pokemon_name')
        if _is_japanese_text(raw_name):
            return raw_name
        if isinstance(raw_name, str) and re.fullmatch(r"[A-Za-z0-9 .'-]+", raw_name.strip()):
            return raw_name.strip()
        return fallback_name or 'ペット'

    def exp_to_master(level, exp, max_level):
        level = int(level or 1)
        exp = int(exp or 0)
        max_level = int(max_level or 10)
        if level >= max_level:
            return 0

        remaining = max(0, get_pet_exp_required(level) - exp)
        for next_level in range(level + 1, max_level):
            remaining += get_pet_exp_required(next_level)
        return remaining

    conn = get_db_connection()
    try:
        child_row = None
        if child_id is not None:
            child_row = conn.execute('SELECT id, name, daily_target FROM children WHERE id = ?', (child_id,)).fetchone()
        if not child_row:
            child_row = conn.execute('SELECT id, name, daily_target FROM children ORDER BY id ASC LIMIT 1').fetchone()
        if not child_row:
            return {'child': None, 'pets': [], 'reward_status': None}

        resolved_child_id = int(child_row['id'])
        today = get_today()
        daily_target = int(child_row['daily_target'] or 20)
        daily_row = conn.execute(
            'SELECT studied_count FROM daily_study_log WHERE child_id = ? AND study_date = ?',
            (resolved_child_id, today),
        ).fetchone()
        studied_count = int(daily_row['studied_count'] or 0) if daily_row else 0
        rows = conn.execute(
            '''
            SELECT
                c.pokemon_id,
                c.nickname,
                c.pet_name,
                c.level,
                c.exp,
                c.total_exp,
                c.max_level,
                c.is_active,
                c.unlocked_at,
                p.name AS catalog_name,
                p.pokemon_name,
                p.image_url,
                p.sprite_url
            FROM child_pokemon_collection AS c
            LEFT JOIN pokemon_catalog AS p ON p.pokemon_id = c.pokemon_id
            WHERE c.child_id = ? AND c.pokemon_id BETWEEN 1 AND ?
            ORDER BY c.pokemon_id ASC
            ''',
            (resolved_child_id, CUSTOM_PET_TOTAL),
        ).fetchall()

        owned_by_id = {int(row['pokemon_id']): row for row in rows}
        current_row = None
        for row in rows:
            if int(row['is_active'] or 0) and int(row['level'] or 1) < int(row['max_level'] or 10):
                current_row = row
                break
        if current_row is None:
            for row in rows:
                if int(row['level'] or 1) < int(row['max_level'] or 10):
                    current_row = row
                    break
        if current_row is None and rows:
            current_row = rows[0]

        next_unlock_exp = exp_to_master(
            current_row['level'],
            current_row['exp'],
            current_row['max_level'],
        ) if current_row else None
        pets = []
        for pokemon_id in range(1, CUSTOM_PET_TOTAL + 1):
            custom_pet = get_custom_pet_by_id(pokemon_id)
            row = owned_by_id.get(pokemon_id)
            if not row:
                pets.append({
                    'pokemon_id': pokemon_id,
                    'pet_id': custom_pet.get('id') if custom_pet else None,
                    'unlocked': False,
                    'name': '???',
                    'level': None,
                    'image_url': None,
                    'sprite_url': None,
                    'is_active': False,
                    'is_master': False,
                    'status': 'locked',
                    'unlock_exp_remaining': next_unlock_exp,
                })
                continue

            level = int(row['level'] or 1)
            max_level = int(row['max_level'] or 10)
            exp = int(row['exp'] or 0)
            max_exp = get_pet_exp_required(level)
            is_master = level >= max_level
            status = 'master' if is_master else 'ready' if exp >= max_exp else 'growing'
            display_name = clean_pokemon_name(row, pokemon_id)
            pets.append({
                'pokemon_id': pokemon_id,
                'pet_id': custom_pet.get('id') if custom_pet else None,
                'unlocked': True,
                'name': display_name,
                'nickname': _row_value(row, 'nickname') or _row_value(row, 'pet_name') or display_name,
                'level': level,
                'exp': exp,
                'total_exp': int(row['total_exp'] or 0),
                'max_exp': max_exp,
                'max_level': max_level,
                'exp_progress': 100 if is_master else min(100, round((exp / max(1, max_exp)) * 100)),
                'image_url': (custom_pet or {}).get('image_url') or _row_value(row, 'image_url'),
                'sprite_url': (custom_pet or {}).get('sprite_url') or _row_value(row, 'sprite_url'),
                'is_active': bool(int(row['is_active'] or 0)),
                'is_current': current_row is not None and int(current_row['pokemon_id']) == pokemon_id,
                'is_master': is_master,
                'status': status,
                'exp_to_master': exp_to_master(level, exp, max_level),
                'unlocked_at': row['unlocked_at'],
            })

        current_pet = next((pet for pet in pets if pet.get('is_current')), None)
        return {
            'child': {'id': resolved_child_id, 'name': child_row['name']},
            'owned_count': len(rows),
            'total_count': CUSTOM_PET_TOTAL,
            'current_pet': current_pet,
            'reward_status': {
                'today_progress': studied_count,
                'today_target': daily_target,
                'today_progress_percent': min(100, round((studied_count / max(1, daily_target)) * 100)),
                'next_unlock_exp': next_unlock_exp,
                'has_locked_pokemon': len(rows) < CUSTOM_PET_TOTAL,
            },
            'pets': pets,
        }
    finally:
        conn.close()


def get_pet_exp_required(level):
    level = max(1, int(level or 1))
    return 100 + (level - 1) * 50


def ensure_child_pokemon_collection(conn, child_id):
    child_row = conn.execute('SELECT id, name FROM children WHERE id = ?', (child_id,)).fetchone()
    if not child_row:
        raise ValueError('child not found')

    row = conn.execute(
        '''
        SELECT
            id, child_id, pokemon_id, nickname, pet_name, level, exp, total_exp, max_level, is_active, unlocked_at, created_at, updated_at
        FROM child_pokemon_collection
        WHERE child_id = ? AND pokemon_id BETWEEN 1 AND ?
        ORDER BY is_active DESC, id ASC
        LIMIT 1
        ''',
        (child_id, CUSTOM_PET_TOTAL),
    ).fetchone()
    if row:
        active_row = conn.execute(
            '''
            SELECT id
            FROM child_pokemon_collection
            WHERE child_id = ? AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
            ''',
            (child_id,),
        ).fetchone()
        if not active_row:
            conn.execute(
                '''
                UPDATE child_pokemon_collection
                SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE child_id = ?
                ''',
                (row['id'], child_id),
            )
        return row

    pokemon_id = get_random_pokemon_id(conn)
    conn.execute(
        '''
        INSERT INTO child_pokemon_collection (
            child_id, pokemon_id, nickname, pet_name, level, exp, total_exp, max_level, is_active, unlocked_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''',
        (child_id, pokemon_id, child_row['name'] if child_row else 'ポケモン', child_row['name'] if child_row else 'ポケモン', 1, 0, 0, 10, 1),
    )
    return conn.execute(
        '''
        SELECT
            id, child_id, pokemon_id, nickname, pet_name, level, exp, total_exp, max_level, is_active, unlocked_at, created_at, updated_at
        FROM child_pokemon_collection
        WHERE child_id = ?
        ORDER BY id DESC
        LIMIT 1
        ''',
        (child_id,),
    ).fetchone()


def unlockRandomPet(childId):
    if childId is None:
        raise ValueError('childId is required')

    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id, name FROM children WHERE id = ?', (childId,)).fetchone()
        if not child_row:
            raise ValueError('child not found')

        owned_ids = {
            int(row[0])
            for row in conn.execute(
                'SELECT pokemon_id FROM child_pokemon_collection WHERE child_id = ? AND pokemon_id BETWEEN 1 AND ?',
                (childId, CUSTOM_PET_TOTAL),
            ).fetchall()
        }
        available_ids = [pokemon_id for pokemon_id in range(1, CUSTOM_PET_TOTAL + 1) if pokemon_id not in owned_ids]
        if not available_ids:
            return None

        pokemon_id = random.choice(available_ids)
        pokemon = get_custom_pet_by_id(pokemon_id)

        pet_name = pokemon.get('nameJa') if pokemon else 'ペット'
        conn.execute(
            '''
            INSERT INTO child_pokemon_collection (
                child_id, pokemon_id, nickname, pet_name, level, exp, total_exp, max_level, is_active, unlocked_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ''',
            (childId, pokemon_id, pet_name, pet_name, 1, 0, 0, 10, 0),
        )
        conn.commit()
        row = conn.execute(
            '''
            SELECT
                p.id,
                p.child_id,
                p.pokemon_id,
                p.nickname,
                p.pet_name,
                p.level,
                p.exp,
                p.total_exp,
                p.max_level,
                p.is_active,
                p.unlocked_at,
                p.created_at,
                p.updated_at,
                c.name AS child_name
            FROM child_pokemon_collection AS p
            JOIN children AS c ON c.id = p.child_id
            WHERE p.child_id = ? AND p.pokemon_id = ?
            ''',
            (childId, pokemon_id),
        ).fetchone()
        collection_count = conn.execute(
            'SELECT COUNT(*) AS count FROM child_pokemon_collection WHERE child_id = ? AND pokemon_id BETWEEN 1 AND ?',
            (childId, CUSTOM_PET_TOTAL),
        ).fetchone()
        return _child_collection_row_to_state(
            row,
            pokemon=pokemon,
            collection_count=collection_count['count'] if collection_count else None,
        )
    finally:
        conn.close()


def setActivePet(childId, pokemonId):
    if childId is None or pokemonId is None:
        raise ValueError('childId and pokemonId are required')
    try:
        pokemon_id = int(pokemonId)
    except (TypeError, ValueError):
        raise ValueError('pokemonId must be an integer')

    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id FROM children WHERE id = ?', (childId,)).fetchone()
        if not child_row:
            raise ValueError('child not found')

        row = conn.execute(
            'SELECT id FROM child_pokemon_collection WHERE child_id = ? AND pokemon_id = ?',
            (childId, pokemon_id),
        ).fetchone()
        if not row:
            raise ValueError('pokemon not owned by child')

        conn.execute(
            '''
            UPDATE child_pokemon_collection
            SET is_active = CASE WHEN pokemon_id = ? THEN 1 ELSE 0 END,
                updated_at = CURRENT_TIMESTAMP
            WHERE child_id = ?
            ''',
            (pokemon_id, childId),
        )
        conn.commit()
        return get_child_pet_state(childId)
    finally:
        conn.close()


def addPetExp(childId, expAmount):
    if childId is None:
        raise ValueError('childId is required')
    try:
        exp_amount = int(expAmount)
    except (TypeError, ValueError):
        raise ValueError('expAmount must be an integer')
    if exp_amount < 0:
        raise ValueError('expAmount must be non-negative')

    conn = get_db_connection()
    try:
        row = ensure_child_pokemon_collection(conn, childId)
        previous_level = int(row['level'] or 1)
        max_level = int(row['max_level'] or 10)
        level = previous_level
        exp = int(row['exp'] or 0) + exp_amount
        total_exp = int(row['total_exp'] or 0) + exp_amount
        leveled_to_max = False

        while level < max_level and exp >= get_pet_exp_required(level):
            exp -= get_pet_exp_required(level)
            level += 1
            if level >= max_level:
                leveled_to_max = previous_level < max_level
                break

        if level >= max_level:
            level = max_level
            exp = get_pet_exp_required(max_level)

        conn.execute(
            '''
            UPDATE child_pokemon_collection
            SET level = ?, exp = ?, total_exp = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''',
            (level, exp, total_exp, row['id']),
        )
        conn.commit()

        if leveled_to_max:
            try:
                unlockRandomPet(childId)
            except Exception:
                pass

        updated = conn.execute(
            '''
            SELECT
                p.id,
                p.child_id,
                p.pokemon_id,
                p.pet_name,
                p.level,
                p.exp,
                p.total_exp,
                p.max_level,
                p.is_active,
                p.created_at,
                p.updated_at,
                c.name AS child_name
            FROM child_pokemon_collection AS p
            JOIN children AS c ON c.id = p.child_id
            WHERE p.id = ?
            ''',
            (row['id'],),
        ).fetchone()
        collection_count = conn.execute(
            'SELECT COUNT(*) AS count FROM child_pokemon_collection WHERE child_id = ?',
            (childId,),
        ).fetchone()
        return _child_collection_row_to_state(
            updated,
            collection_count=collection_count['count'] if collection_count else None,
        )
    finally:
        conn.close()


def get_db_path():
    return data_path(DB_FILENAME)


def get_db_connection():
    if use_postgres():
        if psycopg2 is None:
            raise RuntimeError('DATABASE_URL is set, but psycopg2-binary is not installed.')
        conn = psycopg2.connect(get_database_url(), cursor_factory=DictCursor)
        return PostgresConnection(conn)

    ensure_parent_dir(get_db_path())
    conn = sqlite3.connect(get_db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def get_eiken_pre2_bank_path():
    return data_path(EIKEN_PRE2_BANK_FILENAME)


def get_eiken_pre2_bank_connection():
    bank_path = get_eiken_pre2_bank_path()
    if not os.path.exists(bank_path):
        raise FileNotFoundError(f'EIKEN Pre-2 question bank not found: {bank_path}')

    conn = sqlite3.connect(bank_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    ensure_eiken_pre2_bank_runtime_columns(conn)
    return conn


def ensure_eiken_pre2_bank_runtime_columns(conn):
    def add_column_if_missing(table, column, definition):
        columns = {row[1] for row in conn.execute(f'PRAGMA table_info({table})').fetchall()}
        if column not in columns:
            conn.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')

    add_column_if_missing('attempts', 'mode', "TEXT NOT NULL DEFAULT 'standard'")
    add_column_if_missing('attempts', 'status', "TEXT NOT NULL DEFAULT 'completed'")
    add_column_if_missing('student_answers', 'time_spent_seconds', 'INTEGER')
    add_column_if_missing('student_answers', 'timed_out', 'INTEGER NOT NULL DEFAULT 0')
    conn.commit()


def init_db(force=False):
    global _DB_INITIALIZED
    if _DB_INITIALIZED and not force:
        return

    started_at = time.perf_counter()
    conn = get_db_connection()
    try:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS vocabulary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT,
                meaning TEXT,
                level TEXT,
                example TEXT,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS error_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word_id INTEGER,
                message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                phone TEXT,
                provider TEXT NOT NULL DEFAULT 'email',
                display_name TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (email)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS auth_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                session_token TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (session_token),
                FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS family_login_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                family_code TEXT UNIQUE NOT NULL,
                label TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS children (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                name TEXT NOT NULL,
                avatar TEXT,
                learning_goal TEXT,
                grade TEXT NOT NULL,
                target_level TEXT NOT NULL,
                daily_target INTEGER NOT NULL DEFAULT 20,
                daily_word_target INTEGER NOT NULL DEFAULT 20,
                study_mode TEXT NOT NULL DEFAULT 'normal',
                starter_pokemon_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE CASCADE ON DELETE SET NULL,
                FOREIGN KEY (starter_pokemon_id) REFERENCES pokemon_catalog (pokemon_id) ON UPDATE CASCADE ON DELETE SET NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_pets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                pokemon_id INTEGER NOT NULL,
                pet_name TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 1,
                exp INTEGER NOT NULL DEFAULT 0,
                total_exp INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (pokemon_id) REFERENCES pets_catalog (pokemon_id) ON UPDATE CASCADE ON DELETE RESTRICT,
                UNIQUE (child_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS pets_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_id INTEGER NOT NULL,
                pokemon_name TEXT,
                image_url TEXT,
                sprite_url TEXT,
                types TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (pokemon_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS pokemon_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pokemon_id INTEGER NOT NULL,
                name TEXT,
                image_url TEXT,
                sprite_url TEXT,
                type1 TEXT,
                type2 TEXT,
                generation TEXT,
                cached_at TEXT,
                pokemon_name TEXT,
                types TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (pokemon_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_pokemon_collection (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                pokemon_id INTEGER NOT NULL,
                nickname TEXT,
                level INTEGER NOT NULL DEFAULT 1,
                exp INTEGER NOT NULL DEFAULT 0,
                total_exp INTEGER NOT NULL DEFAULT 0,
                max_level INTEGER NOT NULL DEFAULT 10,
                is_active INTEGER NOT NULL DEFAULT 0,
                unlocked_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                pet_name TEXT,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (pokemon_id) REFERENCES pokemon_catalog (pokemon_id) ON UPDATE CASCADE ON DELETE RESTRICT,
                UNIQUE (child_id, pokemon_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_vocab_progress (
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
                correct_streak INTEGER NOT NULL DEFAULT 0,
                mastery INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'new',
                mastered_at TEXT,
                last_reviewed_at TEXT,
                is_parent_marked_mastered INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (child_id, vocab_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_vocab_wrong_reviews (
                child_id INTEGER NOT NULL,
                vocab_id INTEGER NOT NULL,
                world_id TEXT,
                stage_number INTEGER,
                question_type TEXT,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                last_wrong_at TEXT,
                review_count INTEGER NOT NULL DEFAULT 0,
                last_reviewed_at TEXT,
                review_status TEXT NOT NULL DEFAULT 'pending',
                mastered_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (child_id, vocab_id),
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS ai_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER,
                vocab_id INTEGER,
                question_type TEXT NOT NULL,
                prompt TEXT NOT NULL,
                choices_json TEXT NOT NULL DEFAULT '[]',
                correct_answer TEXT NOT NULL,
                explanation TEXT,
                source TEXT NOT NULL DEFAULT 'rule',
                difficulty TEXT NOT NULL DEFAULT 'normal',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE SET NULL,
                FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE SET NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS ai_wrong_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                vocab_id INTEGER,
                question_id INTEGER,
                selected_answer TEXT,
                correct_answer TEXT NOT NULL,
                error_count INTEGER NOT NULL DEFAULT 1,
                last_error_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE SET NULL,
                FOREIGN KEY (question_id) REFERENCES ai_questions (id) ON UPDATE CASCADE ON DELETE SET NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS ai_study_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                vocab_id INTEGER,
                question_id INTEGER,
                question_type TEXT NOT NULL,
                selected_answer TEXT,
                correct_answer TEXT NOT NULL,
                is_correct INTEGER NOT NULL,
                xp_awarded INTEGER NOT NULL DEFAULT 0,
                combo INTEGER NOT NULL DEFAULT 0,
                mastery_after INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE SET NULL,
                FOREIGN KEY (question_id) REFERENCES ai_questions (id) ON UPDATE CASCADE ON DELETE SET NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS daily_study_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                study_date TEXT NOT NULL,
                studied_count INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                study_minutes INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (child_id, study_date)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS grammar_questions (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                category TEXT NOT NULL,
                question_text TEXT NOT NULL,
                choices_json TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                explanation TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS wild_monsters (
                id TEXT PRIMARY KEY,
                name_ja TEXT NOT NULL,
                image_url TEXT,
                grammar_category TEXT NOT NULL,
                max_hp INTEGER NOT NULL DEFAULT 100,
                rarity TEXT NOT NULL DEFAULT 'normal',
                capture_base_rate REAL NOT NULL DEFAULT 0.7,
                grammar_tip TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS user_monsters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                monster_id TEXT NOT NULL,
                captured_at TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 1,
                exp INTEGER NOT NULL DEFAULT 0,
                source_category TEXT,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (monster_id) REFERENCES wild_monsters (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (child_id, monster_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS battle_sessions (
                id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL,
                monster_id TEXT NOT NULL,
                questions_json TEXT NOT NULL,
                current_question_index INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                monster_hp INTEGER NOT NULL DEFAULT 100,
                max_hp INTEGER NOT NULL DEFAULT 100,
                status TEXT NOT NULL DEFAULT 'in_progress',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (monster_id) REFERENCES wild_monsters (id) ON UPDATE CASCADE ON DELETE RESTRICT
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS battle_answer_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id TEXT NOT NULL,
                selected_answer TEXT,
                is_correct INTEGER NOT NULL,
                answered_at TEXT NOT NULL,
                battle_session_id TEXT NOT NULL,
                FOREIGN KEY (question_id) REFERENCES grammar_questions (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (battle_session_id) REFERENCES battle_sessions (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (battle_session_id, question_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS grammar_wrong_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                question_id TEXT NOT NULL,
                category TEXT NOT NULL,
                wrong_at TEXT NOT NULL,
                mastered INTEGER NOT NULL DEFAULT 0,
                mastered_at TEXT,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES grammar_questions (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_grammar_progress (
                child_id INTEGER NOT NULL,
                lesson_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'not_started',
                view_count INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                last_score INTEGER NOT NULL DEFAULT 0,
                mastered_at TEXT,
                last_studied_at TEXT,
                next_review_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (child_id, lesson_id),
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_world_stage_progress (
                child_id INTEGER NOT NULL,
                world_id TEXT NOT NULL,
                stage_number INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'in_progress',
                cleared_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (child_id, world_id, stage_number),
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_stage_quiz_attempts (
                attempt_id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL,
                world_id TEXT NOT NULL,
                stage_number INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                passed INTEGER NOT NULL DEFAULT 0,
                answers_json TEXT NOT NULL DEFAULT '[]',
                submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_heroes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                hero_id INTEGER NOT NULL,
                hero_code TEXT NOT NULL,
                awarded_world_id TEXT,
                awarded_stage_number INTEGER,
                reward_type TEXT NOT NULL DEFAULT 'stage',
                awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (child_id, hero_id),
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (hero_id) REFERENCES heroes (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE INDEX IF NOT EXISTS idx_child_stage_quiz_attempts_child_stage
            ON child_stage_quiz_attempts (child_id, world_id, stage_number, submitted_at)
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_grammar_quiz_attempts (
                attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                lesson_id TEXT NOT NULL,
                quiz_id TEXT NOT NULL,
                selected_index INTEGER NOT NULL,
                is_correct INTEGER NOT NULL,
                attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_grammar_form_test_progress (
                child_id INTEGER NOT NULL,
                test_id TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                correct_count INTEGER NOT NULL DEFAULT 0,
                wrong_count INTEGER NOT NULL DEFAULT 0,
                last_selected_index INTEGER,
                last_is_correct INTEGER,
                last_attempted_at TEXT,
                mastered INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (child_id, test_id),
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS child_grammar_form_test_attempts (
                attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                test_id TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                selected_index INTEGER NOT NULL,
                is_correct INTEGER NOT NULL,
                attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS eiken_pre2_attempts (
                attempt_id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL,
                set_id TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                score_percent REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS eiken_pre2_student_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id TEXT NOT NULL,
                child_id INTEGER NOT NULL,
                set_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                question_type TEXT NOT NULL,
                student_answer TEXT,
                correct_option TEXT NOT NULL,
                is_correct INTEGER NOT NULL,
                answered_at TEXT NOT NULL,
                FOREIGN KEY (attempt_id) REFERENCES eiken_pre2_attempts (attempt_id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (attempt_id, question_id)
            )
            '''
        )
        conn.execute(
            '''
            CREATE INDEX IF NOT EXISTS idx_eiken_pre2_answers_child_wrong
            ON eiken_pre2_student_answers (child_id, is_correct, answered_at)
            '''
        )
        conn.execute(
            '''
            CREATE INDEX IF NOT EXISTS idx_eiken_pre2_answers_question
            ON eiken_pre2_student_answers (question_id, child_id, answered_at)
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS eiken_real_exam_attempts (
                attempt_id TEXT PRIMARY KEY,
                child_id INTEGER NOT NULL,
                part_id TEXT NOT NULL,
                exam_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                started_at TEXT,
                submitted_at TEXT NOT NULL,
                total_questions INTEGER NOT NULL,
                answered_count INTEGER NOT NULL,
                correct_count INTEGER,
                score_percent REAL,
                answer_key_available INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS eiken_real_exam_student_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id TEXT NOT NULL,
                child_id INTEGER NOT NULL,
                part_id TEXT NOT NULL,
                question_number INTEGER NOT NULL,
                student_answer TEXT,
                correct_answer TEXT,
                is_correct INTEGER,
                answered_at TEXT NOT NULL,
                FOREIGN KEY (attempt_id) REFERENCES eiken_real_exam_attempts (attempt_id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (attempt_id, question_number)
            )
            '''
        )
        conn.execute(
            '''
            CREATE INDEX IF NOT EXISTS idx_eiken_real_answers_child_wrong
            ON eiken_real_exam_student_answers (child_id, is_correct, answered_at)
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_children_updated_at
            AFTER UPDATE ON children
            FOR EACH ROW
            BEGIN
                UPDATE children SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        conn.execute('DROP TRIGGER IF EXISTS trg_children_create_default_pet')
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_children_create_default_pet
            AFTER INSERT ON children
            FOR EACH ROW
            BEGIN
                INSERT OR IGNORE INTO child_pokemon_collection (
                    child_id, pokemon_id, pet_name, level, exp, total_exp, max_level, is_active, created_at, updated_at
                ) VALUES (
                    NEW.id,
                    COALESCE(NEW.starter_pokemon_id, (SELECT pokemon_id FROM pokemon_catalog WHERE pokemon_id BETWEEN 1 AND 151 ORDER BY RANDOM() LIMIT 1)),
                    NEW.name,
                    1,
                    0,
                    0,
                    10,
                    1,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                );
            END
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_child_pets_updated_at
            AFTER UPDATE ON child_pets
            FOR EACH ROW
            BEGIN
                UPDATE child_pets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_child_pokemon_collection_updated_at
            AFTER UPDATE ON child_pokemon_collection
            FOR EACH ROW
            BEGIN
                UPDATE child_pokemon_collection SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        conn.execute(
            '''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_child_pokemon_collection_active
            ON child_pokemon_collection (child_id)
            WHERE is_active = 1
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_pets_catalog_updated_at
            AFTER UPDATE ON pets_catalog
            FOR EACH ROW
            BEGIN
                UPDATE pets_catalog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_pokemon_catalog_updated_at
            AFTER UPDATE ON pokemon_catalog
            FOR EACH ROW
            BEGIN
                UPDATE pokemon_catalog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_daily_study_log_updated_at
            AFTER UPDATE ON daily_study_log
            FOR EACH ROW
            BEGIN
                UPDATE daily_study_log SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        conn.execute(
            '''
            CREATE TRIGGER IF NOT EXISTS trg_child_vocab_progress_updated_at
            AFTER UPDATE ON child_vocab_progress
            FOR EACH ROW
            BEGIN
                UPDATE child_vocab_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
            '''
        )
        migrate_error_log_schema(conn)
        migrate_pokemon_catalog(conn)
        migrate_child_pokemon_collection(conn)
        migrate_children_profile_fields(conn)
        if should_seed_demo_children():
            seed_demo_children(conn)
        seed_grammar_battle_data(conn)
        migrate_vocabulary_word_columns(conn)
        migrate_vocabulary_ids(conn)
        migrate_child_vocab_progress(conn)
        migrate_daily_study_log(conn)
        sync_postgres_sequences(conn)
        conn.commit()
        _DB_INITIALIZED = True
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        if elapsed_ms > 500:
            app.logger.info('init_db completed in %sms', elapsed_ms)
    finally:
        conn.close()


def seed_demo_children(conn):
    count_row = conn.execute('SELECT COUNT(*) AS count FROM children').fetchone()
    if count_row and count_row['count'] > 0:
        return

    conn.executemany(
        'INSERT INTO children (name, grade, target_level) VALUES (?, ?, ?)',
        [
            ('Haru', '4', 'A2'),
            ('Mio', '6', 'B1'),
        ],
    )


def should_seed_demo_children():
    value = os.environ.get('SEED_DEMO_CHILDREN', '')
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def seed_grammar_battle_data(conn):
    questions = [
        ('GQ_INF_001', 'eiken_pre2', 'infinitive', 'I decided (____) harder for the next test.', ['study', 'to study', 'studying', 'studied'], 'to study', 'decide to do で「〜することに決める」という意味です。decide の後ろは to 不定詞を使います。'),
        ('GQ_INF_002', 'eiken_pre2', 'infinitive', 'It is important (____) English every day.', ['practice', 'to practice', 'practicing', 'practiced'], 'to practice', 'It is important to do は「〜することは大切だ」という形です。ここでは「毎日英語を練習すること」が大切です。'),
        ('GQ_INF_003', 'eiken_pre2', 'infinitive', 'Ken wants (____) a scientist in the future.', ['become', 'to become', 'becoming', 'became'], 'to become', 'want to do で「〜したい」という意味です。「科学者になりたい」なので to become が正解です。'),
        ('GQ_GER_001', 'eiken_pre2', 'gerund', 'My sister enjoys (____) pictures after school.', ['draw', 'to draw', 'drawing', 'drew'], 'drawing', 'enjoy の後ろは動名詞 ing 形を使います。enjoy drawing pictures で「絵を描くことを楽しむ」です。'),
        ('GQ_GER_002', 'eiken_pre2', 'gerund', 'He finished (____) his homework before dinner.', ['do', 'to do', 'doing', 'did'], 'doing', 'finish の後ろは ing 形です。finish doing homework で「宿題を終える」という意味になります。'),
        ('GQ_GER_003', 'eiken_pre2', 'gerund', 'Thank you for (____) me with the project.', ['help', 'to help', 'helping', 'helped'], 'helping', '前置詞 for の後ろは名詞か動名詞です。for helping me で「手伝ってくれて」という意味です。'),
        ('GQ_CMP_001', 'eiken_pre2', 'comparison', 'This book is (____) than that one.', ['interesting', 'more interesting', 'most interesting', 'the interesting'], 'more interesting', 'interesting は長い形容詞なので比較級は more interesting です。than があるので「〜より」という比較の文です。'),
        ('GQ_CMP_002', 'eiken_pre2', 'comparison', 'Mt. Fuji is the (____) mountain in Japan.', ['high', 'higher', 'highest', 'more high'], 'highest', 'the があり「日本で一番高い山」という意味なので最上級 highest を使います。high の最上級は highest です。'),
        ('GQ_CMP_003', 'eiken_pre2', 'comparison', 'This bag is as (____) as mine.', ['heavy', 'heavier', 'heaviest', 'more heavy'], 'heavy', 'as ... as は「同じくらい…」という表現で、間には形容詞の原級を入れます。だから heavy が正解です。'),
        ('GQ_REL_001', 'eiken_pre2', 'relative_pronoun', 'The boy (____) is playing soccer is my brother.', ['who', 'which', 'where', 'when'], 'who', '先行詞が人の the boy なので、関係代名詞 who を使います。「サッカーをしている男の子」という意味です。'),
        ('GQ_REL_002', 'eiken_pre2', 'relative_pronoun', 'This is the camera (____) I bought yesterday.', ['who', 'which', 'where', 'when'], 'which', '先行詞が物の camera なので which が合います。「昨日買ったカメラ」という意味です。'),
        ('GQ_REL_003', 'eiken_pre2', 'relative_pronoun', 'I know a park (____) we can play tennis.', ['who', 'which', 'where', 'whose'], 'where', 'park は場所なので、後ろで「そこでテニスができる」と説明する where が自然です。'),
        ('GQ_PERF_001', 'eiken_pre2', 'present_perfect', 'I have (____) seen that movie before.', ['ever', 'yet', 'already', 'still'], 'already', 'have already seen で「もう見たことがある」という意味です。before といっしょに経験や完了を表せます。'),
        ('GQ_PERF_002', 'eiken_pre2', 'present_perfect', 'Have you (____) been to Kyoto?', ['ever', 'already', 'yet', 'still'], 'ever', 'Have you ever been to ...? は「今までに〜へ行ったことがありますか」という経験を聞く表現です。'),
        ('GQ_PERF_003', 'eiken_pre2', 'present_perfect', 'She has lived in Osaka (____) 2020.', ['for', 'since', 'during', 'by'], 'since', 'since は「〜以来」という意味で、始まった時点を表します。2020 という時点があるので since が正解です。'),
    ]
    conn.executemany(
        '''
        INSERT OR IGNORE INTO grammar_questions (
            id, level, category, question_text, choices_json, correct_answer, explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        [(qid, level, category, text, json.dumps(choices, ensure_ascii=False), answer, explanation) for qid, level, category, text, choices, answer, explanation in questions],
    )

    monsters = [
        ('infinitive_pup', 'トゥードッグ', '/assets/pets/air/AIR_RABBIT1.png', 'infinitive', 100, 'normal', 0.7, '不定詞のポイント：want to do / decide to do / It is important to do を見つけよう。'),
        ('gerund_fox', 'イングフォックス', '/assets/pets/fire/FIRE_FOX1.png', 'gerund', 100, 'normal', 0.7, '動名詞のポイント：enjoy / finish / 前置詞の後ろは ing 形になりやすいよ。'),
        ('comparison_cat', 'くらべキャット', '/assets/pets/elec/ELEC_CAT1.png', 'comparison', 100, 'rare', 0.65, '比較のポイント：than は比較級、the と範囲があると最上級、as ... as は原級だよ。'),
        ('relative_owl', 'つなぐフクロウ', '/assets/pets/wood/WOOD_DEER1.png', 'relative_pronoun', 100, 'normal', 0.7, '関係代名詞のポイント：人は who、物は which、場所は where をまず考えよう。'),
        ('perfect_squirrel', 'かんりょうリス', '/assets/pets/star/STAR_CAT1.png', 'present_perfect', 100, 'rare', 0.65, '現在完了のポイント：ever / already / since / for がヒントになるよ。'),
    ]
    conn.executemany(
        '''
        INSERT OR IGNORE INTO wild_monsters (
            id, name_ja, image_url, grammar_category, max_hp, rarity, capture_base_rate, grammar_tip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        monsters,
    )


def _table_exists(conn, table_name):
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def migrate_pets_catalog(conn):
    existing_ids = {
        row[0]
        for row in conn.execute(
            'SELECT pokemon_id FROM pets_catalog WHERE pokemon_id BETWEEN 1 AND 151'
        ).fetchall()
    }
    missing_ids = [pokemon_id for pokemon_id in range(1, 152) if pokemon_id not in existing_ids]
    if not missing_ids:
        return

    conn.executemany(
        'INSERT INTO pets_catalog (pokemon_id, pokemon_name, image_url, sprite_url, types, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [(pokemon_id, '', None, None, '') for pokemon_id in missing_ids],
    )


def migrate_pokemon_catalog(conn):
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS pokemon_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pokemon_id INTEGER NOT NULL,
            name TEXT,
            image_url TEXT,
            sprite_url TEXT,
            type1 TEXT,
            type2 TEXT,
            generation TEXT,
            cached_at TEXT,
            pokemon_name TEXT,
            types TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (pokemon_id)
        )
        '''
    )
    existing_columns = {row[1] for row in conn.execute('PRAGMA table_info(pokemon_catalog)').fetchall()}
    for column_sql, column_name in [
        ('ALTER TABLE pokemon_catalog ADD COLUMN name TEXT', 'name'),
        ('ALTER TABLE pokemon_catalog ADD COLUMN type1 TEXT', 'type1'),
        ('ALTER TABLE pokemon_catalog ADD COLUMN type2 TEXT', 'type2'),
        ('ALTER TABLE pokemon_catalog ADD COLUMN generation TEXT', 'generation'),
        ('ALTER TABLE pokemon_catalog ADD COLUMN cached_at TEXT', 'cached_at'),
        ('ALTER TABLE pokemon_catalog ADD COLUMN pokemon_name TEXT', 'pokemon_name'),
        ('ALTER TABLE pokemon_catalog ADD COLUMN types TEXT', 'types'),
    ]:
        if column_name not in existing_columns:
            conn.execute(column_sql)
    if _table_exists(conn, 'pets_catalog'):
        conn.execute(
            '''
            INSERT OR IGNORE INTO pokemon_catalog (
                pokemon_id, name, image_url, sprite_url, type1, type2, generation, cached_at, pokemon_name, types, created_at, updated_at
            )
            SELECT
                pokemon_id,
                COALESCE(pokemon_name, ''),
                image_url,
                sprite_url,
                CASE WHEN json_valid(types) THEN json_extract(types, '$[0].name') END,
                CASE WHEN json_valid(types) THEN json_extract(types, '$[1].name') END,
                NULL,
                created_at,
                COALESCE(pokemon_name, ''),
                types,
                created_at,
                updated_at
            FROM pets_catalog
            '''
        )
    conn.execute(
        '''
        UPDATE pokemon_catalog
        SET
            name = COALESCE(name, pokemon_name),
            pokemon_name = COALESCE(pokemon_name, name),
            type1 = COALESCE(type1, CASE WHEN json_valid(types) THEN json_extract(types, '$[0].name') END),
            type2 = COALESCE(type2, CASE WHEN json_valid(types) THEN json_extract(types, '$[1].name') END),
            cached_at = COALESCE(cached_at, updated_at)
        '''
    )
    existing_ids = {
        row[0]
        for row in conn.execute(
            'SELECT pokemon_id FROM pokemon_catalog WHERE pokemon_id BETWEEN 1 AND 151'
        ).fetchall()
    }
    missing_ids = [pokemon_id for pokemon_id in range(1, 152) if pokemon_id not in existing_ids]
    if missing_ids:
        conn.executemany(
            'INSERT INTO pokemon_catalog (pokemon_id, name, image_url, sprite_url, type1, type2, generation, cached_at, pokemon_name, types, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [(pokemon_id, '', None, None, None, None, None, '', '') for pokemon_id in missing_ids],
        )


def migrate_child_pokemon_collection(conn):
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS child_pokemon_collection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            child_id INTEGER NOT NULL,
            pokemon_id INTEGER NOT NULL,
            nickname TEXT,
            level INTEGER NOT NULL DEFAULT 1,
            exp INTEGER NOT NULL DEFAULT 0,
            total_exp INTEGER NOT NULL DEFAULT 0,
            max_level INTEGER NOT NULL DEFAULT 10,
            is_active INTEGER NOT NULL DEFAULT 0,
            unlocked_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            pet_name TEXT,
            FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
            FOREIGN KEY (pokemon_id) REFERENCES pokemon_catalog (pokemon_id) ON UPDATE CASCADE ON DELETE RESTRICT,
            UNIQUE (child_id, pokemon_id)
        )
        '''
    )
    existing_columns = {row[1] for row in conn.execute('PRAGMA table_info(child_pokemon_collection)').fetchall()}
    for column_sql, column_name in [
        ('ALTER TABLE child_pokemon_collection ADD COLUMN nickname TEXT', 'nickname'),
        ('ALTER TABLE child_pokemon_collection ADD COLUMN unlocked_at TEXT', 'unlocked_at'),
        ('ALTER TABLE child_pokemon_collection ADD COLUMN pet_name TEXT', 'pet_name'),
    ]:
        if column_name not in existing_columns:
            conn.execute(column_sql)
    if _table_exists(conn, 'child_pets'):
        legacy_rows = conn.execute(
            'SELECT child_id, pokemon_id, pet_name, level, exp, total_exp, created_at, updated_at FROM child_pets'
        ).fetchall()
        for legacy in legacy_rows:
            conn.execute(
                '''
                INSERT OR IGNORE INTO child_pokemon_collection (
                    child_id, pokemon_id, pet_name, level, exp, total_exp, max_level, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    legacy['child_id'],
                    legacy['pokemon_id'],
                    legacy['pet_name'],
                    legacy['level'],
                    legacy['exp'],
                    legacy['total_exp'],
                    10,
                    1,
                    legacy['created_at'],
                    legacy['updated_at'],
                ),
            )
    if _table_exists(conn, 'child_pokemon_collection'):
        child_ids = [row[0] for row in conn.execute('SELECT id FROM children').fetchall()]
        for child_id in child_ids:
            existing = conn.execute(
                'SELECT id FROM child_pokemon_collection WHERE child_id = ? LIMIT 1',
                (child_id,),
            ).fetchone()
            if not existing:
                pokemon_id = get_random_pokemon_id(conn)
                child_row = conn.execute('SELECT name FROM children WHERE id = ?', (child_id,)).fetchone()
                conn.execute(
                    '''
                    INSERT INTO child_pokemon_collection (
                        child_id, pokemon_id, pet_name, level, exp, total_exp, max_level, is_active, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''',
                    (
                        child_id,
                        pokemon_id,
                        child_row['name'] if child_row else 'ポケモン',
                        1,
                        0,
                        0,
                        10,
                        1,
                    ),
                )
        conn.execute(
            '''
            UPDATE child_pokemon_collection
            SET is_active = CASE
                WHEN id = (
                    SELECT id FROM child_pokemon_collection AS p2
                    WHERE p2.child_id = child_pokemon_collection.child_id
                    ORDER BY is_active DESC, id ASC
                    LIMIT 1
                ) THEN 1
                ELSE 0
            END
            WHERE child_id IN (SELECT id FROM children)
            '''
        )
        conn.execute(
            '''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_child_pokemon_collection_active
            ON child_pokemon_collection (child_id)
            WHERE is_active = 1
            '''
        )


def ensure_default_account(conn):
    default_email = 'default@local.eigoquest'
    row = conn.execute(
        'SELECT id FROM accounts WHERE email = ?',
        (default_email,),
    ).fetchone()
    if row:
        return row['id']

    count_row = conn.execute('SELECT COUNT(*) AS count FROM accounts').fetchone()
    now = get_now_iso()
    if not count_row or int(count_row['count'] or 0) == 0:
        conn.execute(
            '''
            INSERT INTO accounts (email, phone, provider, display_name, created_at, updated_at)
            VALUES (?, NULL, 'default', 'Default Account', ?, ?)
            ''',
            (default_email, now, now),
        )
    else:
        conn.execute(
            '''
            INSERT INTO accounts (email, phone, provider, display_name, created_at, updated_at)
            VALUES (?, NULL, 'default', 'Default Account', ?, ?)
            ON CONFLICT(email) DO NOTHING
            ''',
            (default_email, now, now),
        )

    row = conn.execute(
        'SELECT id FROM accounts WHERE email = ?',
        (default_email,),
    ).fetchone()
    if row:
        return row['id']

    fallback = conn.execute('SELECT id FROM accounts ORDER BY id ASC LIMIT 1').fetchone()
    if not fallback:
        raise RuntimeError('default account could not be created')
    return fallback['id']


def migrate_children_profile_fields(conn):
    columns = {row[1] for row in conn.execute('PRAGMA table_info(children)').fetchall()}
    if 'account_id' not in columns:
        conn.execute('ALTER TABLE children ADD COLUMN account_id INTEGER')
    if 'avatar' not in columns:
        conn.execute("ALTER TABLE children ADD COLUMN avatar TEXT")
    if 'learning_goal' not in columns:
        conn.execute("ALTER TABLE children ADD COLUMN learning_goal TEXT")
    if 'daily_target' not in columns:
        conn.execute('ALTER TABLE children ADD COLUMN daily_target INTEGER NOT NULL DEFAULT 20')
    if 'daily_word_target' not in columns:
        conn.execute('ALTER TABLE children ADD COLUMN daily_word_target INTEGER NOT NULL DEFAULT 20')
    if 'starter_pokemon_id' not in columns:
        conn.execute('ALTER TABLE children ADD COLUMN starter_pokemon_id INTEGER')
    if 'study_mode' not in columns:
        conn.execute("ALTER TABLE children ADD COLUMN study_mode TEXT NOT NULL DEFAULT 'normal'")

    conn.execute(
        '''
        UPDATE children
        SET daily_word_target = COALESCE(NULLIF(daily_word_target, 0), daily_target, 20)
        WHERE daily_word_target IS NULL OR daily_word_target <= 0
        '''
    )
    conn.execute(
        '''
        UPDATE children
        SET learning_goal = COALESCE(NULLIF(learning_goal, ''), target_level)
        WHERE learning_goal IS NULL OR learning_goal = ''
        '''
    )

    child_rows = conn.execute(
        '''
        SELECT c.id
        FROM children AS c
        LEFT JOIN child_pokemon_collection AS p ON p.child_id = c.id
        WHERE c.daily_target IS NULL OR c.daily_target <= 0 OR c.starter_pokemon_id IS NULL OR c.study_mode IS NULL OR c.study_mode = ''
        GROUP BY c.id
        '''
    ).fetchall()
    for row in child_rows:
        child_id = row['id']
        starter_row = conn.execute(
            '''
            SELECT pokemon_id
            FROM child_pokemon_collection
            WHERE child_id = ? AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
            ''',
            (child_id,),
        ).fetchone()
        if not starter_row:
            starter_row = conn.execute(
                '''
                SELECT pokemon_id
                FROM child_pokemon_collection
                WHERE child_id = ?
                ORDER BY is_active DESC, id ASC
                LIMIT 1
                ''',
                (child_id,),
            ).fetchone()
        starter_id = int(starter_row['pokemon_id']) if starter_row and starter_row['pokemon_id'] else get_random_pokemon_id(conn)
        conn.execute(
            "UPDATE children SET daily_target = COALESCE(daily_target, 20), starter_pokemon_id = ?, study_mode = COALESCE(NULLIF(study_mode, ''), 'normal') WHERE id = ?",
            (starter_id, child_id),
        )
    default_account_id = ensure_default_account(conn)
    conn.execute(
        '''
        UPDATE children
        SET account_id = ?
        WHERE account_id IS NULL
        ''',
        (default_account_id,),
    )
    conn.execute(
        '''
        CREATE INDEX IF NOT EXISTS idx_children_account_id
        ON children (account_id)
        '''
    )
    conn.commit()


def get_table_columns(conn, table_name):
    return {
        row['name']
        for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()
    }


def sync_postgres_sequences(conn):
    if not use_postgres():
        return
    rows = conn.execute(
        '''
        SELECT
            table_name,
            column_name,
            pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) IS NOT NULL
        '''
    ).fetchall()
    for row in rows:
        table_name = row['table_name']
        column_name = row['column_name']
        sequence_name = row['sequence_name']
        if not sequence_name:
            continue
        conn.execute(
            f'''
            SELECT setval(
                %s::regclass,
                COALESCE((SELECT MAX("{column_name}") FROM "{table_name}"), 0) + 1,
                false
            )
            ''',
            (sequence_name,),
        )


def get_postgres_primary_key_columns(conn, table_name):
    rows = conn.execute(
        '''
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = %s::regclass AND i.indisprimary
        ORDER BY a.attnum
        ''',
        (table_name,),
    ).fetchall()
    return {row['column_name'] for row in rows}


def get_postgres_single_column_unique_constraints(conn, table_name, column_name):
    rows = conn.execute(
        '''
        SELECT c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = %s::regclass AND c.contype = 'u'
        GROUP BY c.conname
        HAVING COUNT(*) = 1 AND MIN(a.attname) = %s
        ''',
        (table_name, column_name),
    ).fetchall()
    return [row['constraint_name'] for row in rows]


def migrate_error_log_schema(conn):
    if use_postgres():
        columns = get_table_columns(conn, 'error_log')
        primary_key_columns = get_postgres_primary_key_columns(conn, 'error_log')
        required_columns = {'id', 'word_id', 'message', 'created_at'}
        if required_columns.issubset(columns) and primary_key_columns == {'id'}:
            conn.execute('ALTER TABLE error_log ALTER COLUMN word_id DROP NOT NULL')
            for constraint_name in get_postgres_single_column_unique_constraints(conn, 'error_log', 'word_id'):
                conn.execute(f'ALTER TABLE error_log DROP CONSTRAINT IF EXISTS "{constraint_name}"')
            return

        app.logger.warning('Rebuilding incompatible error_log schema for PostgreSQL startup safety.')
        conn.execute('DROP TABLE IF EXISTS error_log CASCADE')
        conn.execute(
            '''
            CREATE TABLE error_log (
                id SERIAL PRIMARY KEY,
                word_id INTEGER NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        return

    columns = get_table_columns(conn, 'error_log')
    needs_rebuild = 'id' not in columns or 'message' not in columns or 'created_at' not in columns or 'error_date' in columns or 'error_count' in columns
    if not needs_rebuild:
        return
    conn.execute('DROP TABLE IF EXISTS error_log_new')
    conn.execute(
        '''
        CREATE TABLE error_log_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_id INTEGER,
            message TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    select_message = 'message' if 'message' in columns else "''"
    select_created_at = 'created_at' if 'created_at' in columns else 'CURRENT_TIMESTAMP'
    select_word_id = (
        "CASE WHEN word_id GLOB '[0-9]*' AND word_id != '' THEN CAST(word_id AS INTEGER) ELSE NULL END"
        if 'word_id' in columns else 'NULL'
    )
    conn.execute(
        f'''
        INSERT INTO error_log_new (word_id, message, created_at)
        SELECT {select_word_id}, {select_message}, COALESCE({select_created_at}, CURRENT_TIMESTAMP)
        FROM error_log
        '''
    )
    conn.execute('DROP TABLE error_log')
    conn.execute('ALTER TABLE error_log_new RENAME TO error_log')


def migrate_child_pets(conn):
    columns = {
        row[1]
        for row in conn.execute('PRAGMA table_info(child_pets)').fetchall()
    }
    if 'pokemon_id' not in columns:
        conn.execute('ALTER TABLE child_pets RENAME TO child_pets_legacy')
        conn.execute(
            '''
            CREATE TABLE child_pets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_id INTEGER NOT NULL,
                pokemon_id INTEGER NOT NULL,
                pet_name TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 1,
                exp INTEGER NOT NULL DEFAULT 0,
                total_exp INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (pokemon_id) REFERENCES pets_catalog (pokemon_id) ON UPDATE CASCADE ON DELETE RESTRICT,
                UNIQUE (child_id)
            )
            '''
        )
        legacy_rows = conn.execute(
            'SELECT child_id, pet_name, pet_type, level, exp, total_exp, created_at, updated_at FROM child_pets_legacy'
        ).fetchall()
        for legacy in legacy_rows:
            pet_type = (legacy['pet_type'] or '').strip().lower()
            pokemon_id = {
                'cat': 52,
                'dog': 58,
                'dragon': 147,
            }.get(pet_type) or get_random_pokemon_id(conn)
            conn.execute(
                '''
                INSERT INTO child_pets (
                    child_id, pokemon_id, pet_name, level, exp, total_exp, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    legacy['child_id'],
                    pokemon_id,
                    legacy['pet_name'],
                    legacy['level'],
                    legacy['exp'],
                    legacy['total_exp'],
                    legacy['created_at'],
                    legacy['updated_at'],
                ),
            )
        conn.execute('DROP TABLE child_pets_legacy')

    conn.execute(
        '''
        INSERT INTO child_pets (
            child_id, pokemon_id, pet_name, level, exp, total_exp, created_at, updated_at
        )
        SELECT
            c.id,
            (SELECT pokemon_id FROM pets_catalog WHERE pokemon_id BETWEEN 1 AND 151 ORDER BY RANDOM() LIMIT 1),
            c.name,
            1,
            0,
            0,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM children AS c
        LEFT JOIN child_pets AS p ON p.child_id = c.id
        WHERE p.id IS NULL
        '''
    )


def migrate_child_vocab_progress(conn):
    columns = {
        row[1]
        for row in conn.execute('PRAGMA table_info(child_vocab_progress)').fetchall()
    }
    if 'correct_streak' not in columns:
        conn.execute(
            'ALTER TABLE child_vocab_progress ADD COLUMN correct_streak INTEGER NOT NULL DEFAULT 0'
        )
    if 'mastery' not in columns:
        conn.execute(
            'ALTER TABLE child_vocab_progress ADD COLUMN mastery INTEGER NOT NULL DEFAULT 0'
        )
    if 'status' not in columns:
        conn.execute("ALTER TABLE child_vocab_progress ADD COLUMN status TEXT NOT NULL DEFAULT 'new'")
        conn.execute(
            '''
            UPDATE child_vocab_progress
            SET status = CASE
                WHEN mastered = 1 OR mastery >= 100 THEN 'mastered'
                WHEN wrong_count > 0 THEN 'review'
                ELSE 'learning'
            END
            '''
        )
    if 'mastered_at' not in columns:
        conn.execute('ALTER TABLE child_vocab_progress ADD COLUMN mastered_at TEXT')
        conn.execute(
            '''
            UPDATE child_vocab_progress
            SET mastered_at = COALESCE(last_studied_at, updated_at)
            WHERE (mastered = 1 OR mastery >= 100) AND mastered_at IS NULL
            '''
        )
    if 'last_reviewed_at' not in columns:
        conn.execute('ALTER TABLE child_vocab_progress ADD COLUMN last_reviewed_at TEXT')
        conn.execute(
            '''
            UPDATE child_vocab_progress
            SET last_reviewed_at = last_studied_at
            WHERE last_studied_at IS NOT NULL AND last_reviewed_at IS NULL
            '''
        )
    if 'is_parent_marked_mastered' not in columns:
        conn.execute('ALTER TABLE child_vocab_progress ADD COLUMN is_parent_marked_mastered INTEGER NOT NULL DEFAULT 0')
    dedupe_child_vocab_progress(conn)
    conn.execute(
        '''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_child_vocab_progress_child_vocab
        ON child_vocab_progress (child_id, vocab_id)
        '''
    )


def dedupe_child_vocab_progress(conn):
    duplicate_keys = conn.execute(
        '''
        SELECT child_id, vocab_id, MIN(id) AS keep_id
        FROM child_vocab_progress
        GROUP BY child_id, vocab_id
        HAVING COUNT(*) > 1
        '''
    ).fetchall()
    for duplicate in duplicate_keys:
        child_id = duplicate['child_id']
        vocab_id = duplicate['vocab_id']
        keep_id = duplicate['keep_id']
        aggregate = conn.execute(
            '''
            SELECT
                SUM(correct_count) AS correct_count,
                SUM(wrong_count) AS wrong_count,
                SUM(review_count) AS review_count,
                MAX(memory_level) AS memory_level,
                MAX(last_studied_at) AS last_studied_at,
                MAX(mastered) AS mastered,
                MIN(created_at) AS created_at,
                MAX(updated_at) AS updated_at,
                MAX(correct_streak) AS correct_streak,
                MAX(mastery) AS mastery,
                MAX(CASE status
                    WHEN 'mastered' THEN 4
                    WHEN 'review' THEN 3
                    WHEN 'learning' THEN 2
                    ELSE 1
                END) AS status_rank,
                MIN(mastered_at) AS mastered_at,
                MAX(last_reviewed_at) AS last_reviewed_at,
                MAX(is_parent_marked_mastered) AS is_parent_marked_mastered
            FROM child_vocab_progress
            WHERE child_id = ? AND vocab_id = ?
            ''',
            (child_id, vocab_id),
        ).fetchone()
        status_by_rank = {4: 'mastered', 3: 'review', 2: 'learning', 1: 'new'}
        status = status_by_rank.get(int(aggregate['status_rank'] or 1), 'new')
        conn.execute(
            '''
            UPDATE child_vocab_progress
            SET correct_count = ?,
                wrong_count = ?,
                review_count = ?,
                memory_level = ?,
                last_studied_at = ?,
                mastered = ?,
                created_at = ?,
                updated_at = ?,
                correct_streak = ?,
                mastery = ?,
                status = ?,
                mastered_at = ?,
                last_reviewed_at = ?,
                is_parent_marked_mastered = ?
            WHERE id = ?
            ''',
            (
                aggregate['correct_count'] or 0,
                aggregate['wrong_count'] or 0,
                aggregate['review_count'] or 0,
                aggregate['memory_level'] or 0,
                aggregate['last_studied_at'],
                aggregate['mastered'] or 0,
                aggregate['created_at'],
                aggregate['updated_at'],
                aggregate['correct_streak'] or 0,
                aggregate['mastery'] or 0,
                status,
                aggregate['mastered_at'],
                aggregate['last_reviewed_at'],
                aggregate['is_parent_marked_mastered'] or 0,
                keep_id,
            ),
        )
        conn.execute(
            '''
            DELETE FROM child_vocab_progress
            WHERE child_id = ? AND vocab_id = ? AND id <> ?
            ''',
            (child_id, vocab_id, keep_id),
        )


def migrate_daily_study_log(conn):
    duplicate_keys = conn.execute(
        '''
        SELECT child_id, study_date, MIN(id) AS keep_id
        FROM daily_study_log
        GROUP BY child_id, study_date
        HAVING COUNT(*) > 1
        '''
    ).fetchall()
    for duplicate in duplicate_keys:
        child_id = duplicate['child_id']
        study_date = duplicate['study_date']
        keep_id = duplicate['keep_id']
        aggregate = conn.execute(
            '''
            SELECT
                SUM(studied_count) AS studied_count,
                SUM(correct_count) AS correct_count,
                SUM(wrong_count) AS wrong_count,
                SUM(study_minutes) AS study_minutes,
                MIN(created_at) AS created_at,
                MAX(updated_at) AS updated_at
            FROM daily_study_log
            WHERE child_id = ? AND study_date = ?
            ''',
            (child_id, study_date),
        ).fetchone()
        conn.execute(
            '''
            UPDATE daily_study_log
            SET studied_count = ?,
                correct_count = ?,
                wrong_count = ?,
                study_minutes = ?,
                created_at = ?,
                updated_at = ?
            WHERE id = ?
            ''',
            (
                aggregate['studied_count'] or 0,
                aggregate['correct_count'] or 0,
                aggregate['wrong_count'] or 0,
                aggregate['study_minutes'] or 0,
                aggregate['created_at'],
                aggregate['updated_at'],
                keep_id,
            ),
        )
        conn.execute(
            '''
            DELETE FROM daily_study_log
            WHERE child_id = ? AND study_date = ? AND id <> ?
            ''',
            (child_id, study_date, keep_id),
        )
    conn.execute(
        '''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_study_log_child_date
        ON daily_study_log (child_id, study_date)
        '''
    )


def migrate_vocabulary_word_columns(conn):
    columns = {
        row[1]
        for row in conn.execute('PRAGMA table_info(vocabulary)').fetchall()
    }
    additions = {
        'word': 'TEXT',
        'meaning': 'TEXT',
        'level': 'TEXT',
        'example': 'TEXT',
        'updated_at': 'TEXT',
    }
    for name, definition in additions.items():
        if name not in columns:
            conn.execute(f'ALTER TABLE vocabulary ADD COLUMN {name} {definition}')


def migrate_vocabulary_ids(conn):
    if use_postgres():
        return
    existing_ids = {
        str(row[0]).strip()
        for row in conn.execute('SELECT id FROM vocabulary').fetchall()
    }
    vocab_ids = [
        int(entry['ID'])
        for entry in vocab_list
        if str(entry.get('ID', '')).strip().isdigit()
    ]
    missing_ids = [vocab_id for vocab_id in vocab_ids if str(vocab_id) not in existing_ids]
    if missing_ids:
        conn.executemany(
            'INSERT INTO vocabulary (id) VALUES (?)',
            [(vocab_id,) for vocab_id in missing_ids],
        )
    for entry in vocab_list:
        vocab_id = str(entry.get('ID', '')).strip()
        if not vocab_id.isdigit():
            continue
        conn.execute(
            '''
            UPDATE vocabulary
            SET word = ?, meaning = ?, level = ?, example = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''',
            (
                entry.get('English', '').strip(),
                entry.get('Japanese', '').strip(),
                entry.get('Category', '').strip() or entry.get('Importance', '').strip(),
                entry.get('Example_English', '').strip() or entry.get('Example_English_Short', '').strip(),
                int(vocab_id),
            ),
        )


def log_error(word_id):
    if not word_id:
        return
    raw_word_id = str(word_id).strip()
    normalized_word_id = int(raw_word_id) if raw_word_id.isdigit() else None
    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO error_log (word_id, message, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            (normalized_word_id, f'wrong answer for word_id={raw_word_id}'),
        )
        conn.commit()
    finally:
        conn.close()


def get_context_sentence(word):
    match = next(
        (row for row in context_list if row.get('word', '').strip().lower() == word.strip().lower()),
        None
    )
    return match.get('sentence_jp', '').strip() if match else ''


def parse_optional_child_id_arg():
    raw_child_id = request.args.get('child_id') or request.args.get('childId') or ''
    raw_child_id = str(raw_child_id).strip()
    if not raw_child_id:
        return None
    try:
        return int(raw_child_id)
    except (TypeError, ValueError):
        abort(400, 'child_id must be an integer')


def get_child_review_list(child_id):
    init_db()
    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
        if not child_row:
            raise LookupError('child not found')
        rows = conn.execute(
            '''
            SELECT vocab_id, wrong_count, review_count, mastery, last_studied_at, updated_at
            FROM child_vocab_progress
            WHERE child_id = ? AND wrong_count > 0 AND mastered = 0 AND mastery < 100
            ORDER BY wrong_count DESC, review_count DESC, last_studied_at DESC, id DESC
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()

    review_items = []
    for row in rows:
        vocab_id = str(row['vocab_id'])
        vocab = resolve_vocab_entry(vocab_id, vocab_list)
        sentence_jp = get_context_sentence(vocab['English'] if vocab else vocab_id) if vocab else ''
        review_items.append({
            'word_id': vocab_id,
            'id': vocab.get('ID', '') if vocab else vocab_id,
            'word': vocab['English'] if vocab else vocab_id,
            'japanese': vocab['Japanese'] if vocab else '',
            'example': vocab.get('Example_English', '').strip() if vocab else '',
            'example_japanese': vocab.get('Example_Japanese', '').strip() if vocab else '',
            'sentence_jp': sentence_jp,
            'error_count': int(row['wrong_count'] or 0),
            'review_count': int(row['review_count'] or 0),
            'mastery': int(row['mastery'] or 0),
            'last_error_date': row['last_studied_at'] or row['updated_at'],
        })
    return review_items


def get_review_list(child_id=None):
    if child_id is not None:
        return get_child_review_list(child_id)

    init_db()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT word_id, MAX(created_at) AS last_error_at, COUNT(*) AS error_count
            FROM error_log
            WHERE word_id IS NOT NULL
            GROUP BY word_id
            HAVING COUNT(*) > 2
            ORDER BY error_count DESC, last_error_at DESC
            '''
        ).fetchall()
    finally:
        conn.close()

    vocab_map = get_vocab_index(vocab_list)
    english_map = {v['English'].strip().lower(): v for v in vocab_list if v.get('English')}
    review_items = []
    for row in rows:
        word_id = str(row['word_id'])
        vocab = vocab_map.get(word_id.strip().lower()) or english_map.get(word_id.strip().lower())
        sentence_jp = get_context_sentence(vocab['English'] if vocab else word_id) if vocab else ''
        review_items.append({
            'word_id': word_id,
            'id': vocab.get('ID', '') if vocab else '',
            'word': vocab['English'] if vocab else word_id,
            'japanese': vocab['Japanese'] if vocab else '',
            'example_japanese': vocab.get('Example_Japanese', '').strip() if vocab else '',
            'sentence_jp': sentence_jp,
            'error_count': row['error_count'],
            'last_error_date': row['last_error_at'],
        })
    return review_items


def get_children_list(account_id):
    init_db()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT id, name, avatar, learning_goal, grade, target_level, daily_target, daily_word_target, study_mode, starter_pokemon_id, created_at, updated_at
            FROM children
            WHERE account_id = ?
            ORDER BY id ASC
            ''',
            (account_id,),
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            'id': row['id'],
            'name': row['name'],
            'nickname': row['name'],
            'avatar': row['avatar'] or '',
            'learning_goal': row['learning_goal'] or row['target_level'],
            'grade': row['grade'],
            'target_level': row['target_level'],
            'daily_target': row['daily_target'],
            'daily_word_target': row['daily_word_target'] or row['daily_target'],
            'study_mode': row['study_mode'] or 'normal',
            'starter_pokemon_id': row['starter_pokemon_id'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
        }
        for row in rows
    ]


def get_child_starter_options(count=3):
    starter_ids = STARTER_POKEMON_IDS[:max(1, count)]
    options = []

    for pokemon_id in starter_ids:
        pet = get_custom_pet_by_id(pokemon_id)
        if not pet:
            continue
        option = {
            'id': int(pokemon_id),
            'pet_id': pet.get('id'),
            'name': pet.get('nameJa') or 'ペット',
            'image_url': pet.get('image_url'),
            'sprite_url': pet.get('sprite_url'),
            'types': pet.get('types') or [],
            'tagsJa': pet.get('tagsJa') or [],
        }
        options.append(option)

    return options
def upsert_child_profile(data, account_id):
    name = (data.get('nickname') or data.get('name') or '').strip()
    avatar = (data.get('avatar') or '').strip()
    learning_goal = (data.get('learning_goal') or data.get('target_level') or '').strip()
    grade = (data.get('grade') or '').strip()
    target_level = (data.get('target_level') or learning_goal or '').strip()
    daily_target = data.get('daily_word_target', data.get('daily_target', 20))
    daily_word_target = data.get('daily_word_target', daily_target)
    study_mode = (data.get('study_mode') or 'normal').strip()
    starter_pokemon_id = data.get('starter_pokemon_id')
    child_id = data.get('id')

    if not name:
        raise ValueError('nickname is required')
    if not grade:
        grade = '1'
    if not learning_goal:
        learning_goal = target_level or '英検4級をめざす'
    if not target_level:
        target_level = learning_goal
    allowed_target_levels = {'\u4e09\u7d1a', '\u6e96\u0032\u7d1a'}
    if target_level not in allowed_target_levels:
        target_level = '\u4e09\u7d1a'
    try:
        daily_target = int(daily_target)
    except (TypeError, ValueError):
        raise ValueError('daily_target must be an integer')
    if daily_target < 1:
        raise ValueError('daily_target must be at least 1')
    try:
        daily_word_target = int(daily_word_target)
    except (TypeError, ValueError):
        daily_word_target = daily_target
    if daily_word_target < 1:
        daily_word_target = daily_target
    if study_mode not in {'normal', 'full_review', 'exam_mode'}:
        study_mode = 'normal'

    starter_row = None
    if starter_pokemon_id not in [None, '', 'null']:
        try:
            starter_pokemon_id = int(starter_pokemon_id)
        except (TypeError, ValueError):
            raise ValueError('starter_pokemon_id must be an integer')
        if starter_pokemon_id < 1 or starter_pokemon_id > CUSTOM_PET_TOTAL:
            raise ValueError(f'starter_pokemon_id must be between 1 and {CUSTOM_PET_TOTAL}')
        starter_row = get_custom_pet_by_id(starter_pokemon_id)
    else:
        starter_pokemon_id = None

    conn = get_db_connection()
    try:
        if child_id not in [None, '', 'null']:
            try:
                child_id = int(child_id)
            except (TypeError, ValueError):
                raise ValueError('id must be an integer')
            existing_child = conn.execute(
                'SELECT id FROM children WHERE id = ? AND account_id = ?',
                (child_id, account_id),
            ).fetchone()
            if not existing_child:
                raise LookupError('child not found')
            conn.execute(
                '''
                UPDATE children
                SET name = ?, avatar = ?, learning_goal = ?, grade = ?, target_level = ?, daily_target = ?, daily_word_target = ?, study_mode = ?, starter_pokemon_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND account_id = ?
                ''',
                (name, avatar, learning_goal, grade, target_level, daily_target, daily_word_target, study_mode, starter_pokemon_id, child_id, account_id),
            )
            target_child_id = child_id
        else:
            cur = conn.execute(
                '''
                INSERT INTO children (account_id, name, avatar, learning_goal, grade, target_level, daily_target, daily_word_target, study_mode, starter_pokemon_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (account_id, name, avatar, learning_goal, grade, target_level, daily_target, daily_word_target, study_mode, starter_pokemon_id),
            )
            target_child_id = cur.lastrowid

        if starter_pokemon_id is not None:
            conn.execute(
                '''
                INSERT OR IGNORE INTO child_pokemon_collection (
                    child_id, pokemon_id, nickname, pet_name, level, exp, total_exp, max_level, is_active, unlocked_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ''',
                (
                    target_child_id,
                    starter_pokemon_id,
                    starter_row.get('nameJa') if starter_row else 'ペット',
                    starter_row.get('nameJa') if starter_row else 'ペット',
                    1,
                    0,
                    0,
                    10,
                    1,
                ),
            )
            conn.execute(
                '''
                UPDATE child_pokemon_collection
                SET is_active = CASE WHEN pokemon_id = ? THEN 1 ELSE 0 END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE child_id = ?
                ''',
                (starter_pokemon_id, target_child_id),
            )

        conn.commit()
        child_row = conn.execute(
            '''
            SELECT id, name, avatar, learning_goal, grade, target_level, daily_target, daily_word_target, study_mode, starter_pokemon_id, created_at, updated_at
            FROM children
            WHERE id = ? AND account_id = ?
            ''',
            (target_child_id, account_id),
        ).fetchone()
        if not child_row:
            return None
        child = dict(child_row)
        child['nickname'] = child['name']
        return child
    finally:
        conn.close()


def recordStudyResult(child_id, vocab_id, isCorrect):
    if child_id is None or vocab_id is None:
        raise ValueError('child_id and vocab_id are required')

    today = get_today()
    now = get_now_iso()
    is_correct = bool(isCorrect)

    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT OR IGNORE INTO vocabulary (id) VALUES (?)',
            (vocab_id,),
        )
        existing_progress = conn.execute(
            'SELECT id, correct_streak, mastery, status FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
            (child_id, vocab_id),
        ).fetchone()
        is_new_word = existing_progress is None
        previous_streak = int(existing_progress['correct_streak'] or 0) if existing_progress else 0
        next_streak = previous_streak + 1 if is_correct else 0
        previous_mastery = int(existing_progress['mastery'] or 0) if existing_progress else 0
        next_mastery = max(0, min(100, previous_mastery + (8 + min(next_streak, 5) if is_correct else -10)))
        next_status = 'mastered' if next_mastery >= 100 else ('learning' if is_correct else 'review')
        mastered_at = now if next_status == 'mastered' else None

        pet_exp = 10 if is_correct else 2
        if is_new_word:
            pet_exp += 5
        if is_correct and next_streak % 5 == 0:
            pet_exp += 20

        conn.execute(
            '''
            INSERT INTO child_vocab_progress (
                child_id, vocab_id, correct_count, wrong_count, review_count,
                memory_level, last_studied_at, mastered, created_at, updated_at, correct_streak, mastery
                , status, mastered_at, last_reviewed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                correct_count = child_vocab_progress.correct_count + excluded.correct_count,
                wrong_count = child_vocab_progress.wrong_count + excluded.wrong_count,
                review_count = child_vocab_progress.review_count + 1,
                last_studied_at = excluded.last_studied_at,
                last_reviewed_at = excluded.last_reviewed_at,
                correct_streak = excluded.correct_streak,
                mastery = excluded.mastery,
                mastered = CASE WHEN excluded.mastery >= 100 THEN 1 ELSE child_vocab_progress.mastered END,
                mastered_at = CASE WHEN excluded.mastery >= 100 THEN COALESCE(child_vocab_progress.mastered_at, excluded.mastered_at) ELSE child_vocab_progress.mastered_at END,
                status = CASE WHEN excluded.mastery >= 100 THEN 'mastered' ELSE excluded.status END,
                updated_at = excluded.updated_at
            ''',
            (
                child_id,
                vocab_id,
                1 if is_correct else 0,
                0 if is_correct else 1,
                1,
                0,
                now,
                0,
                now,
                now,
                next_streak,
                next_mastery,
                next_status,
                mastered_at,
                now,
            ),
        )

        conn.execute(
            '''
            INSERT INTO daily_study_log (
                child_id, study_date, studied_count, correct_count, wrong_count,
                study_minutes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(child_id, study_date) DO UPDATE SET
                studied_count = daily_study_log.studied_count + 1,
                correct_count = daily_study_log.correct_count + excluded.correct_count,
                wrong_count = daily_study_log.wrong_count + excluded.wrong_count,
                updated_at = excluded.updated_at
            ''',
            (
                child_id,
                today,
                1,
                1 if is_correct else 0,
                0 if is_correct else 1,
                0,
                now,
                now,
            ),
        )
        conn.commit()

        pet_result = None
        try:
            pet_result = addPetExp(child_id, pet_exp)
        except Exception:
            pet_result = None

        progress_row = conn.execute(
            'SELECT * FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
            (child_id, vocab_id),
        ).fetchone()
        daily_row = conn.execute(
            'SELECT * FROM daily_study_log WHERE child_id = ? AND study_date = ?',
            (child_id, today),
        ).fetchone()
        return {
            'child_vocab_progress': dict(progress_row) if progress_row else None,
            'daily_study_log': dict(daily_row) if daily_row else None,
            'pet_exp_awarded': pet_exp,
            'pet': pet_result,
        }
    finally:
        conn.close()


def get_child_learning_stats(child_id=None):
    init_db()
    conn = get_db_connection()
    try:
        child_row = None
        if child_id is not None:
            child_row = conn.execute(
                'SELECT id, name, grade, target_level, daily_target, starter_pokemon_id, created_at, updated_at FROM children WHERE id = ?',
                (child_id,),
            ).fetchone()
        else:
            child_row = conn.execute(
                'SELECT id, name, grade, target_level, daily_target, starter_pokemon_id, created_at, updated_at FROM children ORDER BY id ASC LIMIT 1'
            ).fetchone()

        if not child_row:
            return {
                'child': None,
                'today': {
                    'studied_count': 0,
                    'correct_count': 0,
                    'wrong_count': 0,
                    'study_minutes': 0,
                    'study_date': get_today(),
                },
                'total_studied_words': 0,
                'top_wrong_words': [],
            }

        resolved_child_id = child_row['id']
        today = get_today()
        daily_row = conn.execute(
            '''
            SELECT studied_count, correct_count, wrong_count, study_minutes, study_date
            FROM daily_study_log
            WHERE child_id = ? AND study_date = ?
            ''',
            (resolved_child_id, today),
        ).fetchone()

        total_row = conn.execute(
            '''
            SELECT COUNT(*) AS total_studied_words
            FROM child_vocab_progress
            WHERE child_id = ? AND review_count > 0
            ''',
            (resolved_child_id,),
        ).fetchone()

        wrong_rows = conn.execute(
            '''
            SELECT vocab_id, correct_count, wrong_count, review_count, memory_level, last_studied_at, mastered
            FROM child_vocab_progress
            WHERE child_id = ? AND wrong_count > 0
            ORDER BY wrong_count DESC, review_count DESC, last_studied_at DESC, id ASC
            LIMIT 20
            ''',
            (resolved_child_id,),
        ).fetchall()
    finally:
        conn.close()

    vocab_by_id = {str(v.get('ID', '')).strip(): v for v in vocab_list if str(v.get('ID', '')).strip()}
    top_wrong_words = []
    for row in wrong_rows:
        vocab_key = str(row['vocab_id']).strip()
        vocab = vocab_by_id.get(vocab_key)
        top_wrong_words.append({
            'vocab_id': row['vocab_id'],
            'id': vocab.get('ID', '') if vocab else '',
            'word': vocab['English'] if vocab else f'ID {row["vocab_id"]}',
            'japanese': vocab['Japanese'] if vocab else '',
            'wrong_count': row['wrong_count'],
            'correct_count': row['correct_count'],
            'review_count': row['review_count'],
            'memory_level': row['memory_level'],
            'last_studied_at': row['last_studied_at'],
            'mastered': row['mastered'],
        })

    return {
        'child': {
            'id': child_row['id'],
            'name': child_row['name'],
            'grade': child_row['grade'],
            'target_level': child_row['target_level'],
            'created_at': child_row['created_at'],
            'updated_at': child_row['updated_at'],
        },
        'today': {
            'studied_count': daily_row['studied_count'] if daily_row else 0,
            'correct_count': daily_row['correct_count'] if daily_row else 0,
            'wrong_count': daily_row['wrong_count'] if daily_row else 0,
            'study_minutes': daily_row['study_minutes'] if daily_row else 0,
            'study_date': daily_row['study_date'] if daily_row else today,
        },
        'total_studied_words': total_row['total_studied_words'] if total_row else 0,
        'top_wrong_words': top_wrong_words,
    }


def get_child_learned_words(child_id=None):
    init_db()
    conn = get_db_connection()
    try:
        child_row = None
        if child_id is not None:
            child_row = conn.execute(
                'SELECT id, name FROM children WHERE id = ?',
                (child_id,),
            ).fetchone()
        else:
            child_row = conn.execute('SELECT id, name FROM children ORDER BY id ASC LIMIT 1').fetchone()

        if not child_row:
            return {'child': None, 'words': [], 'count': 0}

        rows = conn.execute(
            '''
            SELECT vocab_id, correct_count, wrong_count, review_count, mastery, last_studied_at
            FROM child_vocab_progress
            WHERE child_id = ? AND mastered = 1
            ORDER BY created_at ASC, id ASC
            ''',
            (child_row['id'],),
        ).fetchall()
    finally:
        conn.close()

    words = []
    for row in rows:
        vocab = resolve_vocab_entry(str(row['vocab_id']), vocab_list)
        if not vocab:
            continue
        words.append({
            'id': vocab.get('ID', ''),
            'word': vocab.get('English', ''),
            'jp': vocab.get('Japanese', ''),
            'cn': vocab.get('Chinese', ''),
            'example': vocab.get('Example_English', ''),
            'example_short': vocab.get('Example_English_Short', ''),
            'example_jp': vocab.get('Example_Japanese', ''),
            'example_cn': vocab.get('Example_Chinese', ''),
            'phrase': vocab.get('Phrase', ''),
            'synonyms': vocab.get('Synonyms', ''),
            'synonyms_japanese': vocab.get('Synonyms_Japanese', ''),
            'antonyms': vocab.get('Antonyms', ''),
            'antonyms_japanese': vocab.get('Antonyms_Japanese', ''),
            'importance': vocab.get('Importance', ''),
            'mastery': int(row['mastery'] or 0),
            'correct_count': int(row['correct_count'] or 0),
            'wrong_count': int(row['wrong_count'] or 0),
            'review_count': int(row['review_count'] or 0),
            'last_studied_at': row['last_studied_at'],
        })

    return {
        'child': {'id': child_row['id'], 'name': child_row['name']},
        'words': words,
        'count': len(words),
    }


def get_child_progress_report(child_id=None, selected_date=None):
    init_db()
    conn = get_db_connection()
    try:
        if child_id is not None:
            child_row = conn.execute(
                'SELECT id, name, grade, target_level, daily_target FROM children WHERE id = ?',
                (child_id,),
            ).fetchone()
        else:
            child_row = conn.execute(
                'SELECT id, name, grade, target_level, daily_target FROM children ORDER BY id ASC LIMIT 1'
            ).fetchone()

        if not child_row:
            return {
                'child': None,
                'days': [],
                'weekly': [],
                'monthly': [],
                'selected_day': None,
            }

        resolved_child_id = child_row['id']
        day_rows = conn.execute(
            '''
            SELECT study_date, studied_count, correct_count, wrong_count, study_minutes
            FROM daily_study_log
            WHERE child_id = ?
            ORDER BY study_date DESC
            LIMIT 30
            ''',
            (resolved_child_id,),
        ).fetchall()

        fallback_date = day_rows[0]['study_date'] if day_rows else get_today()
        target_date = selected_date or fallback_date
        selected_row = conn.execute(
            '''
            SELECT study_date, studied_count, correct_count, wrong_count, study_minutes
            FROM daily_study_log
            WHERE child_id = ? AND study_date = ?
            ''',
            (resolved_child_id, target_date),
        ).fetchone()

        progress_rows = conn.execute(
            '''
            SELECT vocab_id, correct_count, wrong_count, review_count, mastery, mastered, last_studied_at
            FROM child_vocab_progress
            WHERE child_id = ?
              AND substr(COALESCE(last_studied_at, ''), 1, 10) = ?
            ORDER BY last_studied_at DESC, id DESC
            ''',
            (resolved_child_id, target_date),
        ).fetchall()

        total_row = conn.execute(
            '''
            SELECT
                COALESCE(SUM(studied_count), 0) AS total_studies,
                COUNT(CASE WHEN studied_count > 0 THEN 1 END) AS study_days
            FROM daily_study_log
            WHERE child_id = ?
            ''',
            (resolved_child_id,),
        ).fetchone()
    finally:
        conn.close()

    def to_int(value):
        return int(value or 0)

    days = [
        {
            'study_date': row['study_date'],
            'studied_count': to_int(row['studied_count']),
            'correct_count': to_int(row['correct_count']),
            'wrong_count': to_int(row['wrong_count']),
            'study_minutes': to_int(row['study_minutes']),
        }
        for row in day_rows
    ]

    words = []
    for row in progress_rows:
        vocab = resolve_vocab_entry(str(row['vocab_id']), vocab_list)
        words.append({
            'vocab_id': row['vocab_id'],
            'word': vocab.get('English', '') if vocab else f'ID {row["vocab_id"]}',
            'japanese': vocab.get('Japanese', '') if vocab else '',
            'example': vocab.get('Example_English', '') if vocab else '',
            'correct_count': to_int(row['correct_count']),
            'wrong_count': to_int(row['wrong_count']),
            'review_count': to_int(row['review_count']),
            'mastery': to_int(row['mastery']),
            'mastered': bool(row['mastered']),
            'last_studied_at': row['last_studied_at'],
        })

    selected_day = {
        'study_date': target_date,
        'studied_count': to_int(selected_row['studied_count']) if selected_row else 0,
        'correct_count': to_int(selected_row['correct_count']) if selected_row else 0,
        'wrong_count': to_int(selected_row['wrong_count']) if selected_row else 0,
        'study_minutes': to_int(selected_row['study_minutes']) if selected_row else 0,
        'words': words,
    }

    chronological_days = list(reversed(days))
    return {
        'child': {
            'id': child_row['id'],
            'name': child_row['name'],
            'grade': child_row['grade'],
            'target_level': child_row['target_level'],
            'daily_target': to_int(child_row['daily_target']) or 20,
        },
        'days': days,
        'weekly': [day['studied_count'] for day in chronological_days[-7:]],
        'monthly': [day['studied_count'] for day in chronological_days],
        'selected_day': selected_day,
        'total_studies': to_int(total_row['total_studies']) if total_row else 0,
        'study_days': to_int(total_row['study_days']) if total_row else 0,
    }


vocab_list = load_vocabulary()
context_list = load_context()
init_db()


def migrate_error_log_ids():
    vocab_by_id = {v.get('ID', '').strip(): v for v in vocab_list if v.get('ID', '').strip()}
    vocab_by_english = {v.get('English', '').strip().lower(): v for v in vocab_list if v.get('English', '').strip()}

    conn = get_db_connection()
    try:
        rows = conn.execute('SELECT id, word_id FROM error_log').fetchall()
        if not rows:
            return

        for row in rows:
            old_key = str(row['word_id'] or '').strip()
            if not old_key or old_key.isdigit():
                continue
            normalized = old_key.lower()
            vocab = vocab_by_id.get(old_key) or vocab_by_english.get(normalized)
            key = vocab.get('ID', '').strip() if vocab and vocab.get('ID', '').strip() else ''
            if key and key.isdigit():
                conn.execute('UPDATE error_log SET word_id = ? WHERE id = ?', (int(key), row['id']))
        conn.commit()
    finally:
        conn.close()


migrate_error_log_ids()


def build_tts_url(text, lang):
    custom_api = os.getenv('TTS_API_URL')
    if custom_api:
        return custom_api.format(
            text=urllib.parse.quote(text),
            lang=urllib.parse.quote(lang)
        )

    query = urllib.parse.urlencode({
        'ie': 'UTF-8',
        'q': text,
        'tl': lang,
        'client': 'tw-ob',
    })
    return f'https://translate.google.com/translate_tts?{query}'


def fetch_tts_audio(text, lang):
    tts_url = build_tts_url(text, lang)
    req = urllib.request.Request(
        tts_url,
        headers={
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0 Safari/537.36'
            )
        }
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        return res.read()


def make_blank(example, word):
    blanked = re.sub(rf'\b{re.escape(word)}\b', '_____', example, flags=re.IGNORECASE)
    if blanked == example and word in example:
        blanked = example.replace(word, '_____', 1)
    if blanked == example:
        blanked = f'{example} (_____)'
    return blanked


def get_pos(word):
    w = (word or '').strip().lower()
    if w.endswith('ly'):
        return 'adv'
    elif w.endswith(('tion', 'ment', 'ness', 'ity')):
        return 'noun'
    elif w.endswith(('ing', 'ed')):
        return 'verb'
    elif w in ['be', 'have', 'do', 'make', 'take', 'go']:
        return 'verb'
    elif w.endswith(('ful', 'able', 'ous', 'ive', 'al')):
        return 'adj'
    return 'other'


def _generate_vocabulary_question(entries):
    entry = random.choice(entries)
    word = entry.get('English', '').strip()
    japanese = entry.get('Japanese', '').strip()
    other_entries = [e for e in entries if e.get('English', '').strip() != word]
    wrong_options = random.sample(other_entries, min(3, len(other_entries)))
    wrong_answers = [e.get('Japanese', '').strip() for e in wrong_options if e.get('Japanese', '').strip()]
    options = [japanese] + wrong_answers
    random.shuffle(options)
    return {
        'type': 'Vocabulary',
        'question': f'Choose the best Japanese meaning for "{word}".',
        'choices': options,
        'correct': japanese,
        'id': entry.get('ID', ''),
        'word': word,
        'explanation_jp': f'"{word}" means "{japanese}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
        'japanese': japanese,
    }


def _generate_grammar_question(entries):
    entry = random.choice(entries)
    word = entry.get('English', '').strip()
    example = entry.get('Example_English', '').strip() or 'I will ______ this problem.'
    example_jp = entry.get('Example_Japanese', '').strip()
    blanked = make_blank(example, word)

    correct_pos = get_pos(word)
    same_pos = [
        e for e in entries
        if e.get('English', '').strip() != word and get_pos(e.get('English', '')) == correct_pos
    ]

    pool = same_pos if len(same_pos) >= 3 else [e for e in entries if e.get('English', '').strip() != word]
    wrong_options = random.sample(pool, min(3, len(pool)))
    wrong_words = [e.get('English', '').strip() for e in wrong_options if e.get('English', '').strip()]

    options = [word] + wrong_words
    random.shuffle(options)

    explanation_text = f'The best word for the blank is "{word}".'
    if 'ing' in word.lower() or 'ing' in example.lower():
        explanation_text += ' This item uses an -ing form.'
    elif 'to' in word.lower() or 'to' in example.lower():
        explanation_text += ' This item uses a "to" form.'

    return {
        'type': 'Grammar',
        'question': blanked,
        'choices': options,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'explanation_jp': explanation_text,
        'example_jp': example_jp,
        'example': example,
        'japanese': entry.get('Japanese', '').strip(),
    }


def _generate_conversation_question(entries):
    templates = [
        {
            'A': 'Are you feeling better?',
            'B': 'Yes, my headache has ______.',
            'answers': ['gone', 'disappeared'],
            'wrong': ['build', 'travel', 'open'],
            'word': 'gone',
        },
        {
            'A': "It's really sunny today.",
            'B': "Let's hang our towels outside to ______.",
            'answers': ['dry'],
            'wrong': ['run', 'eat', 'break'],
            'word': 'dry',
        },
        {
            'A': 'Why were you late?',
            'B': "I don't want to ______. The truth is I overslept.",
            'answers': ['make an excuse'],
            'wrong': ['have fun', 'take a break', 'go out'],
            'word': 'make an excuse',
        },
        {
            'A': 'Do you want to go shopping?',
            'B': '______',
            'answers': ["Sure, let's go!", 'That sounds great.', "I'd love to!"],
            'wrong': ['I ate a sandwich.', 'The door is open.', 'I have a pen.'],
            'word': "Sure, let's go!",
        },
    ]

    t = random.choice(templates)
    correct = random.choice(t['answers'])
    wrongs = random.sample(t['wrong'], min(3, len(t['wrong'])))
    choices = [correct] + wrongs
    random.shuffle(choices)

    return {
        'type': 'Conversation',
        'question': f'A: {t["A"]}\nB: {t["B"]}',
        'choices': choices,
        'correct': correct,
        'id': '',
        'word': t['word'],
    }


def _generate_reading_cloze_question(entries):
    entry = random.choice(entries)
    word = entry.get('English', '').strip()
    example = entry.get('Example_English', '').strip() or f'This sentence uses {word}.'
    example_jp = entry.get('Example_Japanese', '').strip()
    reading_text = f'{example} This is a common situation.'
    blanked = make_blank(reading_text, word)

    correct_pos = get_pos(word)
    same_pos = [
        e for e in entries
        if e.get('English', '').strip() != word and get_pos(e.get('English', '')) == correct_pos
    ]

    pool = same_pos if len(same_pos) >= 3 else [e for e in entries if e.get('English', '').strip() != word]
    wrong_options = random.sample(pool, min(3, len(pool)))
    wrong_words = [e.get('English', '').strip() for e in wrong_options if e.get('English', '').strip()]

    options = [word] + wrong_words
    random.shuffle(options)

    return {
        'type': 'Reading Cloze',
        'question': blanked,
        'choices': options,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'explanation_jp': f'The word "{word}" fits the passage best.',
        'example_jp': example_jp,
        'example': example,
        'japanese': entry.get('Japanese', '').strip(),
    }


def _question_schema():
    question_properties = {
        'type': {'type': 'string', 'enum': AI_QUESTION_TYPES},
        'question': {'type': 'string'},
        'choices': {
            'type': 'array',
            'items': {'type': 'string'},
            'minItems': 4,
            'maxItems': 4,
        },
        'correct': {'type': 'string'},
        'id': {'type': 'string'},
        'word': {'type': 'string'},
        'explanation_jp': {'type': 'string'},
        'example': {'type': 'string'},
        'example_jp': {'type': 'string'},
        'japanese': {'type': 'string'},
    }
    return {
        'type': 'object',
        'additionalProperties': False,
        'required': ['questions'],
        'properties': {
            'questions': {
                'type': 'array',
                'minItems': 20,
                'maxItems': 20,
                'items': {
                    'type': 'object',
                    'additionalProperties': False,
                    'required': list(question_properties.keys()),
                    'properties': question_properties,
                },
            }
        },
    }


def _extract_response_text(response_data):
    if response_data.get('output_text'):
        return response_data['output_text']

    text_parts = []
    for item in response_data.get('output', []):
        for content in item.get('content', []):
            if content.get('type') == 'output_text' and content.get('text'):
                text_parts.append(content['text'])
    return ''.join(text_parts)


def _normalize_ai_question(question):
    if not isinstance(question, dict):
        return None

    qtype = str(question.get('type', '')).strip()
    question_text = str(question.get('question', '')).strip()
    correct = str(question.get('correct', '')).strip()
    word = str(question.get('word', '')).strip()
    vocab_id = str(question.get('id', '')).strip()
    choices = [
        str(choice).strip()
        for choice in question.get('choices', [])
        if str(choice).strip()
    ]

    if qtype not in AI_QUESTION_TYPES or not question_text or not correct or not word:
        return None

    deduped_choices = []
    for choice in choices:
        if choice not in deduped_choices:
            deduped_choices.append(choice)
    if correct not in deduped_choices:
        deduped_choices.insert(0, correct)
    if len(deduped_choices) != 4:
        return None

    return {
        'type': qtype,
        'question': question_text,
        'choices': deduped_choices,
        'correct': correct,
        'id': vocab_id,
        'word': word,
        'explanation_jp': str(question.get('explanation_jp', '')).strip(),
        'example': str(question.get('example', '')).strip(),
        'example_jp': str(question.get('example_jp', '')).strip(),
        'japanese': str(question.get('japanese', '')).strip(),
        'source': 'ai',
    }


def _validate_ai_questions(data):
    normalized = []
    for question in data.get('questions', []) if isinstance(data, dict) else []:
        normalized_question = _normalize_ai_question(question)
        if normalized_question:
            normalized.append(normalized_question)
    if len(normalized) != 20:
        raise ValueError('AI response did not contain 20 valid questions')
    return normalized


def generate_ai_questions(entries, nonce=None):
    api_key = get_openai_api_key()
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY is not configured')

    usable_entries = [
        {
            'English': entry.get('English', '').strip(),
            'ID': entry.get('ID', '').strip(),
            'Japanese': entry.get('Japanese', '').strip(),
            'Example_English': entry.get('Example_English', '').strip(),
            'Example_Japanese': entry.get('Example_Japanese', '').strip(),
        }
        for entry in entries
        if entry.get('English', '').strip() and entry.get('Japanese', '').strip()
    ]
    if not usable_entries:
        return []

    sample_size = min(40, len(usable_entries))
    vocabulary_sample = random.sample(usable_entries, sample_size)
    prompt = {
        'task': 'Create an English learning practice set for a Japanese learner.',
        'fresh_set_id': nonce or datetime.datetime.now().isoformat(),
        'requirements': [
            'Return exactly 20 multiple-choice questions.',
            'Generate a fresh set for this request; vary the selected vocabulary, wording, and distractors.',
            'Create exactly 5 questions for each type: Vocabulary, Grammar, Conversation, Reading Cloze.',
            'Every question must use one vocabulary item from the provided list.',
            'Each question must have exactly 4 choices and exactly one correct answer.',
            'Include the vocabulary ID for each question in the id field.',
            'For Vocabulary questions, ask for the Japanese meaning and make correct the Japanese answer.',
            'For Grammar, Conversation, and Reading Cloze questions, make correct the English word or phrase.',
            'Keep Japanese explanations short and learner-friendly.',
            'Do not include markdown.',
        ],
        'vocabulary': vocabulary_sample,
    }

    model = get_openai_model()
    reasoning_effort = get_openai_reasoning_effort(model)
    body = {
        'model': model,
        'instructions': (
            'You are a careful Eiken-style English question writer. '
            'Use only the provided vocabulary. Output valid structured JSON only.'
        ),
        'input': json.dumps(prompt, ensure_ascii=False),
        'text': {
            'verbosity': 'low',
            'format': {
                'type': 'json_schema',
                'name': 'practice_questions',
                'strict': True,
                'schema': _question_schema(),
            },
        },
    }
    if reasoning_effort:
        body['reasoning'] = {'effort': reasoning_effort}

    timeout = int(os.getenv('OPENAI_TIMEOUT', '30'))
    req = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            response_data = json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode('utf-8', errors='replace')
        try:
            error_json = json.loads(error_body)
            message = error_json.get('error', {}).get('message') or error_body
        except Exception:
            message = error_body or str(exc)
        raise RuntimeError(f'OpenAI API returned {exc.code}: {message}') from exc

    response_text = _extract_response_text(response_data)
    if not response_text:
        raise ValueError('AI response did not include text output')
    return _validate_ai_questions(json.loads(response_text))


def load_question_entries(db_path=None):
    if db_path:
        return load_vocabulary_from_csv(db_path)
    return vocab_list


def generate_rule_questions(entries):
    if not entries:
        return []

    questions = []
    question_types = ['Vocabulary', 'Grammar', 'Conversation', 'Reading Cloze']
    generators = {
        'Vocabulary': _generate_vocabulary_question,
        'Grammar': _generate_grammar_question,
        'Conversation': _generate_conversation_question,
        'Reading Cloze': _generate_reading_cloze_question,
    }
    for qtype in question_types:
        for _ in range(5):
            question = generators[qtype](entries)
            if question:
                questions.append(question)
    return questions


def generate_20_questions(db_path=None):
    return generate_rule_questions(load_question_entries(db_path))


def get_child_review_entries(child_id, limit=20):
    init_db()
    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
        if not child_row:
            raise LookupError('child not found')
        rows = conn.execute(
            '''
            SELECT vocab_id, wrong_count, mastery, mastered, last_studied_at, updated_at
            FROM child_vocab_progress
            WHERE child_id = ? AND (mastered = 1 OR wrong_count > 0)
            ORDER BY wrong_count DESC, mastered DESC, last_studied_at DESC, id DESC
            LIMIT ?
            ''',
            (child_id, max(limit * 2, limit)),
        ).fetchall()
    finally:
        conn.close()

    combined = []
    seen = set()
    for row in rows:
        entry = resolve_vocab_entry(str(row['vocab_id']), vocab_list)
        if not entry:
            continue
        key = get_vocab_key(entry)
        if key and key not in seen:
            seen.add(key)
            combined.append(entry)

    if len(combined) < limit:
        remainder = [entry for entry in vocab_list if get_vocab_key(entry) not in seen]
        random.shuffle(remainder)
        combined.extend(remainder[: max(0, limit - len(combined))])

    return combined[:limit]


def get_today_review_entries(limit=20, child_id=None):
    if child_id is not None:
        return get_child_review_entries(child_id, limit=limit)

    progress = load_progress()
    mastered_words = [w.strip() for w in progress.get('mastered_words', []) if w.strip()]
    recent_words = mastered_words[-8:]

    try:
        review_list = get_review_list()
    except Exception:
        review_list = []

    wrong_words = [item.get('word', '').strip() for item in review_list if item.get('word', '').strip()]

    combined = []
    seen = set()

    def push_word(word):
        entry = resolve_vocab_entry(word, vocab_list)
        if not entry:
            return
        key = get_vocab_key(entry)
        if key and key not in seen:
            seen.add(key)
            combined.append(entry)

    for word in mastered_words[-20:]:
        push_word(word)
    for word in wrong_words:
        push_word(word)
    for word in recent_words:
        push_word(word)

    if len(combined) < limit:
        remainder = [entry for entry in vocab_list if get_vocab_key(entry) not in seen]
        random.shuffle(remainder)
        combined.extend(remainder[: max(0, limit - len(combined))])

    return combined[:limit]


def _build_review_choices(correct_value, entries, extractor, minimum_choices=4):
    options = []
    for entry in entries:
        value = _clean_csv_value(extractor(entry))
        if value and value != correct_value and value not in options:
            options.append(value)
    random.shuffle(options)
    choices = [correct_value] + options[: max(0, minimum_choices - 1)]
    while len(choices) < minimum_choices:
        filler = f'choice_{len(choices)}'
        if filler not in choices:
            choices.append(filler)
    random.shuffle(choices)
    return choices


def _build_stage_review_choices(correct_value, entries, extractor, rng, minimum_choices=4):
    correct = _clean_csv_value(correct_value)
    if not correct:
        return []
    options = []
    for entry in entries:
        value = _clean_csv_value(extractor(entry))
        if value and value != correct and value not in options:
            options.append(value)
    rng.shuffle(options)
    choices = [correct] + options[: max(0, minimum_choices - 1)]
    while len(choices) < minimum_choices:
        filler = f'choice_{len(choices)}'
        if filler not in choices:
            choices.append(filler)
    rng.shuffle(choices)
    return choices


def _generate_review_listening_question(entry, entries):
    word = entry.get('English', '').strip()
    japanese = entry.get('Japanese', '').strip()
    if not word or not japanese:
        return None
    choices = _build_review_choices(word, entries, lambda item: item.get('English', '').strip())
    return {
        'type': 'Listening',
        'question': 'Listen and choose the correct word.',
        'audio_text': word,
        'choices': choices,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'The word is "{word}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _generate_review_meaning_question(entry, entries):
    word = entry.get('English', '').strip()
    japanese = entry.get('Japanese', '').strip()
    if not word or not japanese:
        return None
    choices = _build_review_choices(japanese, entries, lambda item: item.get('Japanese', '').strip())
    return {
        'type': 'Meaning',
        'question': f'What does "{word}" mean?',
        'choices': choices,
        'correct': japanese,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'"{word}" means "{japanese}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _generate_review_reverse_question(entry, entries):
    word = entry.get('English', '').strip()
    japanese = entry.get('Japanese', '').strip()
    if not word or not japanese:
        return None
    choices = _build_review_choices(word, entries, lambda item: item.get('English', '').strip())
    return {
        'type': 'Reverse',
        'question': f'Choose the English word for "{japanese}".',
        'choices': choices,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'The correct English word is "{word}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _generate_review_cloze_question(entry, entries):
    word = entry.get('English', '').strip()
    example = entry.get('Example_English', '').strip()
    japanese = entry.get('Japanese', '').strip()
    if not word or not example:
        return None
    blanked = make_blank(example, word)
    choices = _build_review_choices(word, entries, lambda item: item.get('English', '').strip())
    return {
        'type': 'Cloze',
        'question': blanked,
        'choices': choices,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'The word "{word}" fits best here.',
        'example': example,
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _get_stage_entry_meaning(entry):
    return (
        entry.get('Japanese', '').strip()
        or entry.get('Chinese', '').strip()
        or entry.get('English', '').strip()
    )


def _generate_stage_review_listening_question(entry, entries, rng):
    word = entry.get('English', '').strip()
    if not word:
        return None
    japanese = _get_stage_entry_meaning(entry)
    choices = _build_stage_review_choices(word, entries, lambda item: item.get('English', '').strip(), rng)
    return {
        'type': 'Listening',
        'question': 'Listen and choose the correct word.',
        'audio_text': word,
        'choices': choices,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'The word is "{word}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _generate_stage_review_meaning_question(entry, entries, rng):
    word = entry.get('English', '').strip()
    japanese = _get_stage_entry_meaning(entry)
    if not word or not japanese:
        return None
    choices = _build_stage_review_choices(japanese, entries, _get_stage_entry_meaning, rng)
    return {
        'type': 'Meaning',
        'question': f'What does "{word}" mean?',
        'choices': choices,
        'correct': japanese,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'"{word}" means "{japanese}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _generate_stage_review_reverse_question(entry, entries, rng):
    word = entry.get('English', '').strip()
    japanese = _get_stage_entry_meaning(entry)
    if not word or not japanese:
        return None
    choices = _build_stage_review_choices(word, entries, lambda item: item.get('English', '').strip(), rng)
    return {
        'type': 'Reverse',
        'question': f'Choose the English word for "{japanese}".',
        'choices': choices,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'The correct English word is "{word}".',
        'example': entry.get('Example_English', '').strip(),
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def _generate_stage_review_cloze_question(entry, entries, rng):
    word = entry.get('English', '').strip()
    japanese = _get_stage_entry_meaning(entry)
    if not word:
        return None
    example = entry.get('Example_English', '').strip() or f'This sentence uses {word}.'
    blanked = make_blank(example, word)
    choices = _build_stage_review_choices(word, entries, lambda item: item.get('English', '').strip(), rng)
    return {
        'type': 'Cloze',
        'question': blanked,
        'choices': choices,
        'correct': word,
        'id': entry.get('ID', ''),
        'word': word,
        'japanese': japanese,
        'explanation_jp': f'The word "{word}" fits best here.',
        'example': example,
        'example_jp': entry.get('Example_Japanese', '').strip(),
    }


def generate_review_questions_from_entries(entries, limit=20):
    if not entries:
        return []

    questions = []
    generators = [
        ('Listening', _generate_review_listening_question),
        ('Meaning', _generate_review_meaning_question),
        ('Reverse', _generate_review_reverse_question),
        ('Cloze', _generate_review_cloze_question),
    ]
    pool = list(entries)

    for qtype, generator in generators:
        selected = list(pool)
        random.shuffle(selected)
        added = 0
        for entry in selected:
            if added >= 5:
                break
            question = generator(entry, entries)
            if question:
                questions.append(question)
                added += 1

    if len(questions) < 20:
        fallback_entries = list(entries)
        random.shuffle(fallback_entries)
        while len(questions) < 20 and fallback_entries:
            entry = fallback_entries.pop()
            for _, generator in generators:
                if len(questions) >= 20:
                    break
                question = generator(entry, entries)
                if question:
                    questions.append(question)

    return questions[:limit]


def generate_stage_review_questions_from_entries(entries, limit=20, seed=None):
    if not entries:
        return []

    stage_entries = list(entries)[:limit]
    rng = random.Random(seed) if seed else random
    rng.shuffle(stage_entries)
    generators = [
        _generate_stage_review_listening_question,
        _generate_stage_review_meaning_question,
        _generate_stage_review_reverse_question,
        _generate_stage_review_cloze_question,
    ]
    questions = []
    for index, generator in enumerate(generators):
        for entry in stage_entries[index * 5:(index + 1) * 5]:
            question = generator(entry, stage_entries, rng)
            if question:
                questions.append(question)
    return questions


def generate_today_review_questions(limit=20, child_id=None):
    entries = get_today_review_entries(limit=limit, child_id=child_id)
    return generate_review_questions_from_entries(entries, limit=limit)


def api_today_review_quiz_payload(child_id=None, world_id=None, stage=None, attempt_id=None):
    if child_id is None:
        progress = load_progress()
        target = int(load_settings().get('daily_target', 20) or 20)
        progress_count = int(progress.get('count') or len(progress.get('mastered_words', [])) or 0)
        return {
            'day': int(progress_count // max(1, target)) + 1 if progress_count else 1,
            'progress': progress_count,
            'target': target,
            'questions': generate_today_review_questions(),
        }
    has_stage_request = bool(world_id) or stage not in [None, '']
    stage_entries = select_stage_vocab_entries(world_id, stage, 20) if has_stage_request else None
    if has_stage_request and stage_entries is None:
        raise ValueError('valid world and stage are required')
    normalized_attempt_id = _clean_csv_value(attempt_id)
    stage_seed = (
        f'{child_id}:{str(world_id or "").strip().lower()}:{stage}:{normalized_attempt_id}'
        if stage_entries is not None and normalized_attempt_id
        else None
    )
    questions = (
        generate_stage_review_questions_from_entries(stage_entries, limit=20, seed=stage_seed)
        if stage_entries is not None
        else generate_today_review_questions(child_id=child_id)
    )
    conn = get_db_connection()
    try:
        child_row = conn.execute(
            'SELECT daily_target FROM children WHERE id = ?',
            (child_id,),
        ).fetchone()
        if not child_row:
            raise LookupError('child not found')
        mastered_row = conn.execute(
            'SELECT COUNT(*) AS count FROM child_vocab_progress WHERE child_id = ? AND mastered = 1',
            (child_id,),
        ).fetchone()
        daily_row = conn.execute(
            'SELECT studied_count FROM daily_study_log WHERE child_id = ? AND study_date = ?',
            (child_id, get_today()),
        ).fetchone()
    finally:
        conn.close()
    progress_count = int(daily_row['studied_count'] or 0) if daily_row else 0
    mastered_total = int(mastered_row['count'] or 0) if mastered_row else 0
    target = int(child_row['daily_target'] or 20)
    payload = {
        'day': int(progress_count // max(1, target)) + 1 if progress_count else 1,
        'progress': progress_count,
        'studied_today': progress_count,
        'mastered_total': mastered_total,
        'target': target,
        'questions': questions,
    }
    if stage_entries is not None:
        stage_progress = get_child_world_stage_progress(child_id, world_id, stage)
        payload.update(
            review_mode='stage',
            world=stage_progress['world'],
            stage=stage_progress['stage'],
            stage_status=stage_progress['status'],
            stage_cleared=stage_progress['cleared'],
        )
        if normalized_attempt_id:
            payload['attempt_id'] = normalized_attempt_id
    return payload


def get_default_child_id():
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id FROM children ORDER BY id ASC LIMIT 1').fetchone()
        return row['id'] if row else None
    finally:
        conn.close()


def calculateCaptureRate(correctCount, totalQuestions):
    try:
        correct = int(correctCount)
        total = int(totalQuestions)
    except (TypeError, ValueError):
        return 0.0
    if total <= 0:
        return 0.0
    if correct >= total:
        return 1.0
    if correct >= 4:
        return 0.9
    if correct >= 3:
        return 0.7
    if correct >= 2:
        return 0.4
    return 0.0


def _normalize_battle_level(target_level):
    value = (target_level or '').strip().lower()
    if '準2' in value or 'pre2' in value or 'pre-2' in value or value in ['b1', 'a2']:
        return 'eiken_pre2'
    return 'eiken_pre2'


def _battle_question_from_row(row, include_answer=False):
    question = {
        'id': row['id'],
        'level': row['level'],
        'category': row['category'],
        'questionText': row['question_text'],
        'choices': json.loads(row['choices_json'] or '[]'),
    }
    if include_answer:
        question['correctAnswer'] = row['correct_answer']
        question['explanation'] = row['explanation'] or ''
    return question


def _battle_monster_from_row(row, user_row=None):
    if row is None:
        return None
    monster = {
        'id': row['id'],
        'nameJa': row['name_ja'],
        'imageUrl': row['image_url'],
        'grammarCategory': row['grammar_category'],
        'maxHp': int(row['max_hp'] or 100),
        'rarity': row['rarity'],
        'captureBaseRate': float(row['capture_base_rate'] or 0.7),
        'grammarTip': row['grammar_tip'] or '',
        'captured': user_row is not None,
    }
    if user_row is not None:
        monster.update(
            userMonsterId=user_row['id'],
            capturedAt=user_row['captured_at'],
            level=int(user_row['level'] or 1),
            exp=int(user_row['exp'] or 0),
            sourceCategory=user_row['source_category'],
        )
    return monster


def _battle_session_from_row(row, monster=None, answered_count=None):
    if row is None:
        return None
    question_ids = json.loads(row['questions_json'] or '[]')
    return {
        'id': row['id'],
        'childId': row['child_id'],
        'monsterId': row['monster_id'],
        'questions': question_ids,
        'currentQuestionIndex': int(row['current_question_index'] or 0),
        'correctCount': int(row['correct_count'] or 0),
        'wrongCount': int(row['wrong_count'] or 0),
        'monsterHp': int(row['monster_hp'] or 0),
        'maxHp': int(row['max_hp'] or 100),
        'status': row['status'],
        'answeredCount': answered_count if answered_count is not None else int(row['current_question_index'] or 0),
        'monster': monster,
    }


def start_battle_session(child_id=None, level=None):
    if child_id in [None, '', 'null']:
        child_id = get_default_child_id()
    try:
        child_id = int(child_id)
    except (TypeError, ValueError):
        raise ValueError('child_id must be an integer')
    if child_id is None:
        raise ValueError('child profile is required')

    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id, target_level FROM children WHERE id = ?', (child_id,)).fetchone()
        if not child_row:
            raise LookupError('child not found')
        normalized_level = _normalize_battle_level(level or child_row['target_level'])
        question_rows = conn.execute(
            '''
            SELECT id, level, category, question_text, choices_json, correct_answer, explanation
            FROM grammar_questions
            WHERE level = ?
            ORDER BY RANDOM()
            LIMIT 5
            ''',
            (normalized_level,),
        ).fetchall()
        if len(question_rows) < 5:
            raise LookupError('not enough battle questions')
        dominant_category = question_rows[0]['category']
        monster_row = conn.execute(
            '''
            SELECT id, name_ja, image_url, grammar_category, max_hp, rarity, capture_base_rate, grammar_tip
            FROM wild_monsters
            WHERE grammar_category = ?
            ORDER BY RANDOM()
            LIMIT 1
            ''',
            (dominant_category,),
        ).fetchone()
        if not monster_row:
            monster_row = conn.execute(
                '''
                SELECT id, name_ja, image_url, grammar_category, max_hp, rarity, capture_base_rate, grammar_tip
                FROM wild_monsters
                ORDER BY RANDOM()
                LIMIT 1
                '''
            ).fetchone()
        if not monster_row:
            raise LookupError('wild monster not found')
        attempt_id = f'BATTLE_{uuid.uuid4().hex[:12].upper()}'
        question_ids = [row['id'] for row in question_rows]
        max_hp = int(monster_row['max_hp'] or 100)
        conn.execute(
            '''
            INSERT INTO battle_sessions (
                id, child_id, monster_id, questions_json, current_question_index,
                correct_count, wrong_count, monster_hp, max_hp, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ''',
            (attempt_id, child_id, monster_row['id'], json.dumps(question_ids), max_hp, max_hp),
        )
        conn.commit()
        questions = [_battle_question_from_row(row, include_answer=False) for row in question_rows]
        return {
            'battleSession': _battle_session_from_row(
                conn.execute('SELECT * FROM battle_sessions WHERE id = ?', (attempt_id,)).fetchone(),
                monster=_battle_monster_from_row(monster_row),
                answered_count=0,
            ),
            'monster': _battle_monster_from_row(monster_row),
            'questions': questions,
        }
    finally:
        conn.close()


def submit_battle_answer(session_id, question_id, selected_answer):
    selected_answer = (selected_answer or '').strip()
    conn = get_db_connection()
    try:
        session = conn.execute('SELECT * FROM battle_sessions WHERE id = ?', (session_id,)).fetchone()
        if not session:
            raise LookupError('battle session not found')
        if session['status'] not in ['in_progress', 'capture_ready']:
            raise ValueError('battle session is already finished')
        question_ids = json.loads(session['questions_json'] or '[]')
        if question_id not in question_ids:
            raise ValueError('question_id is not in this battle session')
        question = conn.execute(
            'SELECT id, level, category, question_text, choices_json, correct_answer, explanation FROM grammar_questions WHERE id = ?',
            (question_id,),
        ).fetchone()
        if not question:
            raise LookupError('question not found')

        existing = conn.execute(
            '''
            SELECT id, is_correct, selected_answer
            FROM battle_answer_results
            WHERE battle_session_id = ? AND question_id = ?
            ''',
            (session_id, question_id),
        ).fetchone()
        if existing:
            is_correct = bool(existing['is_correct'])
            selected_answer = existing['selected_answer'] or ''
        else:
            is_correct = bool(selected_answer) and selected_answer == question['correct_answer']
            now = get_now_iso()
            conn.execute(
                '''
                INSERT INTO battle_answer_results (
                    question_id, selected_answer, is_correct, answered_at, battle_session_id
                ) VALUES (?, ?, ?, ?, ?)
                ''',
                (question_id, selected_answer, 1 if is_correct else 0, now, session_id),
            )
            if not is_correct:
                conn.execute(
                    '''
                    INSERT INTO grammar_wrong_questions (child_id, question_id, category, wrong_at, mastered)
                    VALUES (?, ?, ?, ?, 0)
                    ''',
                    (session['child_id'], question_id, question['category'], now),
                )

            answer_rows = conn.execute(
                'SELECT is_correct FROM battle_answer_results WHERE battle_session_id = ?',
                (session_id,),
            ).fetchall()
            correct_count = sum(1 for row in answer_rows if row['is_correct'])
            wrong_count = len(answer_rows) - correct_count
            monster_hp = max(0, int(session['max_hp'] or 100) - correct_count * 20)
            next_index = min(len(question_ids), len(answer_rows))
            status = 'in_progress'
            if len(answer_rows) >= len(question_ids):
                status = 'capture_ready' if monster_hp <= 0 else 'finished'
            conn.execute(
                '''
                UPDATE battle_sessions
                SET current_question_index = ?, correct_count = ?, wrong_count = ?,
                    monster_hp = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (next_index, correct_count, wrong_count, monster_hp, status, session_id),
            )
            conn.commit()

        session = conn.execute('SELECT * FROM battle_sessions WHERE id = ?', (session_id,)).fetchone()
        answered_count = conn.execute(
            'SELECT COUNT(*) AS count FROM battle_answer_results WHERE battle_session_id = ?',
            (session_id,),
        ).fetchone()['count']
        return {
            'questionId': question_id,
            'selectedAnswer': selected_answer,
            'isCorrect': is_correct,
            'correctAnswer': question['correct_answer'],
            'explanation': question['explanation'] or '',
            'battleSession': _battle_session_from_row(session, answered_count=answered_count),
        }
    finally:
        conn.close()


def capture_battle_monster(session_id):
    conn = get_db_connection()
    try:
        session = conn.execute('SELECT * FROM battle_sessions WHERE id = ?', (session_id,)).fetchone()
        if not session:
            raise LookupError('battle session not found')
        if session['status'] not in ['capture_ready', 'captured', 'escaped']:
            raise ValueError('monster is not ready to capture')
        monster_row = conn.execute(
            'SELECT id, name_ja, image_url, grammar_category, max_hp, rarity, capture_base_rate, grammar_tip FROM wild_monsters WHERE id = ?',
            (session['monster_id'],),
        ).fetchone()
        rate = calculateCaptureRate(session['correct_count'], len(json.loads(session['questions_json'] or '[]')))
        if session['status'] == 'captured':
            success = True
        elif session['status'] == 'escaped':
            success = False
        else:
            success = random.random() <= rate
            next_status = 'captured' if success else 'escaped'
            conn.execute(
                'UPDATE battle_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (next_status, session_id),
            )
            if success:
                now = get_now_iso()
                conn.execute(
                    '''
                    INSERT INTO user_monsters (child_id, monster_id, captured_at, level, exp, source_category)
                    VALUES (?, ?, ?, 1, 0, ?)
                    ON CONFLICT(child_id, monster_id) DO UPDATE SET
                        exp = user_monsters.exp + 10,
                        level = CASE WHEN user_monsters.exp + 10 >= user_monsters.level * 100 THEN user_monsters.level + 1 ELSE user_monsters.level END
                    ''',
                    (session['child_id'], session['monster_id'], now, monster_row['grammar_category'] if monster_row else None),
                )
            conn.commit()
            session = conn.execute('SELECT * FROM battle_sessions WHERE id = ?', (session_id,)).fetchone()
        user_row = conn.execute(
            'SELECT * FROM user_monsters WHERE child_id = ? AND monster_id = ?',
            (session['child_id'], session['monster_id']),
        ).fetchone()
        return {
            'success': success,
            'captureRate': rate,
            'battleSession': _battle_session_from_row(session),
            'monster': _battle_monster_from_row(monster_row, user_row=user_row),
        }
    finally:
        conn.close()


def get_battle_monster_collection(child_id=None):
    if child_id in [None, '', 'null']:
        child_id = get_default_child_id()
    try:
        child_id = int(child_id)
    except (TypeError, ValueError):
        raise ValueError('child_id must be an integer')
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT wm.*, um.id AS user_monster_id, um.captured_at, um.level, um.exp, um.source_category
            FROM wild_monsters AS wm
            LEFT JOIN user_monsters AS um ON um.monster_id = wm.id AND um.child_id = ?
            ORDER BY wm.grammar_category ASC, wm.name_ja ASC
            ''',
            (child_id,),
        ).fetchall()
        monsters = []
        for row in rows:
            user_row = None
            if row['user_monster_id']:
                user_row = {
                    'id': row['user_monster_id'],
                    'captured_at': row['captured_at'],
                    'level': row['level'],
                    'exp': row['exp'],
                    'source_category': row['source_category'],
                }
            monsters.append(_battle_monster_from_row(row, user_row=user_row))
        return {'childId': child_id, 'monsters': monsters}
    finally:
        conn.close()


def get_battle_wrong_questions(child_id=None):
    if child_id in [None, '', 'null']:
        child_id = get_default_child_id()
    try:
        child_id = int(child_id)
    except (TypeError, ValueError):
        raise ValueError('child_id must be an integer')
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT gw.id AS wrong_id, gw.wrong_at, gw.mastered, gw.mastered_at,
                   q.id, q.level, q.category, q.question_text, q.choices_json, q.correct_answer, q.explanation
            FROM grammar_wrong_questions AS gw
            JOIN grammar_questions AS q ON q.id = gw.question_id
            WHERE gw.child_id = ? AND gw.mastered = 0
            ORDER BY gw.wrong_at DESC
            LIMIT 50
            ''',
            (child_id,),
        ).fetchall()
        items = []
        for row in rows:
            question = _battle_question_from_row(row, include_answer=True)
            question['wrongId'] = row['wrong_id']
            question['wrongAt'] = row['wrong_at']
            question['mastered'] = bool(row['mastered'])
            question['masteredAt'] = row['mastered_at']
            items.append(question)
        return {'childId': child_id, 'wrongQuestions': items}
    finally:
        conn.close()


def master_battle_wrong_question(wrong_id):
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id, child_id FROM grammar_wrong_questions WHERE id = ?', (wrong_id,)).fetchone()
        if not row:
            raise LookupError('wrong question not found')
        conn.execute(
            'UPDATE grammar_wrong_questions SET mastered = 1, mastered_at = ? WHERE id = ?',
            (get_now_iso(), wrong_id),
        )
        conn.execute(
            '''
            UPDATE user_monsters
            SET exp = exp + 5,
                level = CASE WHEN exp + 5 >= level * 100 THEN level + 1 ELSE level END
            WHERE id = (
                SELECT id FROM user_monsters WHERE child_id = ? ORDER BY captured_at DESC LIMIT 1
            )
            ''',
            (row['child_id'],),
        )
        conn.commit()
        return {'mastered': True, 'wrongId': int(wrong_id), 'expAwarded': 5}
    finally:
        conn.close()

def get_grammar_lesson_db_connection():
    return get_db_connection()


def get_grammar_form_test_db_connection():
    return get_db_connection()

""" def get_grammar_lesson_db_connection():
    path = data_path(GRAMMAR_LESSON_DB_FILENAME)
    if not os.path.exists(path):
        raise FileNotFoundError('grammar lesson database not found')
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def get_grammar_form_test_db_connection():
    path = data_path(GRAMMAR_FORM_TEST_DB_FILENAME)
    if not os.path.exists(path):
        raise FileNotFoundError('grammar form test database not found')
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn """


def require_child_id(value):
    if value in [None, '', 'null']:
        raise ValueError('child_id is required')
    try:
        child_id = int(value)
    except (TypeError, ValueError):
        raise ValueError('child_id must be an integer')
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
    finally:
        conn.close()
    if not row:
        raise LookupError('child not found')
    return child_id


def _grammar_form_test_payload(row, include_answer=False, progress=None):
    choices = [row['choice_a'], row['choice_b'], row['choice_c'], row['choice_d']]
    payload = {
        'testId': row['test_id'],
        'lessonId': row['lesson_id'],
        'category': row['category'],
        'title': row['title'],
        'targetGrammar': row['target_grammar'],
        'baseWord': row['base_word'],
        'questionJp': row['question_jp'],
        'promptEn': row['prompt_en'],
        'choices': choices,
        'skillFocus': row['skill_focus'],
        'difficulty': int(row['difficulty'] or 2),
    }
    if include_answer:
        answer_index = int(row['answer_index'])
        explanations = [
            row['choice_a_explanation_jp'],
            row['choice_b_explanation_jp'],
            row['choice_c_explanation_jp'],
            row['choice_d_explanation_jp'],
        ]
        payload.update({
            'answerIndex': answer_index,
            'correctAnswer': choices[answer_index],
            'fullAnswer': row['full_answer'],
            'correctReasonJp': row['correct_reason_jp'],
            'choiceExplanations': explanations,
        })
    if progress:
        payload['progress'] = {
            'attemptCount': int(progress['attempt_count'] or 0),
            'correctCount': int(progress['correct_count'] or 0),
            'wrongCount': int(progress['wrong_count'] or 0),
            'mastered': bool(progress['mastered']),
            'lastAttemptedAt': progress['last_attempted_at'],
        }
    return payload


def get_child_learned_grammar_lesson_ids(child_id):
    child_id = require_child_id(child_id)
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT lesson_id
            FROM child_grammar_progress
            WHERE child_id = ?
              AND view_count > 0
              AND status IN ('learning', 'mastered')
            ORDER BY last_studied_at ASC, lesson_id ASC
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    return [row['lesson_id'] for row in rows]


def get_grammar_form_practice(child_id, limit=5, lesson_id=None):
    child_id = require_child_id(child_id)
    learned_lesson_ids = get_child_learned_grammar_lesson_ids(child_id)
    if not learned_lesson_ids:
        raise LookupError('まず文法レッスンを学習しましょう。')
    selected_lesson_id = str(lesson_id or '').strip()
    if selected_lesson_id and selected_lesson_id not in learned_lesson_ids:
        raise ValueError('この文法はまだ学習していません。')
    try:
        limit = max(1, min(5, int(limit or 5)))
    except (TypeError, ValueError):
        limit = 5

    form_conn = get_grammar_form_test_db_connection()
    try:
        if selected_lesson_id:
            rows = form_conn.execute(
                '''
                SELECT *
                FROM grammar_form_test_items
                WHERE is_active = 1 AND lesson_id = ?
                ''',
                (selected_lesson_id,),
            ).fetchall()
        else:
            placeholders = ','.join('?' for _ in learned_lesson_ids)
            rows = form_conn.execute(
                f'''
                SELECT *
                FROM grammar_form_test_items
                WHERE is_active = 1 AND lesson_id IN ({placeholders})
                ''',
                learned_lesson_ids,
            ).fetchall()
    finally:
        form_conn.close()
    if not rows:
        raise LookupError('学習済みの文法から出せる練習問題がまだありません。')
    selected_rows = random.sample(rows, min(limit, len(rows)))
    return {
        'childId': child_id,
        'lessonId': selected_lesson_id or None,
        'learnedLessonCount': len(learned_lesson_ids),
        'questions': [_grammar_form_test_payload(row) for row in selected_rows],
    }


def submit_grammar_form_practice_answer(child_id, test_id, selected_index):
    child_id = require_child_id(child_id)
    try:
        selected_index = int(selected_index)
    except (TypeError, ValueError):
        raise ValueError('selected_index must be an integer')

    form_conn = get_grammar_form_test_db_connection()
    try:
        row = form_conn.execute(
            'SELECT * FROM grammar_form_test_items WHERE test_id = ? AND is_active = 1',
            (test_id,),
        ).fetchone()
    finally:
        form_conn.close()
    if not row:
        raise LookupError('grammar form test not found')
    learned_lesson_ids = set(get_child_learned_grammar_lesson_ids(child_id))
    if row['lesson_id'] not in learned_lesson_ids:
        raise ValueError('この文法はまだ学習していません。')

    correct_index = int(row['answer_index'])
    is_correct = selected_index == correct_index
    now = get_now_iso()
    conn = get_db_connection()
    try:
        conn.execute(
            '''
            INSERT INTO child_grammar_form_test_attempts (child_id, test_id, lesson_id, selected_index, is_correct, attempted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (child_id, test_id, row['lesson_id'], selected_index, 1 if is_correct else 0, now),
        )
        conn.execute(
            '''
            INSERT INTO child_grammar_form_test_progress (
                child_id, test_id, lesson_id, attempt_count, correct_count, wrong_count,
                last_selected_index, last_is_correct, last_attempted_at, mastered, created_at, updated_at
            )
            VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(child_id, test_id) DO UPDATE SET
                attempt_count = child_grammar_form_test_progress.attempt_count + 1,
                correct_count = child_grammar_form_test_progress.correct_count + excluded.correct_count,
                wrong_count = child_grammar_form_test_progress.wrong_count + excluded.wrong_count,
                last_selected_index = excluded.last_selected_index,
                last_is_correct = excluded.last_is_correct,
                last_attempted_at = excluded.last_attempted_at,
                mastered = CASE WHEN excluded.mastered = 1 THEN 1 ELSE child_grammar_form_test_progress.mastered END,
                updated_at = CURRENT_TIMESTAMP
            ''',
            (
                child_id,
                test_id,
                row['lesson_id'],
                1 if is_correct else 0,
                0 if is_correct else 1,
                selected_index,
                1 if is_correct else 0,
                now,
                1 if is_correct else 0,
            ),
        )
        if is_correct:
            mark_child_grammar_lesson_mastered(conn, child_id, row['lesson_id'], now)
        conn.commit()
    finally:
        conn.close()

    choices = [row['choice_a'], row['choice_b'], row['choice_c'], row['choice_d']]
    explanations = [
        row['choice_a_explanation_jp'],
        row['choice_b_explanation_jp'],
        row['choice_c_explanation_jp'],
        row['choice_d_explanation_jp'],
    ]
    return {
        'childId': child_id,
        'testId': test_id,
        'lessonId': row['lesson_id'],
        'isCorrect': is_correct,
        'selectedIndex': selected_index,
        'correctIndex': correct_index,
        'selectedAnswer': choices[selected_index] if 0 <= selected_index < len(choices) else '',
        'correctAnswer': choices[correct_index],
        'fullAnswer': row['full_answer'],
        'correctReasonJp': row['correct_reason_jp'],
        'selectedExplanationJp': explanations[selected_index] if 0 <= selected_index < len(explanations) else '',
        'choiceExplanations': explanations,
    }


def get_grammar_form_wrong_questions(child_id):
    child_id = require_child_id(child_id)
    conn = get_db_connection()
    try:
        progress_rows = conn.execute(
            '''
            SELECT test_id, lesson_id, attempt_count, correct_count, wrong_count, mastered, last_attempted_at
            FROM child_grammar_form_test_progress
            WHERE child_id = ? AND wrong_count > 0 AND mastered = 0
            ORDER BY wrong_count DESC, last_attempted_at DESC
            LIMIT 50
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    if not progress_rows:
        return {'childId': child_id, 'wrongQuestions': []}

    progress_by_id = {row['test_id']: row for row in progress_rows}
    form_conn = get_grammar_form_test_db_connection()
    try:
        placeholders = ','.join('?' for _ in progress_by_id)
        rows = form_conn.execute(
            f'SELECT * FROM grammar_form_test_items WHERE test_id IN ({placeholders})',
            list(progress_by_id.keys()),
        ).fetchall()
    finally:
        form_conn.close()
    items = [
        _grammar_form_test_payload(row, include_answer=True, progress=progress_by_id.get(row['test_id']))
        for row in rows
    ]
    items.sort(key=lambda item: (-(item.get('progress', {}).get('wrongCount') or 0), item['testId']))
    return {'childId': child_id, 'wrongQuestions': items}


def master_grammar_form_wrong_question(child_id, test_id):
    child_id = require_child_id(child_id)
    conn = get_db_connection()
    try:
        row = conn.execute(
            'SELECT test_id FROM child_grammar_form_test_progress WHERE child_id = ? AND test_id = ?',
            (child_id, test_id),
        ).fetchone()
        if not row:
            raise LookupError('grammar form wrong question not found')
        conn.execute(
            '''
            UPDATE child_grammar_form_test_progress
            SET mastered = 1, updated_at = CURRENT_TIMESTAMP
            WHERE child_id = ? AND test_id = ?
            ''',
            (child_id, test_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {'childId': child_id, 'testId': test_id, 'mastered': True}


def _grammar_progress_map(child_id):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT lesson_id, status, view_count, correct_count, wrong_count, last_score, mastered_at, last_studied_at
            FROM child_grammar_progress
            WHERE child_id = ?
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    return {row['lesson_id']: row for row in rows}


def _grammar_progress_payload(row=None):
    if not row:
        return {
            'status': 'not_started',
            'viewCount': 0,
            'correctCount': 0,
            'wrongCount': 0,
            'lastScore': 0,
            'masteredAt': None,
            'lastStudiedAt': None,
        }
    return {
        'status': row['status'] or 'not_started',
        'viewCount': int(row['view_count'] or 0),
        'correctCount': int(row['correct_count'] or 0),
        'wrongCount': int(row['wrong_count'] or 0),
        'lastScore': int(row['last_score'] or 0),
        'masteredAt': row['mastered_at'],
        'lastStudiedAt': row['last_studied_at'],
    }


def _grammar_progress_for_lesson(progress=None, quiz_count=0, correct_quiz_count=0):
    payload = _grammar_progress_payload(progress)
    total = int(quiz_count or 0)
    solved = int(correct_quiz_count or 0)
    if total > 0:
        payload['lastScore'] = round((solved / total) * 100)
        payload['correctQuizCount'] = solved
        payload['totalQuizCount'] = total
        if solved >= total:
            payload['status'] = 'mastered'
    else:
        payload['correctQuizCount'] = solved
        payload['totalQuizCount'] = total
    return payload


def _grammar_lesson_payload(row, progress=None, quiz_count=0, correct_quiz_count=0):
    return {
        'lessonId': row['lesson_id'],
        'level': row['level'],
        'category': row['category'],
        'title': row['title'],
        """ 'grammarPoint': row['grammar_point'], """
        'grammarPoint': _row_value(row, 'grammar_point') or _row_value(row, 'target_grammar') or '',
       """  'jpExplanation': row['jp_explanation'], """
        'jpExplanation':_row_value(row, 'jp_explanation') or _row_value(row, 'explanation_ja') or '',
        'jpExample': row['jp_example'],
        'enExample': row['en_example'],
        'learningGoal': row['learning_goal'] or '',
        'displayOrder': int(row['display_order'] or 0),
        'quizCount': int(quiz_count or 0),
        'progress': _grammar_progress_for_lesson(progress, quiz_count, correct_quiz_count),
    }


def _sqlite_table_columns(conn, table_name):
    return {row['name'] for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()}


def _grammar_quiz_order_sql(conn):
    columns = _sqlite_table_columns(conn, 'grammar_quizzes')
    return 'quiz_order ASC, quiz_id ASC' if 'quiz_order' in columns else 'quiz_id ASC'


def get_grammar_id_for_lesson(lesson_id):
    lesson_id = str(lesson_id or '').strip()
    if not lesson_id:
        raise ValueError('lesson_id is required')

    lesson_conn = get_grammar_lesson_db_connection()
    try:
        lesson_columns = _sqlite_table_columns(lesson_conn, 'grammar_lessons')
        if 'grammar_id' in lesson_columns:
            grammar_id_column = 'grammar_id'
        elif 'display_order' in lesson_columns:
            grammar_id_column = 'display_order'
        else:
            raise LookupError('grammar_id mapping not found')

        row = lesson_conn.execute(
            f'''
            SELECT {grammar_id_column} AS grammar_id
            FROM grammar_lessons
            WHERE lesson_id = ?
            ''',
            (lesson_id,),
        ).fetchone()
    finally:
        lesson_conn.close()

    if not row:
        raise LookupError('grammar lesson not found')
    grammar_id = row['grammar_id']
    if grammar_id in [None, '']:
        raise LookupError('grammar_id mapping not found')
    return int(grammar_id)


def _find_child_grammar_progress_row(conn, child_id, lesson_id, grammar_id, progress_columns):
    if 'grammar_id' in progress_columns:
        return conn.execute(
            '''
            SELECT child_id
            FROM child_grammar_progress
            WHERE child_id = ? AND (lesson_id = ? OR grammar_id = ?)
            LIMIT 1
            ''',
            (child_id, lesson_id, grammar_id),
        ).fetchone()
    return conn.execute(
        '''
        SELECT child_id
        FROM child_grammar_progress
        WHERE child_id = ? AND lesson_id = ?
        LIMIT 1
        ''',
        (child_id, lesson_id),
    ).fetchone()


def mark_child_grammar_lesson_mastered(conn, child_id, lesson_id, now):
    grammar_id = get_grammar_id_for_lesson(lesson_id)
    progress_columns = _sqlite_table_columns(conn, 'child_grammar_progress')
    if 'grammar_id' in progress_columns:
        existing = _find_child_grammar_progress_row(conn, child_id, lesson_id, grammar_id, progress_columns)
        if existing:
            conn.execute(
                '''
                UPDATE child_grammar_progress
                SET grammar_id = ?,
                    lesson_id = ?,
                    status = 'mastered',
                    last_score = 100,
                    mastered_at = COALESCE(mastered_at, ?),
                    last_studied_at = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE child_id = ? AND (lesson_id = ? OR grammar_id = ?)
                ''',
                (grammar_id, lesson_id, now, now, child_id, lesson_id, grammar_id),
            )
        else:
            conn.execute(
                '''
                INSERT INTO child_grammar_progress (
                    child_id, grammar_id, lesson_id, status, view_count, last_score,
                    mastered_at, last_studied_at, created_at, updated_at
                )
                VALUES (?, ?, ?, 'mastered', 1, 100, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ''',
                (child_id, grammar_id, lesson_id, now, now),
            )
    else:
        conn.execute(
            '''
            INSERT INTO child_grammar_progress (
                child_id, lesson_id, status, view_count, last_score,
                mastered_at, last_studied_at, created_at, updated_at
            )
            VALUES (?, ?, 'mastered', 1, 100, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(child_id, lesson_id) DO UPDATE SET
                status = 'mastered',
                last_score = 100,
                mastered_at = COALESCE(child_grammar_progress.mastered_at, excluded.mastered_at),
                last_studied_at = excluded.last_studied_at,
                updated_at = CURRENT_TIMESTAMP
            ''',
            (child_id, lesson_id, now, now),
        )


def _grammar_correct_quiz_count_map(child_id):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT lesson_id, COUNT(DISTINCT quiz_id) AS count
            FROM child_grammar_quiz_attempts
            WHERE child_id = ? AND is_correct = 1
            GROUP BY lesson_id
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    return {row['lesson_id']: int(row['count'] or 0) for row in rows}


def get_grammar_lessons_for_child(child_id):
    child_id = require_child_id(child_id)
    progress_by_lesson = _grammar_progress_map(child_id)
    correct_counts = _grammar_correct_quiz_count_map(child_id)
    lesson_conn = get_grammar_lesson_db_connection()
    try:
        lesson_columns = _sqlite_table_columns(lesson_conn, 'grammar_lessons')

        where_sql = 'WHERE l.is_active = 1' if 'is_active' in lesson_columns else ''
        order_sql = 'l.display_order ASC, l.lesson_id ASC' if 'display_order' in lesson_columns else 'l.lesson_id ASC'

        rows = lesson_conn.execute(
            f'''
            SELECT l.*,
                (SELECT COUNT(*) FROM grammar_quizzes q WHERE q.lesson_id = l.lesson_id) AS quiz_count
            FROM grammar_lessons l
            {where_sql}
            ORDER BY {order_sql}
            '''
        ).fetchall()
    finally:
        lesson_conn.close()

    lessons = [
        _grammar_lesson_payload(
            row,
            progress_by_lesson.get(row['lesson_id']),
            row['quiz_count'],
            correct_counts.get(row['lesson_id'], 0),
        )
        for row in rows
    ]
    mastered_count = sum(1 for lesson in lessons if lesson['progress']['status'] == 'mastered')
    learning_count = sum(1 for lesson in lessons if lesson['progress']['status'] == 'learning')
    today_lesson = next(
        (lesson for lesson in lessons if lesson['progress']['status'] != 'mastered'),
        lessons[0] if lessons else None,
    )
    return {
        'childId': child_id,
        'lessons': lessons,
        'todayLesson': today_lesson,
        'stats': {
            'total': len(lessons),
            'mastered': mastered_count,
            'learning': learning_count,
            'remaining': max(0, len(lessons) - mastered_count),
            'dailyTarget': 1,
        },
    }


def get_grammar_lesson_detail(child_id, lesson_id):
    child_id = require_child_id(child_id)
    progress_by_lesson = _grammar_progress_map(child_id)
    correct_counts = _grammar_correct_quiz_count_map(child_id)
    lesson_conn = get_grammar_lesson_db_connection()
    try:
        row = lesson_conn.execute(
            '''
            SELECT l.*,
                   (SELECT COUNT(*) FROM grammar_quizzes q WHERE q.lesson_id = l.lesson_id) AS quiz_count
            FROM grammar_lessons l
            WHERE l.lesson_id = ? AND l.is_active = 1
            ''',
            (lesson_id,),
        ).fetchone()
        if not row:
            raise LookupError('grammar lesson not found')
        quiz_order_sql = _grammar_quiz_order_sql(lesson_conn)
        quiz_rows = lesson_conn.execute(
            '''
            SELECT quiz_id, lesson_id, question_jp, choice_a, choice_b, choice_c, choice_d, difficulty
            FROM grammar_quizzes
            WHERE lesson_id = ?
            ORDER BY ''' + quiz_order_sql,
            (lesson_id,),
        ).fetchall()
    finally:
        lesson_conn.close()
    lesson = _grammar_lesson_payload(
        row,
        progress_by_lesson.get(row['lesson_id']),
        row['quiz_count'],
        correct_counts.get(row['lesson_id'], 0),
    )
    lesson['quizzes'] = [
        {
            'quizId': quiz['quiz_id'],
            'lessonId': quiz['lesson_id'],
            'questionJp': quiz['question_jp'],
            'choices': [quiz['choice_a'], quiz['choice_b'], quiz['choice_c'], quiz['choice_d']],
            'difficulty': int(quiz['difficulty'] or 2),
        }
        for quiz in quiz_rows
    ]
    return {'childId': child_id, 'lesson': lesson}


def mark_grammar_lesson_viewed(child_id, lesson_id):
    child_id = require_child_id(child_id)
    grammar_id = get_grammar_id_for_lesson(lesson_id)
    now = get_now_iso()
    conn = get_db_connection()
    try:
        progress_columns = _sqlite_table_columns(conn, 'child_grammar_progress')
        if 'grammar_id' in progress_columns:
            existing = _find_child_grammar_progress_row(conn, child_id, lesson_id, grammar_id, progress_columns)
            if existing:
                conn.execute(
                    '''
                    UPDATE child_grammar_progress
                    SET grammar_id = ?,
                        lesson_id = ?,
                        status = CASE
                            WHEN status = 'mastered' THEN 'mastered'
                            ELSE 'learning'
                        END,
                        view_count = view_count + 1,
                        last_studied_at = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE child_id = ? AND (lesson_id = ? OR grammar_id = ?)
                    ''',
                    (grammar_id, lesson_id, now, child_id, lesson_id, grammar_id),
                )
            else:
                conn.execute(
                    '''
                    INSERT INTO child_grammar_progress (
                        child_id, grammar_id, lesson_id, status, view_count, last_studied_at, created_at, updated_at
                    )
                    VALUES (?, ?, ?, 'learning', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''',
                    (child_id, grammar_id, lesson_id, now),
                )
        else:
            conn.execute(
                '''
                INSERT INTO child_grammar_progress (
                    child_id, lesson_id, status, view_count, last_studied_at, created_at, updated_at
                )
                VALUES (?, ?, 'learning', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(child_id, lesson_id) DO UPDATE SET
                    status = CASE
                        WHEN child_grammar_progress.status = 'mastered' THEN 'mastered'
                        ELSE 'learning'
                    END,
                    view_count = child_grammar_progress.view_count + 1,
                    last_studied_at = excluded.last_studied_at,
                    updated_at = CURRENT_TIMESTAMP
                ''',
                (child_id, lesson_id, now),
            )
        conn.commit()
    finally:
        conn.close()
    return get_grammar_lesson_detail(child_id, lesson_id)


def submit_grammar_quiz_answer(child_id, quiz_id, selected_index):
    child_id = require_child_id(child_id)
    try:
        selected_index = int(selected_index)
    except (TypeError, ValueError):
        raise ValueError('selected_index must be an integer')
    lesson_conn = get_grammar_lesson_db_connection()
    try:
        quiz = lesson_conn.execute(
            '''
            SELECT quiz_id, lesson_id, answer_index, explanation_jp
            FROM grammar_quizzes
            WHERE quiz_id = ?
            ''',
            (quiz_id,),
        ).fetchone()
        if not quiz:
            raise LookupError('grammar quiz not found')
        total_quizzes = int(lesson_conn.execute(
            'SELECT COUNT(*) AS count FROM grammar_quizzes WHERE lesson_id = ?',
            (quiz['lesson_id'],),
        ).fetchone()['count'] or 0)
    finally:
        lesson_conn.close()

    correct_index = int(quiz['answer_index'])
    is_correct = selected_index == correct_index
    grammar_id = get_grammar_id_for_lesson(quiz['lesson_id'])
    now = get_now_iso()
    correct_quiz_count = 0
    conn = get_db_connection()
    try:
        conn.execute(
            '''
            INSERT INTO child_grammar_quiz_attempts (child_id, lesson_id, quiz_id, selected_index, is_correct, attempted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (child_id, quiz['lesson_id'], quiz_id, selected_index, 1 if is_correct else 0, now),
        )
        correct_quiz_row = conn.execute(
            '''
            SELECT COUNT(DISTINCT quiz_id) AS count
            FROM child_grammar_quiz_attempts
            WHERE child_id = ? AND lesson_id = ? AND is_correct = 1
            ''',
            (child_id, quiz['lesson_id']),
        ).fetchone()
        correct_quiz_count = int(correct_quiz_row['count'] or 0) if correct_quiz_row else 0
        last_score = round((correct_quiz_count / max(1, total_quizzes)) * 100)
        status = 'mastered' if total_quizzes and correct_quiz_count >= total_quizzes else 'learning'
        progress_columns = _sqlite_table_columns(conn, 'child_grammar_progress')
        if 'grammar_id' in progress_columns:
            existing = _find_child_grammar_progress_row(conn, child_id, quiz['lesson_id'], grammar_id, progress_columns)
            if existing:
                conn.execute(
                    '''
                    UPDATE child_grammar_progress
                    SET grammar_id = ?,
                        lesson_id = ?,
                        status = CASE
                            WHEN ? = 'mastered' THEN 'mastered'
                            WHEN status = 'mastered' THEN 'mastered'
                            ELSE 'learning'
                        END,
                        correct_count = correct_count + ?,
                        wrong_count = wrong_count + ?,
                        last_score = ?,
                        mastered_at = CASE
                            WHEN ? IS NOT NULL THEN ?
                            ELSE mastered_at
                        END,
                        last_studied_at = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE child_id = ? AND (lesson_id = ? OR grammar_id = ?)
                    ''',
                    (
                        grammar_id,
                        quiz['lesson_id'],
                        status,
                        1 if is_correct else 0,
                        0 if is_correct else 1,
                        last_score,
                        now if status == 'mastered' else None,
                        now if status == 'mastered' else None,
                        now,
                        child_id,
                        quiz['lesson_id'],
                        grammar_id,
                    ),
                )
            else:
                conn.execute(
                    '''
                    INSERT INTO child_grammar_progress (
                        child_id, grammar_id, lesson_id, status, view_count, correct_count, wrong_count, last_score,
                        mastered_at, last_studied_at, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ''',
                    (
                        child_id,
                        grammar_id,
                        quiz['lesson_id'],
                        status,
                        1 if is_correct else 0,
                        0 if is_correct else 1,
                        last_score,
                        now if status == 'mastered' else None,
                        now,
                    ),
                )
        else:
            conn.execute(
                '''
                INSERT INTO child_grammar_progress (
                    child_id, lesson_id, status, view_count, correct_count, wrong_count, last_score,
                    mastered_at, last_studied_at, created_at, updated_at
                )
                VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(child_id, lesson_id) DO UPDATE SET
                    status = CASE
                        WHEN excluded.status = 'mastered' THEN 'mastered'
                        WHEN child_grammar_progress.status = 'mastered' THEN 'mastered'
                        ELSE 'learning'
                    END,
                    correct_count = child_grammar_progress.correct_count + excluded.correct_count,
                    wrong_count = child_grammar_progress.wrong_count + excluded.wrong_count,
                    last_score = excluded.last_score,
                    mastered_at = CASE
                        WHEN excluded.mastered_at IS NOT NULL THEN excluded.mastered_at
                        ELSE child_grammar_progress.mastered_at
                    END,
                    last_studied_at = excluded.last_studied_at,
                    updated_at = CURRENT_TIMESTAMP
                ''',
                (
                    child_id,
                    quiz['lesson_id'],
                    status,
                    1 if is_correct else 0,
                    0 if is_correct else 1,
                    last_score,
                    now if status == 'mastered' else None,
                    now,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    lesson_payload = get_grammar_lesson_detail(child_id, quiz['lesson_id'])['lesson']
    reward_queue = []
    if is_correct and status == 'mastered':
        reward_queue = grant_child_grammar_lesson_reward(
            child_id,
            quiz['lesson_id'],
            lesson_title=lesson_payload.get('title') or '',
            correct_count=correct_quiz_count,
            total_count=total_quizzes,
        )
    return {
        'childId': child_id,
        'quizId': quiz_id,
        'lessonId': quiz['lesson_id'],
        'isCorrect': is_correct,
        'correctIndex': correct_index,
        'selectedIndex': selected_index,
        'explanationJp': quiz['explanation_jp'],
        'correctQuizCount': correct_quiz_count,
        'totalQuizCount': total_quizzes,
        'reward_queue': reward_queue,
        'rewardQueue': reward_queue,
        'lesson': lesson_payload,
    }


def get_grammar_quiz_wrong_questions(child_id):
    child_id = require_child_id(child_id)
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT attempt_id, child_id, lesson_id, quiz_id, selected_index, is_correct, attempted_at
            FROM child_grammar_quiz_attempts
            WHERE child_id = ?
            ORDER BY quiz_id ASC, attempted_at DESC, attempt_id DESC
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()

    latest_by_quiz = {}
    for row in rows:
        quiz_id = row['quiz_id']
        if quiz_id not in latest_by_quiz:
            latest_by_quiz[quiz_id] = row

    unresolved_attempts = [
        row for row in latest_by_quiz.values()
        if int(row['is_correct'] or 0) == 0
    ]
    if not unresolved_attempts:
        return {'childId': child_id, 'wrongQuestions': []}

    quiz_ids = [row['quiz_id'] for row in unresolved_attempts]
    latest_by_quiz_id = {row['quiz_id']: row for row in unresolved_attempts}
    lesson_conn = get_grammar_lesson_db_connection()
    try:
        placeholders = ','.join('?' for _ in quiz_ids)
        rows = lesson_conn.execute(
            f'''
            SELECT q.quiz_id, q.lesson_id, q.question_jp, q.choice_a, q.choice_b, q.choice_c, q.choice_d,
                   q.answer_index, q.explanation_jp, q.difficulty, l.title, l.category
            FROM grammar_quizzes AS q
            JOIN grammar_lessons AS l ON l.lesson_id = q.lesson_id
            WHERE q.quiz_id IN ({placeholders})
            ''',
            quiz_ids,
        ).fetchall()
    finally:
        lesson_conn.close()

    items = []
    for row in rows:
        attempt = latest_by_quiz_id.get(row['quiz_id'])
        if not attempt:
            continue
        choices = [row['choice_a'], row['choice_b'], row['choice_c'], row['choice_d']]
        correct_index = int(row['answer_index'])
        selected_index = int(attempt['selected_index'])
        items.append({
            'attemptId': attempt['attempt_id'],
            'quizId': row['quiz_id'],
            'lessonId': row['lesson_id'],
            'lessonTitle': row['title'],
            'category': row['category'],
            'questionJp': row['question_jp'],
            'choices': choices,
            'selectedIndex': selected_index,
            'selectedAnswer': choices[selected_index] if 0 <= selected_index < len(choices) else '',
            'correctIndex': correct_index,
            'correctAnswer': choices[correct_index] if 0 <= correct_index < len(choices) else '',
            'explanationJp': row['explanation_jp'] or '',
            'difficulty': int(row['difficulty'] or 2),
            'attemptedAt': attempt['attempted_at'],
        })

    items.sort(key=lambda item: (item['lessonId'], item['quizId']))
    return {'childId': child_id, 'wrongQuestions': items}


def get_child_recent_accuracy(child_id, limit=20):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT is_correct
            FROM ai_study_records
            WHERE child_id = ?
            ORDER BY id DESC
            LIMIT ?
            ''',
            (child_id, limit),
        ).fetchall()
    finally:
        conn.close()
    if not rows:
        return None
    return sum(1 for row in rows if row['is_correct']) / len(rows)


def get_child_current_combo(child_id):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT is_correct
            FROM ai_study_records
            WHERE child_id = ?
            ORDER BY id DESC
            LIMIT 20
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    combo = 0
    for row in rows:
        if not row['is_correct']:
            break
        combo += 1
    return combo


def _entry_to_ai_word(entry):
    return {
        'id': str(entry.get('ID', '')).strip(),
        'word': entry.get('English', '').strip(),
        'meaning': entry.get('Japanese', '').strip(),
        'level': entry.get('Category', '').strip() or entry.get('Importance', '').strip(),
        'example': entry.get('Example_English', '').strip() or entry.get('Example_English_Short', '').strip(),
    }


def select_ai_vocab_entries(child_id, limit=8):
    today = get_today()
    by_id = {str(entry.get('ID', '')).strip(): entry for entry in vocab_list if str(entry.get('ID', '')).strip()}
    conn = get_db_connection()
    try:
        today_rows = conn.execute(
            '''
            SELECT vocab_id, mastery
            FROM child_vocab_progress
            WHERE child_id = ? AND substr(COALESCE(last_studied_at, ''), 1, 10) = ?
            ORDER BY last_studied_at DESC
            LIMIT 40
            ''',
            (child_id, today),
        ).fetchall()
        old_rows = conn.execute(
            '''
            SELECT vocab_id, mastery, wrong_count
            FROM child_vocab_progress
            WHERE child_id = ? AND substr(COALESCE(last_studied_at, ''), 1, 10) <> ?
            ORDER BY wrong_count DESC, last_studied_at ASC
            LIMIT 60
            ''',
            (child_id, today),
        ).fetchall()
        wrong_rows = conn.execute(
            '''
            SELECT vocab_id, SUM(error_count) AS weight
            FROM ai_wrong_answers
            WHERE child_id = ? AND vocab_id IS NOT NULL
            GROUP BY vocab_id
            ORDER BY weight DESC, MAX(last_error_at) DESC
            LIMIT 40
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()

    weighted = []

    def add_rows(rows, base_weight):
        for row in rows:
            entry = by_id.get(str(row['vocab_id']))
            if not entry:
                continue
            wrong_weight = int(row['weight']) if 'weight' in row.keys() and row['weight'] else 0
            mastery = int(row['mastery']) if 'mastery' in row.keys() and row['mastery'] is not None else 0
            weight = base_weight + wrong_weight * 3 + max(0, 60 - mastery) // 15
            weighted.extend([entry] * max(1, weight))

    add_rows(today_rows, 7)
    add_rows(old_rows, 3)
    add_rows(wrong_rows, 10)

    if len(weighted) < limit:
        sampled = random.sample(vocab_list, min(len(vocab_list), max(limit * 4, 20)))
        weighted.extend(sampled)

    selected = []
    seen = set()
    review_slots = max(1, int(limit * 0.3))
    old_entries = [by_id.get(str(row['vocab_id'])) for row in old_rows if by_id.get(str(row['vocab_id']))]
    random.shuffle(old_entries)
    for entry in old_entries[:review_slots]:
        key = get_vocab_key(entry)
        if key not in seen:
            seen.add(key)
            selected.append(entry)

    random.shuffle(weighted)
    for entry in weighted:
        key = get_vocab_key(entry)
        if key and key not in seen:
            seen.add(key)
            selected.append(entry)
        if len(selected) >= limit:
            break
    return selected[:limit]


def choose_ai_question_type(child_id):
    accuracy = get_child_recent_accuracy(child_id)
    if accuracy is not None and accuracy >= 0.8:
        return random.choice(['reading', 'writing', 'sentence', 'fill_blank', 'ja_to_en'])
    if accuracy is not None and accuracy < 0.6:
        return random.choice(['multiple_choice', 'multiple_choice', 'fill_blank', 'en_to_ja'])
    return random.choice(['multiple_choice', 'fill_blank', 'en_to_ja', 'ja_to_en', 'sentence'])


def _extract_json_object(text):
    cleaned = (text or '').strip()
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start >= 0 and end >= start:
        cleaned = cleaned[start:end + 1]
    return json.loads(cleaned)


def normalize_ai_auto_question(data, fallback_entry, requested_type):
    if not isinstance(data, dict):
        raise ValueError('AI output must be a JSON object')
    word_payload = _entry_to_ai_word(fallback_entry)
    qtype = str(data.get('type') or requested_type).strip()
    if qtype not in AI_AUTO_QUESTION_TYPES:
        qtype = requested_type
    prompt = str(data.get('question') or data.get('prompt') or '').strip()
    correct = str(data.get('answer') or data.get('correct_answer') or data.get('correct') or '').strip()
    choices = [str(choice).strip() for choice in data.get('choices', []) if str(choice).strip()]
    if qtype in ['multiple_choice', 'fill_blank', 'en_to_ja', 'ja_to_en', 'reading']:
        deduped = []
        for choice in choices:
            if choice not in deduped:
                deduped.append(choice)
        if correct and correct not in deduped:
            deduped.insert(0, correct)
        choices = deduped[:4]
    else:
        choices = []
    if not prompt or not correct:
        raise ValueError('AI output missing prompt or correct_answer')
    return {
        'type': qtype,
        'question': prompt,
        'prompt': prompt,
        'choices': choices,
        'answer': correct,
        'correct_answer': correct,
        'explanation': str(data.get('explanation') or data.get('explanation_jp') or '').strip(),
        'word': str(data.get('word') or word_payload['word']).strip(),
        'meaning': str(data.get('meaning') or word_payload['meaning']).strip(),
        'example': str(data.get('example') or word_payload['example']).strip(),
        'vocab_id': word_payload['id'],
    }


def generate_rule_ai_auto_question(entries, question_type):
    entry = entries[0] if entries else random.choice(vocab_list)
    word = entry.get('English', '').strip()
    meaning = entry.get('Japanese', '').strip()
    example = entry.get('Example_English', '').strip() or f'I like to use {word}.'
    choices = []
    if question_type in ['multiple_choice', 'en_to_ja']:
        choices = _build_review_choices(meaning, vocab_list, lambda item: item.get('Japanese', '').strip())
        prompt = f'"{word}" の意味はどれ？'
        correct = meaning
    elif question_type == 'ja_to_en':
        choices = _build_review_choices(word, vocab_list, lambda item: item.get('English', '').strip())
        prompt = f'"{meaning}" を英語でいうと？'
        correct = word
    elif question_type in ['fill_blank', 'reading']:
        choices = _build_review_choices(word, vocab_list, lambda item: item.get('English', '').strip())
        prompt = make_blank(example, word)
        correct = word
    elif question_type == 'writing':
        prompt = f'{word} を使って、短い英文を書こう。'
        correct = word
    else:
        prompt = f'{word} を使って文を作ろう。'
        correct = word
    return {
        'type': question_type,
        'question': prompt,
        'prompt': prompt,
        'choices': choices[:4],
        'answer': correct,
        'correct_answer': correct,
        'explanation': '',
        'word': word,
        'meaning': meaning,
        'example': example,
        'vocab_id': entry.get('ID', ''),
    }


def save_ai_question(child_id, question, source='rule', difficulty='normal'):
    vocab_id = int(question['vocab_id']) if str(question.get('vocab_id', '')).isdigit() else None
    conn = get_db_connection()
    try:
        row_id = conn.execute(
            '''
            INSERT INTO ai_questions (
                child_id, vocab_id, question_type, prompt, choices_json,
                correct_answer, explanation, source, difficulty
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                child_id,
                vocab_id,
                question['type'],
                question['prompt'],
                json.dumps(question.get('choices', []), ensure_ascii=False),
                question['correct_answer'],
                question.get('explanation', ''),
                source,
                difficulty,
            ),
        ).lastrowid
        conn.commit()
        question['question_id'] = row_id
        question['id'] = question.get('vocab_id', '')
        question['source'] = source
        return question
    finally:
        conn.close()


def get_ai_practice_question(child_id):
    entries = select_ai_vocab_entries(child_id)
    qtype = choose_ai_question_type(child_id)
    source = 'rule'
    warning = ''
    question = generate_rule_ai_auto_question(entries, qtype)
    difficulty = 'easy' if qtype in ['multiple_choice', 'en_to_ja'] else 'challenge'
    saved = save_ai_question(child_id, question, source=source, difficulty=difficulty)
    saved['warning'] = warning
    saved['accuracy'] = get_child_recent_accuracy(child_id)
    saved['combo'] = get_child_current_combo(child_id)
    return saved


def answer_matches(question_type, selected, correct):
    selected_norm = (selected or '').strip().lower()
    correct_norm = (correct or '').strip().lower()
    if question_type in ['sentence', 'writing']:
        return bool(correct_norm and re.search(rf'\b{re.escape(correct_norm)}\b', selected_norm, flags=re.IGNORECASE))
    return selected_norm == correct_norm


def submit_ai_practice_answer(child_id, question_id, selected_answer):
    conn = get_db_connection()
    try:
        question = conn.execute('SELECT * FROM ai_questions WHERE id = ?', (question_id,)).fetchone()
        if not question:
            raise ValueError('question not found')
    finally:
        conn.close()

    is_correct = answer_matches(question['question_type'], selected_answer, question['correct_answer'])
    combo = get_child_current_combo(child_id) + 1 if is_correct else 0
    combo_bonus = min(20, max(0, combo - 1) * 2) if is_correct else 0
    xp_awarded = 10 + combo_bonus if is_correct else 0
    study_result = None
    mastery_after = 0
    if question['vocab_id']:
        study_result = recordStudyResult(child_id, int(question['vocab_id']), is_correct)
        progress = study_result.get('child_vocab_progress') if study_result else None
        mastery_after = int(progress.get('mastery') or 0) if progress else 0
    elif is_correct:
        try:
            study_result = {'pet': addPetExp(child_id, xp_awarded), 'pet_exp_awarded': xp_awarded}
        except Exception:
            study_result = None

    if study_result and is_correct and xp_awarded > int(study_result.get('pet_exp_awarded') or 0):
        try:
            study_result['pet'] = addPetExp(child_id, xp_awarded - int(study_result.get('pet_exp_awarded') or 0))
            study_result['pet_exp_awarded'] = xp_awarded
        except Exception:
            pass

    conn = get_db_connection()
    try:
        if not is_correct:
            conn.execute(
                '''
                INSERT INTO ai_wrong_answers (
                    child_id, vocab_id, question_id, selected_answer, correct_answer, error_count, last_error_at
                ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                ''',
                (child_id, question['vocab_id'], question_id, selected_answer, question['correct_answer']),
            )
            if question['vocab_id']:
                log_error(str(question['vocab_id']))
        conn.execute(
            '''
            INSERT INTO ai_study_records (
                child_id, vocab_id, question_id, question_type, selected_answer, correct_answer,
                is_correct, xp_awarded, combo, mastery_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                child_id,
                question['vocab_id'],
                question_id,
                question['question_type'],
                selected_answer,
                question['correct_answer'],
                1 if is_correct else 0,
                xp_awarded,
                combo,
                mastery_after,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        'correct': is_correct,
        'answer': question['correct_answer'],
        'correct_answer': question['correct_answer'],
        'explanation': question['explanation'] or '',
        'xp_awarded': xp_awarded,
        'combo': combo,
        'mastery': mastery_after,
        'pet': study_result.get('pet') if study_result else None,
    }


def generate_practice_questions(db_path=None, force_ai=False, nonce=None, importance=None, frequency=None):
    entries = load_question_entries(db_path)
    entries = filter_vocab_entries(entries, importance=importance, frequency=frequency)
    ai_enabled = os.getenv('AI_QUESTIONS_ENABLED', '1').strip().lower() not in ['0', 'false', 'no']
    warning = None

    if len(entries) < 4:
        entries = load_question_entries(db_path)
        warning = 'Not enough vocabulary matched the selected filters; using the full list.'

    if force_ai and not ai_enabled:
        warning = 'AI question generation is disabled; using local fallback questions.'
    if force_ai and not get_openai_api_key():
        warning = 'OPENAI_API_KEY is not configured; using local fallback questions.'

    if ai_enabled and get_openai_api_key():
        try:
            return generate_ai_questions(entries, nonce), 'ai', None
        except Exception as exc:
            if force_ai:
                warning = f'AI question generation failed; using local fallback questions. {exc}'
            app.logger.warning('AI question generation failed; using rule fallback: %s', exc)

    return generate_rule_questions(entries), 'rule', warning


EIKEN_PRE2_SECTION_TITLES = {
    'sentence_fill': '短句填空',
    'dialogue_completion': '対話完成',
    'reading': '読解',
}


def _normalize_eiken_option(value):
    option = _clean_csv_value(value).upper()
    if option in ['1', '2', '3', '4']:
        option = {'1': 'A', '2': 'B', '3': 'C', '4': 'D'}[option]
    if option not in ['A', 'B', 'C', 'D', '']:
        raise ValueError('answers must be A, B, C, D, 1, 2, 3, or 4')
    return option


def _eiken_question_to_dict(row, include_correct=False):
    options = [
        {'key': 'A', 'option': 'A', 'text': row['option_A'], 'text_ja': _row_value(row, 'option_A_ja', '')},
        {'key': 'B', 'option': 'B', 'text': row['option_B'], 'text_ja': _row_value(row, 'option_B_ja', '')},
        {'key': 'C', 'option': 'C', 'text': row['option_C'], 'text_ja': _row_value(row, 'option_C_ja', '')},
        {'key': 'D', 'option': 'D', 'text': row['option_D'], 'text_ja': _row_value(row, 'option_D_ja', '')},
    ]
    question = {
        'question_id': row['question_id'],
        'set_id': row['set_id'],
        'question_no': row['question_no'],
        'section': row['section'],
        'question_type': row['question_type'],
        'question_text': row['prompt'],
        'question_text_ja': _row_value(row, 'question_text_ja', ''),
        'prompt': row['prompt'],
        'options': options,
        'choices': options,
        'passage_id': row['passage_id'],
        'difficulty': row['difficulty'],
        'skill_tag': row['skill_tag'],
        'weak_point_tag': _row_value(row, 'weak_point_tag', ''),
        'target_vocab': _row_value(row, 'target_vocab', ''),
    }
    if include_correct:
        question['correct_option'] = row['correct_option']
        question['correct_answer_text'] = _row_value(row, 'correct_answer_text', '')
        question['correct_answer_text_ja'] = _row_value(row, 'correct_answer_text_ja', '')
        question['explanation_ja'] = _row_value(row, 'explanation_ja', '')
        question['vocabulary_notes_ja'] = _row_value(row, 'vocabulary_notes_ja', '')
    return question


def _eiken_passage_to_dict(row):
    return {
        'passage_id': row['passage_id'],
        'set_id': row['set_id'],
        'passage_no': row['passage_no'],
        'genre': row['genre'],
        'passage_type': _row_value(row, 'passage_type', ''),
        'title': row['title'],
        'title_ja': _row_value(row, 'title_ja', ''),
        'passage_text': row['passage_text'],
        'passage_text_ja': _row_value(row, 'passage_text_ja', ''),
        'key_points_ja': _row_value(row, 'key_points_ja', ''),
    }


def _build_eiken_set_title(set_id):
    return f'英検準2級 模擬問題 {set_id}'


def list_eiken_pre2_sets():
    conn = get_eiken_pre2_bank_connection()
    try:
        rows = conn.execute(
            '''
            SELECT set_id, COUNT(*) AS question_count
            FROM question_bank
            GROUP BY set_id
            ORDER BY set_id
            '''
        ).fetchall()
    finally:
        conn.close()
    return [
        {
            'set_id': row['set_id'],
            'title': _build_eiken_set_title(row['set_id']),
            'question_count': int(row['question_count'] or 0),
        }
        for row in rows
    ]


def get_eiken_pre2_set(set_id, include_correct=False):
    set_id = _clean_csv_value(set_id).upper()
    if not set_id:
        raise ValueError('set_id is required')

    conn = get_eiken_pre2_bank_connection()
    try:
        question_view = 'v_questions_for_result' if include_correct else 'v_questions_for_quiz'
        question_rows = conn.execute(
            f'''
            SELECT *
            FROM {question_view}
            WHERE set_id = ?
            ORDER BY question_no ASC
            ''',
            (set_id,),
        ).fetchall()
        if not question_rows:
            return None

        passage_rows = conn.execute(
            '''
            SELECT *
            FROM passages
            WHERE set_id = ?
            ORDER BY passage_no ASC
            ''',
            (set_id,),
        ).fetchall()
    finally:
        conn.close()

    passages = {row['passage_id']: _eiken_passage_to_dict(row) for row in passage_rows}
    sections = []
    section_map = {}
    for row in question_rows:
        section_key = row['section'] or row['question_type']
        if section_key not in section_map:
            section_map[section_key] = {
                'section': section_key,
                'title': EIKEN_PRE2_SECTION_TITLES.get(section_key, section_key),
                'questions': [],
            }
            sections.append(section_map[section_key])
        question = _eiken_question_to_dict(row, include_correct=include_correct)
        if question.get('passage_id'):
            question['passage'] = passages.get(question['passage_id'])
        section_map[section_key]['questions'].append(question)

    return {
        'set_id': set_id,
        'title': _build_eiken_set_title(set_id),
        'question_count': len(question_rows),
        'questions': [question for section in sections for question in section['questions']],
        'sections': sections,
        'passages': list(passages.values()),
    }


def _get_eiken_questions_by_set(set_id):
    set_id = _clean_csv_value(set_id).upper()
    conn = get_eiken_pre2_bank_connection()
    try:
        rows = conn.execute(
            '''
            SELECT *
            FROM v_questions_for_result
            WHERE set_id = ?
            ORDER BY question_no ASC
            ''',
            (set_id,),
        ).fetchall()
        if not rows:
            return None, {}
        passage_rows = conn.execute(
            'SELECT * FROM passages WHERE set_id = ? ORDER BY passage_no ASC',
            (set_id,),
        ).fetchall()
    finally:
        conn.close()

    passages = {row['passage_id']: _eiken_passage_to_dict(row) for row in passage_rows}
    questions = {}
    for row in rows:
        question = _eiken_question_to_dict(row, include_correct=True)
        if question.get('passage_id'):
            question['passage'] = passages.get(question['passage_id'])
        questions[question['question_id']] = question
    return {
        'set_id': set_id,
        'title': _build_eiken_set_title(set_id),
        'question_count': len(rows),
        'passages': list(passages.values()),
    }, questions


def _parse_eiken_answers(raw_answers):
    if isinstance(raw_answers, dict):
        return {
            _clean_csv_value(question_id): _normalize_eiken_option(answer)
            for question_id, answer in raw_answers.items()
            if _clean_csv_value(question_id)
        }

    parsed = {}
    if isinstance(raw_answers, list):
        for item in raw_answers:
            if not isinstance(item, dict):
                continue
            question_id = _clean_csv_value(item.get('question_id'))
            answer = item.get('student_answer', item.get('answer', item.get('selected_answer', '')))
            if question_id:
                parsed[question_id] = _normalize_eiken_option(answer)
    return parsed


def _validate_child_exists(child_id):
    conn = get_db_connection()
    try:
        return conn.execute('SELECT id, name FROM children WHERE id = ?', (child_id,)).fetchone()
    finally:
        conn.close()


def _ensure_eiken_student(student_id):
    student_id = _clean_csv_value(student_id)
    if not student_id:
        raise ValueError('student_id is required')

    student_name = student_id
    grade = ''
    target_level = 'EIKEN_Pre2'
    try:
        child_id = int(student_id)
    except (TypeError, ValueError):
        child_id = None
    if child_id is not None:
        child = _validate_child_exists(child_id)
        if child:
            student_name = child['name']

    conn = get_eiken_pre2_bank_connection()
    try:
        conn.execute(
            '''
            INSERT INTO students (student_id, student_name, grade, target_level, notes)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                student_name = excluded.student_name,
                grade = COALESCE(NULLIF(excluded.grade, ''), students.grade),
                target_level = COALESCE(NULLIF(excluded.target_level, ''), students.target_level)
            ''',
            (student_id, student_name, grade, target_level, 'linked from web app'),
        )
        conn.commit()
    finally:
        conn.close()
    return student_id


def _build_eiken_result_question(question, student_answer, correct_option):
    passage = question.get('passage') or {}
    return {
        'question_id': question['question_id'],
        'set_id': question['set_id'],
        'question_no': question.get('question_no'),
        'question_type': question['question_type'],
        'section': question['section'],
        'question_text': question['question_text'],
        'prompt': question.get('prompt') or question['question_text'],
        'question_text_ja': question.get('question_text_ja') or '',
        'option_A': (question['options'][0] or {}).get('text') if len(question['options']) > 0 else '',
        'option_B': (question['options'][1] or {}).get('text') if len(question['options']) > 1 else '',
        'option_C': (question['options'][2] or {}).get('text') if len(question['options']) > 2 else '',
        'option_D': (question['options'][3] or {}).get('text') if len(question['options']) > 3 else '',
        'option_A_ja': (question['options'][0] or {}).get('text_ja') if len(question['options']) > 0 else '',
        'option_B_ja': (question['options'][1] or {}).get('text_ja') if len(question['options']) > 1 else '',
        'option_C_ja': (question['options'][2] or {}).get('text_ja') if len(question['options']) > 2 else '',
        'option_D_ja': (question['options'][3] or {}).get('text_ja') if len(question['options']) > 3 else '',
        'options': question['options'],
        'choices': question['choices'],
        'student_answer': student_answer,
        'correct_option': correct_option,
        'correct_answer_text': question.get('correct_answer_text') or '',
        'correct_answer_text_ja': question.get('correct_answer_text_ja') or '',
        'is_correct': student_answer == correct_option,
        'passage_id': question.get('passage_id'),
        'passage_title': passage.get('title') if passage else None,
        'passage_title_ja': passage.get('title_ja') if passage else None,
        'passage_text': passage.get('passage_text') if passage else '',
        'passage_text_ja': passage.get('passage_text_ja') if passage else '',
        'passage': passage or None,
        'explanation_ja': question.get('explanation_ja'),
        'vocabulary_notes_ja': question.get('vocabulary_notes_ja'),
        'weak_point_tag': question.get('weak_point_tag'),
    }


def _read_attempt_question_ids(attempt_row):
    notes = _clean_csv_value(attempt_row['notes'] if 'notes' in attempt_row.keys() else '')
    if not notes:
        return []
    try:
        payload = json.loads(notes)
    except (TypeError, json.JSONDecodeError):
        return []
    if isinstance(payload, dict) and isinstance(payload.get('question_ids'), list):
        return [_clean_csv_value(item) for item in payload['question_ids'] if _clean_csv_value(item)]
    return []


def start_eiken_pre2_attempt(student_id, set_id, mode='ai_training', question_ids=None, source_attempt_id=None):
    student_id = _ensure_eiken_student(student_id)
    question_set, questions = _get_eiken_questions_by_set(set_id)
    if not question_set:
        raise LookupError('set_id not found')

    selected_ids = [_clean_csv_value(question_id) for question_id in (question_ids or []) if _clean_csv_value(question_id)]
    if selected_ids:
        unknown_ids = [question_id for question_id in selected_ids if question_id not in questions]
        if unknown_ids:
            raise ValueError('question_ids must belong to set_id')
    else:
        selected_ids = list(questions.keys())

    now = get_now_iso()
    attempt_id = str(uuid.uuid4())
    notes = json.dumps(
        {
            'question_ids': selected_ids,
            'source_attempt_id': _clean_csv_value(source_attempt_id),
        },
        ensure_ascii=False,
    )
    conn = get_eiken_pre2_bank_connection()
    try:
        conn.execute(
            '''
            INSERT INTO attempts (
                attempt_id, student_id, set_id, started_at, completed_at,
                total_questions, correct_count, score_percent, notes, mode, status
            ) VALUES (?, ?, ?, ?, '', ?, 0, 0, ?, ?, 'in_progress')
            ''',
            (attempt_id, student_id, question_set['set_id'], now, len(selected_ids), notes, mode or 'ai_training'),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        'attempt_id': attempt_id,
        'student_id': student_id,
        'set_id': question_set['set_id'],
        'mode': mode or 'ai_training',
        'status': 'in_progress',
        'started_at': now,
        'total_questions': len(selected_ids),
        'question_ids': selected_ids,
    }


def start_eiken_pre2_review_attempt(source_attempt_id, student_id=None):
    source = get_eiken_pre2_attempt_result(source_attempt_id)
    if not source:
        raise LookupError('attempt_id not found')
    wrong_ids = [item['question_id'] for item in source.get('wrong_questions', [])]
    if not wrong_ids:
        raise ValueError('no wrong questions to retry')
    return start_eiken_pre2_attempt(
        student_id or source['student_id'],
        source['set_id'],
        mode='wrong_review',
        question_ids=wrong_ids,
        source_attempt_id=source_attempt_id,
    )


def submit_eiken_pre2_single_answer(attempt_id, question_id, student_answer=None, time_spent_seconds=None, timed_out=False):
    attempt_id = _clean_csv_value(attempt_id)
    question_id = _clean_csv_value(question_id)
    if not attempt_id or not question_id:
        raise ValueError('attempt_id and question_id are required')

    conn = get_eiken_pre2_bank_connection()
    try:
        attempt = conn.execute('SELECT * FROM attempts WHERE attempt_id = ?', (attempt_id,)).fetchone()
        if not attempt:
            raise LookupError('attempt_id not found')
        question = conn.execute(
            'SELECT * FROM v_questions_for_result WHERE set_id = ? AND question_id = ?',
            (attempt['set_id'], question_id),
        ).fetchone()
        if not question:
            raise LookupError('question_id not found')
        allowed_ids = _read_attempt_question_ids(attempt)
        if allowed_ids and question_id not in allowed_ids:
            raise ValueError('question_id is not part of this attempt')

        normalized_answer = '' if timed_out else _normalize_eiken_option(student_answer or '')
        correct_option = question['correct_option']
        is_correct = bool(normalized_answer and normalized_answer == correct_option)
        now = get_now_iso()
        try:
            spent = int(time_spent_seconds)
        except (TypeError, ValueError):
            spent = None

        existing = conn.execute(
            'SELECT answer_id FROM student_answers WHERE attempt_id = ? AND question_id = ?',
            (attempt_id, question_id),
        ).fetchone()
        answer_id = existing['answer_id'] if existing else f'{attempt_id}-{question_id}'
        if existing:
            conn.execute(
                '''
                UPDATE student_answers
                SET student_answer = ?, correct_option = ?, is_correct = ?, answered_at = ?,
                    weak_point_tag = ?, time_spent_seconds = ?, timed_out = ?
                WHERE answer_id = ?
                ''',
                (
                    normalized_answer,
                    correct_option,
                    1 if is_correct else 0,
                    now,
                    question['weak_point_tag'],
                    spent,
                    1 if timed_out else 0,
                    answer_id,
                ),
            )
        else:
            conn.execute(
                '''
                INSERT INTO student_answers (
                    answer_id, attempt_id, student_id, set_id, question_id,
                    student_answer, correct_option, is_correct, answered_at, weak_point_tag,
                    time_spent_seconds, timed_out
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    answer_id,
                    attempt_id,
                    attempt['student_id'],
                    attempt['set_id'],
                    question_id,
                    normalized_answer,
                    correct_option,
                    1 if is_correct else 0,
                    now,
                    question['weak_point_tag'],
                    spent,
                    1 if timed_out else 0,
                ),
            )
        conn.commit()
    finally:
        conn.close()

    options = {
        'A': question['option_A_ja'],
        'B': question['option_B_ja'],
        'C': question['option_C_ja'],
        'D': question['option_D_ja'],
    }
    return {
        'attempt_id': attempt_id,
        'question_id': question_id,
        'student_answer': normalized_answer,
        'is_correct': is_correct,
        'timed_out': bool(timed_out),
        'correct_option': correct_option,
        'correct_answer_text': question['correct_answer_text'],
        'correct_answer_text_ja': question['correct_answer_text_ja'],
        'explanation_ja': question['explanation_ja'],
        'vocabulary_notes_ja': question['vocabulary_notes_ja'],
        'question_text_ja': question['question_text_ja'],
        'options_ja': options,
        'option_A_ja': question['option_A_ja'],
        'option_B_ja': question['option_B_ja'],
        'option_C_ja': question['option_C_ja'],
        'option_D_ja': question['option_D_ja'],
    }


def complete_eiken_pre2_attempt(attempt_id):
    attempt_id = _clean_csv_value(attempt_id)
    conn = get_eiken_pre2_bank_connection()
    try:
        attempt = conn.execute('SELECT * FROM attempts WHERE attempt_id = ?', (attempt_id,)).fetchone()
        if not attempt:
            raise LookupError('attempt_id not found')
        rows = conn.execute(
            'SELECT is_correct FROM student_answers WHERE attempt_id = ?',
            (attempt_id,),
        ).fetchall()
        total_questions = int(attempt['total_questions'] or 0)
        correct_count = sum(1 for row in rows if int(row['is_correct'] or 0) == 1)
        score_percent = round((correct_count / max(1, total_questions)) * 100, 1)
        conn.execute(
            '''
            UPDATE attempts
            SET completed_at = ?, correct_count = ?, score_percent = ?, status = 'completed'
            WHERE attempt_id = ?
            ''',
            (get_now_iso(), correct_count, score_percent, attempt_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_eiken_pre2_attempt_result(attempt_id)


def submit_eiken_pre2_attempt(child_id, set_id, raw_answers, started_at=None, attempt_id=None, question_ids=None):
    student_id = _ensure_eiken_student(child_id)

    question_set, questions = _get_eiken_questions_by_set(set_id)
    if not question_set:
        raise LookupError('set_id not found')

    answers = _parse_eiken_answers(raw_answers)
    if not answers:
        raise ValueError('answers are required')
    requested_question_ids = [_clean_csv_value(question_id) for question_id in (question_ids or []) if _clean_csv_value(question_id)]
    if requested_question_ids:
        unknown_ids = [question_id for question_id in requested_question_ids if question_id not in questions]
        if unknown_ids:
            raise ValueError('question_ids must belong to set_id')
        questions = {question_id: questions[question_id] for question_id in requested_question_ids}

    now = get_now_iso()
    started_at = _clean_csv_value(started_at) or now
    attempt_id = _clean_csv_value(attempt_id) or str(uuid.uuid4())
    rows_to_save = []
    correct_count = 0
    type_stats = {}
    wrong_questions = []

    for question_id, question in questions.items():
        student_answer = answers.get(question_id, '')
        correct_option = question['correct_option']
        is_correct = bool(student_answer and student_answer == correct_option)
        correct_count += 1 if is_correct else 0
        question_type = question['question_type']
        stats = type_stats.setdefault(question_type, {'question_type': question_type, 'total': 0, 'correct': 0, 'score_percent': 0.0})
        stats['total'] += 1
        stats['correct'] += 1 if is_correct else 0
        rows_to_save.append(
            (
                attempt_id,
                student_id,
                question['set_id'],
                question_id,
                question_type,
                student_answer,
                correct_option,
                1 if is_correct else 0,
                now,
                question.get('weak_point_tag') or '',
            )
        )
        if not is_correct:
            wrong_questions.append(_build_eiken_result_question(question, student_answer, correct_option))

    total_questions = len(questions)
    score_percent = round((correct_count / max(1, total_questions)) * 100, 1)
    for stats in type_stats.values():
        stats['score_percent'] = round((stats['correct'] / max(1, stats['total'])) * 100, 1)

    conn = get_eiken_pre2_bank_connection()
    try:
        existing = conn.execute('SELECT attempt_id FROM attempts WHERE attempt_id = ?', (attempt_id,)).fetchone()
        if existing:
            raise RuntimeError('duplicate attempt_id')
        conn.execute(
            '''
            INSERT INTO attempts (
                attempt_id, student_id, set_id, started_at, completed_at,
                total_questions, correct_count, score_percent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (attempt_id, student_id, question_set['set_id'], started_at, now, total_questions, correct_count, score_percent),
        )
        conn.executemany(
            '''
            INSERT INTO student_answers (
                answer_id, attempt_id, student_id, set_id, question_id,
                student_answer, correct_option, is_correct, answered_at, weak_point_tag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            [(f'{row[0]}-{row[3]}', row[0], row[1], row[2], row[3], row[5], row[6], row[7], row[8], row[9]) for row in rows_to_save],
        )
        conn.commit()
    finally:
        conn.close()

    return {
        'attempt_id': attempt_id,
        'student_id': student_id,
        'child_id': student_id,
        'set_id': question_set['set_id'],
        'started_at': started_at,
        'completed_at': now,
        'total_questions': total_questions,
        'correct_count': correct_count,
        'score_percent': score_percent,
        'type_stats': list(type_stats.values()),
        'wrong_questions': wrong_questions,
    }


def get_eiken_pre2_attempt_result(attempt_id):
    attempt_id = _clean_csv_value(attempt_id)
    conn = get_eiken_pre2_bank_connection()
    try:
        attempt = conn.execute('SELECT * FROM attempts WHERE attempt_id = ?', (attempt_id,)).fetchone()
        if not attempt:
            return None
        answer_rows = conn.execute(
            '''
            SELECT *
            FROM student_answers
            WHERE attempt_id = ?
            ORDER BY question_id ASC
            ''',
            (attempt_id,),
        ).fetchall()
    finally:
        conn.close()

    _, questions = _get_eiken_questions_by_set(attempt['set_id'])
    type_stats = {}
    wrong_questions = []
    question_results = []
    for row in answer_rows:
        question = questions.get(row['question_id'])
        if not question:
            continue
        question_type = question['question_type']
        stats = type_stats.setdefault(question_type, {'question_type': question_type, 'total': 0, 'correct': 0, 'score_percent': 0.0})
        stats['total'] += 1
        stats['correct'] += 1 if row['is_correct'] else 0
        result_question = _build_eiken_result_question(question, row['student_answer'] or '', row['correct_option'])
        result_question['is_correct'] = bool(row['is_correct'])
        question_results.append(result_question)
        if not row['is_correct']:
            wrong_questions.append(result_question)
    for stats in type_stats.values():
        stats['score_percent'] = round((stats['correct'] / max(1, stats['total'])) * 100, 1)

    return {
        'attempt_id': attempt['attempt_id'],
        'student_id': attempt['student_id'],
        'child_id': attempt['student_id'],
        'set_id': attempt['set_id'],
        'started_at': attempt['started_at'],
        'completed_at': attempt['completed_at'],
        'total_questions': attempt['total_questions'],
        'answered_count': len(answer_rows),
        'correct_count': attempt['correct_count'],
        'score_percent': attempt['score_percent'],
        'mode': _row_value(attempt, 'mode', 'standard'),
        'status': _row_value(attempt, 'status', 'completed'),
        'type_stats': list(type_stats.values()),
        'questions': question_results,
        'wrong_questions': wrong_questions,
    }


def get_eiken_pre2_wrong_questions(child_id, latest_only=False, question_type=None, weak_point_tag=None, limit=None):
    student_id = _clean_csv_value(child_id)
    if not student_id:
        raise ValueError('student_id is required')

    clauses = ['wa.student_id = ?']
    params = [student_id]
    if question_type:
        clauses.append('qb.question_type = ?')
        params.append(question_type)
    if weak_point_tag:
        clauses.append('wa.weak_point_tag = ?')
        params.append(weak_point_tag)
    where_sql = ' AND '.join(clauses)
    limit_sql = ''
    if limit:
        try:
            limit_value = max(1, min(200, int(limit)))
        except (TypeError, ValueError):
            raise ValueError('limit must be an integer')
        limit_sql = f' LIMIT {limit_value}'

    if latest_only:
        sql = f'''
            SELECT wa.*, qb.question_type, qb.section, qb.passage_id
            FROM v_wrong_answers AS wa
            JOIN question_bank AS qb ON qb.question_id = wa.question_id
            WHERE {where_sql}
              AND answer_id IN (
                SELECT answer_id
                FROM v_wrong_answers
                WHERE student_id = ?
                  AND question_id = wa.question_id
                ORDER BY answered_at DESC, answer_id DESC
                LIMIT 1
              )
            ORDER BY answered_at DESC, question_id ASC
            {limit_sql}
        '''
        params = params + [student_id]
    else:
        sql = f'''
            SELECT wa.*, qb.question_type, qb.section, qb.passage_id
            FROM v_wrong_answers AS wa
            JOIN question_bank AS qb ON qb.question_id = wa.question_id
            WHERE {where_sql}
            ORDER BY answered_at DESC, question_id ASC
            {limit_sql}
        '''

    conn = get_eiken_pre2_bank_connection()
    try:
        rows = conn.execute(sql, params).fetchall()
        count_rows = conn.execute(
            '''
            SELECT question_id, COUNT(*) AS wrong_count, MAX(answered_at) AS last_wrong_at
            FROM v_wrong_answers
            WHERE student_id = ?
            GROUP BY question_id
            ''',
            (student_id,),
        ).fetchall()
    finally:
        conn.close()
    history = {row['question_id']: row for row in count_rows}

    wrong_questions = []
    for row in rows:
        options = [
            {'key': 'A', 'option': 'A', 'text': row['option_A'], 'text_ja': row['option_A_ja']},
            {'key': 'B', 'option': 'B', 'text': row['option_B'], 'text_ja': row['option_B_ja']},
            {'key': 'C', 'option': 'C', 'text': row['option_C'], 'text_ja': row['option_C_ja']},
            {'key': 'D', 'option': 'D', 'text': row['option_D'], 'text_ja': row['option_D_ja']},
        ]
        count_row = history.get(row['question_id'])
        wrong_questions.append({
            'answer_id': row['answer_id'],
            'attempt_id': row['attempt_id'],
            'student_id': row['student_id'],
            'set_id': row['set_id'],
            'question_id': row['question_id'],
            'question_type': row['question_type'],
            'section': row['section'],
            'passage_id': row['passage_id'],
            'student_answer': row['student_answer'] or '',
            'correct_option': row['correct_option'],
            'is_correct': False,
            'answered_at': row['answered_at'],
            'wrong_count': int(count_row['wrong_count'] or 0) if count_row else 1,
            'last_wrong_at': count_row['last_wrong_at'] if count_row else row['answered_at'],
            'question_text': row['prompt'],
            'prompt': row['prompt'],
            'question_text_ja': row['question_text_ja'],
            'option_A': row['option_A'],
            'option_B': row['option_B'],
            'option_C': row['option_C'],
            'option_D': row['option_D'],
            'option_A_ja': row['option_A_ja'],
            'option_B_ja': row['option_B_ja'],
            'option_C_ja': row['option_C_ja'],
            'option_D_ja': row['option_D_ja'],
            'options': options,
            'choices': options,
            'correct_answer_text': row['correct_answer_text'],
            'correct_answer_text_ja': row['correct_answer_text_ja'],
            'explanation_ja': row['explanation_ja'],
            'vocabulary_notes_ja': row['vocabulary_notes_ja'],
            'weak_point_tag': row['weak_point_tag'],
            'passage_title': row['passage_title'],
            'passage_title_ja': row['passage_title_ja'],
        })

    return {
        'student_id': student_id,
        'child_id': student_id,
        'latest_only': bool(latest_only),
        'question_type': question_type or None,
        'weak_point_tag': weak_point_tag or None,
        'wrong_questions': wrong_questions,
    }


def get_eiken_real_exam_part_meta(part_id):
    match = re.fullmatch(r'(\d{4})-(\d)(h?)_(\d)', str(part_id or ''))
    if not match:
        return None
    year, round_no, written_flag, part_no = match.groups()
    mode = 'written' if written_flag else 'listening'
    return {
        'part_id': f'{year}-{round_no}{written_flag}_{part_no}',
        'exam_id': f'{year}-{round_no}',
        'year': int(year),
        'round': int(round_no),
        'mode': mode,
        'mode_label': '筆記' if mode == 'written' else 'リスニング',
        'part_number': int(part_no),
        'label': f'第{part_no}部',
    }


def resolve_eiken_real_exam_answer_path(part_id):
    meta = get_eiken_real_exam_part_meta(part_id)
    if not meta:
        return ''
    filename = f'ans{meta["part_id"]}.html'
    primary_dir = EIKEN_REAL_EXAM_WRITTEN_ANSWER_DIR if meta['mode'] == 'written' else EIKEN_REAL_EXAM_LISTENING_ANSWER_DIR
    for directory in (primary_dir, EIKEN_REAL_EXAM_LEGACY_ANSWER_DIR):
        answer_path = os.path.join(directory, filename)
        if os.path.isfile(answer_path):
            return answer_path
    return os.path.join(primary_dir, filename)


def list_eiken_real_exams():
    if not os.path.isdir(EIKEN_REAL_EXAM_DIR):
        return []

    exams = {}
    for filename in os.listdir(EIKEN_REAL_EXAM_DIR):
        if not filename.endswith('.html') or filename == 'eikenj2.html':
            continue
        meta = get_eiken_real_exam_part_meta(filename[:-5])
        if not meta:
            continue
        exam = exams.setdefault(
            meta['exam_id'],
            {
                'exam_id': meta['exam_id'],
                'year': meta['year'],
                'round': meta['round'],
                'label': f'{meta["year"]}年度 第{meta["round"]}回',
                'listening_parts': [],
                'written_parts': [],
            },
        )
        part = {
            'part_id': meta['part_id'],
            'label': meta['label'],
            'mode': meta['mode'],
            'part_number': meta['part_number'],
        }
        part_key = 'written_parts' if meta['mode'] == 'written' else 'listening_parts'
        exam[part_key].append(part)

    for exam in exams.values():
        exam['listening_parts'].sort(key=lambda item: item['part_number'])
        exam['written_parts'].sort(key=lambda item: item['part_number'])
        exam['part_count'] = len(exam['listening_parts']) + len(exam['written_parts'])

    return sorted(exams.values(), key=lambda item: (item['year'], item['round']), reverse=True)


def sanitize_eiken_real_exam_html(part_id):
    meta = get_eiken_real_exam_part_meta(part_id)
    if not meta:
        raise LookupError('exam part not found')

    path = os.path.join(EIKEN_REAL_EXAM_DIR, f'{meta["part_id"]}.html')
    if not os.path.isfile(path):
        raise LookupError('exam part not found')

    with open(path, 'r', encoding='utf-8', errors='ignore') as handle:
        html = handle.read()

    title_match = re.search(r'<font[^>]*style="font-size\s*:\s*150%;?"[^>]*>(.*?)</font>', html, flags=re.I | re.S)
    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else f'英検準2級 {meta["label"]}'

    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, flags=re.I | re.S)
    content = body_match.group(1) if body_match else html
    content = re.sub(r'<script\b[^>]*>.*?</script>', '', content, flags=re.I | re.S)
    content = re.sub(r'<!-- timer -->.*?<!-- /timer -->', '', content, flags=re.I | re.S)
    content = re.sub(r'<input\b[^>]*type=["\']hidden["\'][^>]*>', '', content, flags=re.I)
    content = re.sub(r'<input\b[^>]*type=["\']text["\'][^>]*>', '', content, flags=re.I)
    content = re.sub(r'<input\b[^>]*type=["\']button["\'][^>]*>', '', content, flags=re.I)
    content = re.sub(r'</?form\b[^>]*>', '', content, flags=re.I)
    content = re.sub(r'on\w+=["\'][^"\']*["\']', '', content, flags=re.I)
    content = re.sub(r'<a\b[^>]*href=["\'][^"\']*["\'][^>]*>(.*?)</a>', r'\1', content, flags=re.I | re.S)

    asset_paths = []

    def rewrite_asset(match):
        attr = match.group(1)
        quote = match.group(2)
        value = match.group(3).strip()
        if re.match(r'^(https?:|data:|#)', value, flags=re.I):
            return match.group(0)
        normalized = value.replace('\\', '/').lstrip('./')
        asset_paths.append(normalized)
        return f'{attr}={quote}/api/eiken-real-exams/assets/{normalized}{quote}'

    content = re.sub(r'\b(src)=(["\'])([^"\']+)\2', rewrite_asset, content, flags=re.I)
    audio_paths = [path for path in asset_paths if path.lower().endswith(('.mp3', '.wav', '.m4a'))]
    image_paths = [path for path in asset_paths if path.lower().endswith(('.png', '.gif', '.jpg', '.jpeg'))]
    question_number_candidates = set()
    question_number_candidates.update(int(number) for number in re.findall(r'問\s*(\d+)', content))
    question_number_candidates.update(
        int(number)
        for number in re.findall(r'<input\b[^>]*type=["\']radio["\'][^>]*name=["\'][^"\']*?(\d+)["\']', content, flags=re.I)
    )
    question_numbers = sorted(question_number_candidates)

    return {
        **meta,
        'title': title,
        'html': content,
        'audio_paths': [f'/api/eiken-real-exams/assets/{path}' for path in audio_paths],
        'image_paths': [f'/api/eiken-real-exams/assets/{path}' for path in image_paths],
        'question_count': len(question_numbers),
        'question_numbers': question_numbers,
    }


def normalize_eiken_answer(value):
    text = str(value or '').strip()
    match = re.search(r'[1-4]', text)
    return f'({match.group(0)})' if match else text


def sanitize_eiken_answer_explanation_html(fragment):
    content = str(fragment or '')
    content = re.sub(r'<script\b[^>]*>.*?</script>', '', content, flags=re.I | re.S)
    content = re.sub(r'</?form\b[^>]*>', '', content, flags=re.I)
    content = re.sub(r'<input\b[^>]*>', '', content, flags=re.I)
    content = re.sub(r'<button\b[^>]*>.*?</button>', '', content, flags=re.I | re.S)
    content = re.sub(r'on\w+=["\'][^"\']*["\']', '', content, flags=re.I)
    content = re.sub(r'<a\b[^>]*href=["\'][^"\']*["\'][^>]*>(.*?)</a>', r'\1', content, flags=re.I | re.S)

    def rewrite_asset(match):
        attr = match.group(1)
        quote = match.group(2)
        value = match.group(3).strip()
        if re.match(r'^(https?:|data:|#)', value, flags=re.I):
            return match.group(0)
        normalized = value.replace('\\', '/').lstrip('./')
        return f'{attr}={quote}/api/eiken-real-exams/assets/{normalized}{quote}'

    content = re.sub(r'\b(src)=(["\'])([^"\']+)\2', rewrite_asset, content, flags=re.I)
    return content.strip()


def strip_eiken_answer_text(fragment):
    text = re.sub(r'<br\s*/?>', '\n', str(fragment or ''), flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    return re.sub(r'[ \t\r\f\v]+', ' ', text).strip()


def parse_eiken_real_exam_answer_page(part_id, question_numbers=None):
    meta = get_eiken_real_exam_part_meta(part_id)
    if not meta:
        return {'answer_key': {}, 'explanations': []}

    answer_path = resolve_eiken_real_exam_answer_path(meta['part_id'])
    if not os.path.isfile(answer_path):
        return {'answer_key': {}, 'explanations': []}

    try:
        with open(answer_path, 'r', encoding='utf-8', errors='ignore') as handle:
            html_content = handle.read()
    except OSError:
        return {'answer_key': {}, 'explanations': []}

    # Each answer page stores one question's choices, translation, answer, and explanation
    # in the table cell that contains "答え：".
    answer_blocks = []
    for match in re.finditer(r'<th\b[^>]*>(.*?)</th>', html_content, flags=re.I | re.S):
        inner_html = match.group(1)
        if '答え' in strip_eiken_answer_text(inner_html):
            answer_blocks.append(inner_html)

    resolved_question_numbers = list(question_numbers or [])
    if not resolved_question_numbers:
        resolved_question_numbers = list(range(1, len(answer_blocks) + 1))

    answer_key = {}
    explanations = []
    for index, block_html in enumerate(answer_blocks):
        if index >= len(resolved_question_numbers):
            break
        question_number = int(resolved_question_numbers[index])
        block_text = strip_eiken_answer_text(block_html)
        answer_match = re.search(r'答え\s*[:：]?\s*\(?\s*([1-4])\s*\)?', block_text)
        if not answer_match:
            continue
        correct_answer = normalize_eiken_answer(answer_match.group(1))
        answer_key[question_number] = correct_answer
        explanations.append({
            'question_number': question_number,
            'correct_answer': correct_answer,
            'html': sanitize_eiken_answer_explanation_html(block_html),
            'text': block_text,
        })

    return {'answer_key': answer_key, 'explanations': explanations}


def load_eiken_real_exam_answer_key():
    if not os.path.exists(EIKEN_REAL_EXAM_ANSWER_KEY_FILENAME):
        return {}
    try:
        with open(EIKEN_REAL_EXAM_ANSWER_KEY_FILENAME, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def get_eiken_real_exam_answer_key(part_id):
    all_keys = load_eiken_real_exam_answer_key()
    raw_key = all_keys.get(part_id) or {}
    parsed_key = parse_eiken_real_exam_answer_page(part_id).get('answer_key') or {}
    if isinstance(raw_key, list):
        parsed_key.update({index + 1: normalize_eiken_answer(value) for index, value in enumerate(raw_key)})
        return parsed_key
    if isinstance(raw_key, dict):
        normalized = dict(parsed_key)
        for key, value in raw_key.items():
            match = re.search(r'\d+', str(key))
            if match:
                normalized[int(match.group(0))] = normalize_eiken_answer(value)
        return normalized
    return parsed_key


def submit_eiken_real_exam_attempt(child_id, part_id, answers, started_at=None):
    meta = get_eiken_real_exam_part_meta(part_id)
    if not meta:
        raise LookupError('exam part not found')
    part_data = sanitize_eiken_real_exam_html(part_id)
    question_numbers = part_data.get('question_numbers') or []
    parsed_answers = parse_eiken_real_exam_answer_page(meta['part_id'], question_numbers)
    answer_key = parsed_answers.get('answer_key') or get_eiken_real_exam_answer_key(meta['part_id'])
    explanations_by_number = {
        int(item['question_number']): item
        for item in parsed_answers.get('explanations', [])
        if item.get('question_number') is not None
    }
    key_available = bool(answer_key)
    now = get_now_iso()
    attempt_id = uuid.uuid4().hex

    normalized_answers = {}
    for key, value in (answers or {}).items():
        match = re.search(r'\d+', str(key))
        if match:
            normalized_answers[int(match.group(0))] = normalize_eiken_answer(value)

    rows = []
    correct_count = 0
    answered_count = 0
    wrong_questions = []
    for question_number in question_numbers:
        student_answer = normalized_answers.get(question_number, '')
        correct_answer = answer_key.get(question_number, '') if key_available else ''
        is_correct = None
        if student_answer:
            answered_count += 1
        if key_available:
            is_correct = bool(student_answer and student_answer == correct_answer)
            if is_correct:
                correct_count += 1
            else:
                wrong_questions.append({
                    'question_number': question_number,
                    'student_answer': student_answer,
                    'correct_answer': correct_answer,
                    'explanation': explanations_by_number.get(question_number),
                })
        rows.append((question_number, student_answer, correct_answer, is_correct))

    total_questions = len(question_numbers)
    score_percent = round((correct_count / total_questions) * 100, 1) if key_available and total_questions else None

    init_db()
    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
        if not child_row:
            raise LookupError('child not found')
        conn.execute(
            '''
            INSERT INTO eiken_real_exam_attempts (
                attempt_id, child_id, part_id, exam_id, mode, started_at, submitted_at,
                total_questions, answered_count, correct_count, score_percent, answer_key_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                attempt_id,
                child_id,
                meta['part_id'],
                meta['exam_id'],
                meta['mode'],
                started_at,
                now,
                total_questions,
                answered_count,
                correct_count if key_available else None,
                score_percent,
                1 if key_available else 0,
            ),
        )
        for question_number, student_answer, correct_answer, is_correct in rows:
            conn.execute(
                '''
                INSERT INTO eiken_real_exam_student_answers (
                    attempt_id, child_id, part_id, question_number, student_answer,
                    correct_answer, is_correct, answered_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    attempt_id,
                    child_id,
                    meta['part_id'],
                    question_number,
                    student_answer,
                    correct_answer,
                    None if is_correct is None else (1 if is_correct else 0),
                    now,
                ),
            )
        conn.commit()
    finally:
        conn.close()

    return {
        'attempt_id': attempt_id,
        'child_id': child_id,
        'part_id': meta['part_id'],
        'exam_id': meta['exam_id'],
        'mode': meta['mode'],
        'submitted_at': now,
        'total_questions': total_questions,
        'answered_count': answered_count,
        'correct_count': correct_count if key_available else None,
        'score_percent': score_percent,
        'answer_key_available': key_available,
        'correct_answers': {f'問{number}': answer for number, answer in sorted(answer_key.items())},
        'explanations': [explanations_by_number[number] for number in question_numbers if number in explanations_by_number],
        'wrong_questions': wrong_questions,
    }


def get_eiken_real_exam_wrong_questions(child_id, limit=None):
    init_db()
    conn = get_db_connection()
    try:
        sql = '''
            WITH latest_answers AS (
                SELECT
                    answer.id,
                    answer.attempt_id,
                    answer.child_id,
                    answer.part_id,
                    answer.question_number,
                    answer.student_answer,
                    answer.correct_answer,
                    answer.is_correct,
                    answer.answered_at,
                    attempt.exam_id,
                    attempt.mode,
                    attempt.submitted_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY answer.child_id, answer.part_id, answer.question_number
                        ORDER BY answer.answered_at DESC, answer.id DESC
                    ) AS rn
                FROM eiken_real_exam_student_answers AS answer
                LEFT JOIN eiken_real_exam_attempts AS attempt
                    ON attempt.attempt_id = answer.attempt_id
                WHERE answer.child_id = ?
            )
            SELECT
                id,
                attempt_id,
                child_id,
                part_id,
                question_number,
                student_answer,
                correct_answer,
                is_correct,
                answered_at,
                exam_id,
                mode,
                submitted_at
            FROM latest_answers
            WHERE rn = 1 AND is_correct = 0
            ORDER BY answered_at DESC, id DESC
        '''
        params = [child_id]
        if limit is not None:
            sql += ' LIMIT ?'
            params.append(limit)
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    wrong_questions = []
    for row in rows:
        student_answer = row['student_answer'] or ''
        correct_answer = row['correct_answer'] or ''
        section_type = row['mode'] or ('written' if str(row['part_id'] or '').find('h_') >= 0 else 'listening')
        item = {
            'id': row['id'],
            'attempt_id': row['attempt_id'],
            'attemptId': row['attempt_id'],
            'child_id': row['child_id'],
            'childId': row['child_id'],
            'part_id': row['part_id'],
            'partId': row['part_id'],
            'question_number': row['question_number'],
            'questionNumber': row['question_number'],
            'student_answer': student_answer,
            'studentAnswer': student_answer,
            'selected_answer': student_answer,
            'selectedAnswer': student_answer,
            'correct_answer': correct_answer,
            'correctAnswer': correct_answer,
            'is_correct': bool(row['is_correct']),
            'isCorrect': bool(row['is_correct']),
            'answered_at': row['answered_at'],
            'answeredAt': row['answered_at'],
            'created_at': row['answered_at'],
            'createdAt': row['answered_at'],
            'exam_id': row['exam_id'],
            'examId': row['exam_id'],
            'mode': row['mode'],
            'section_type': section_type,
            'sectionType': section_type,
            'question_type': section_type,
            'questionType': section_type,
            'submitted_at': row['submitted_at'],
            'submittedAt': row['submitted_at'],
        }
        wrong_questions.append(item)
    return wrong_questions


def submit_eiken_real_exam_review_answer(child_id, part_id, question_number, selected_answer):
    meta = get_eiken_real_exam_part_meta(part_id)
    if not meta:
        raise LookupError('exam part not found')

    part_data = sanitize_eiken_real_exam_html(meta['part_id'])
    question_numbers = part_data.get('question_numbers') or []
    normalized_question_number = int(question_number)
    if normalized_question_number not in question_numbers:
        raise LookupError('question not found')

    parsed_answers = parse_eiken_real_exam_answer_page(meta['part_id'], question_numbers)
    answer_key = parsed_answers.get('answer_key') or get_eiken_real_exam_answer_key(meta['part_id'])
    correct_answer = answer_key.get(normalized_question_number, '')
    if not correct_answer:
        raise LookupError('answer key not found')

    normalized_selected = normalize_eiken_answer(selected_answer)
    is_correct = bool(normalized_selected and normalized_selected == correct_answer)
    now = get_now_iso()
    attempt_id = uuid.uuid4().hex

    init_db()
    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
        if not child_row:
            raise LookupError('child not found')
        conn.execute(
            '''
            INSERT INTO eiken_real_exam_attempts (
                attempt_id, child_id, part_id, exam_id, mode, started_at, submitted_at,
                total_questions, answered_count, correct_count, score_percent, answer_key_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                attempt_id,
                child_id,
                meta['part_id'],
                meta['exam_id'],
                meta['mode'],
                now,
                now,
                1,
                1 if normalized_selected else 0,
                1 if is_correct else 0,
                100.0 if is_correct else 0.0,
                1,
            ),
        )
        conn.execute(
            '''
            INSERT INTO eiken_real_exam_student_answers (
                attempt_id, child_id, part_id, question_number, student_answer,
                correct_answer, is_correct, answered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                attempt_id,
                child_id,
                meta['part_id'],
                normalized_question_number,
                normalized_selected,
                correct_answer,
                1 if is_correct else 0,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        'attempt_id': attempt_id,
        'attemptId': attempt_id,
        'child_id': child_id,
        'childId': child_id,
        'part_id': meta['part_id'],
        'partId': meta['part_id'],
        'question_number': normalized_question_number,
        'questionNumber': normalized_question_number,
        'student_answer': normalized_selected,
        'studentAnswer': normalized_selected,
        'selected_answer': normalized_selected,
        'selectedAnswer': normalized_selected,
        'correct_answer': correct_answer,
        'correctAnswer': correct_answer,
        'is_correct': is_correct,
        'isCorrect': is_correct,
        'mastered': is_correct,
        'resolved': is_correct,
        'message': '復習済み' if is_correct else 'もう一度チャレンジ',
    }


@app.route('/api/eiken-real-exams')
def api_eiken_real_exams():
    return jsonify({'exams': list_eiken_real_exams()})


@app.route('/api/eiken-real-exams/parts/<part_id>')
def api_eiken_real_exam_part(part_id):
    try:
        return jsonify(sanitize_eiken_real_exam_html(part_id))
    except LookupError as exc:
        abort(404, str(exc))


@app.route('/api/eiken-real-exams/attempts', methods=['POST'])
def api_eiken_real_exam_attempts():
    data = request.get_json(silent=True) or {}
    child_id = data.get('child_id') or data.get('childId')
    part_id = data.get('part_id') or data.get('partId')
    answers = data.get('answers') or {}
    if child_id in [None, '', 'null']:
        abort(400, 'child_id is required')
    if not part_id:
        abort(400, 'part_id is required')
    try:
        child_id = int(child_id)
        result = submit_eiken_real_exam_attempt(child_id, part_id, answers, data.get('started_at') or data.get('startedAt'))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/eiken-real-exam/wrong-questions')
def api_eiken_real_exam_wrong_questions():
    child_id = request.args.get('child_id') or request.args.get('childId')
    raw_limit = request.args.get('limit')
    if child_id in [None, '', 'null']:
        abort(400, 'child_id is required')
    try:
        child_id = int(child_id)
        limit = int(raw_limit) if raw_limit not in [None, '', 'null'] else None
    except ValueError as exc:
        abort(400, str(exc))
    wrong_questions = get_eiken_real_exam_wrong_questions(child_id, limit)
    return jsonify({
        'child_id': child_id,
        'childId': child_id,
        'count': len(wrong_questions),
        'wrong_questions': wrong_questions,
        'wrongQuestions': wrong_questions,
    })


@app.route('/api/eiken-real-exam/wrong-questions/review', methods=['POST'])
def api_eiken_real_exam_wrong_question_review():
    data = request.get_json(silent=True) or {}
    child_id = data.get('child_id') or data.get('childId')
    part_id = data.get('part_id') or data.get('partId')
    question_number = data.get('question_number') or data.get('questionNumber')
    selected_answer = data.get('selected_answer') or data.get('selectedAnswer') or data.get('student_answer') or data.get('studentAnswer')
    if child_id in [None, '', 'null']:
        abort(400, 'child_id is required')
    if not part_id:
        abort(400, 'part_id is required')
    if question_number in [None, '', 'null']:
        abort(400, 'question_number is required')
    if not selected_answer:
        abort(400, 'selected_answer is required')
    try:
        result = submit_eiken_real_exam_review_answer(
            int(child_id),
            part_id,
            int(question_number),
            selected_answer,
        )
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/eiken-real-exams/assets/<path:asset_path>')
def api_eiken_real_exam_asset(asset_path):
    return send_from_directory(data_path(EIKEN_REAL_EXAM_DIR), asset_path)


@app.route('/api/tts')
def tts():
    text = request.args.get('text', '').strip()
    lang = request.args.get('lang', 'en').strip() or 'en'
    if not text:
        abort(400, 'text is required')
    if len(text) > 500:
        abort(400, 'text is too long')
    try:
        audio = fetch_tts_audio(text, lang)
    except Exception as exc:
        abort(502, f'TTS failed: {exc}')
    return Response(audio, mimetype='audio/mpeg')


@app.route('/health')
def health():
    return jsonify(status='ok')


@app.route('/')
def home():
    return redirect('/app/')


@app.route('/app', defaults={'path': ''})
@app.route('/app/', defaults={'path': ''})
@app.route('/app/<path:path>')
def serve_react_app(path):
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    if path and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')


@app.route('/assets/<path:path>')
def serve_react_assets(path):
    dist_assets_dir = os.path.join(app.root_path, 'frontend', 'dist', 'assets')
    return send_from_directory(dist_assets_dir, path)


@app.route('/eiken/audio/<path:filename>')
def serve_eiken_audio(filename):
    dist_audio_dir = os.path.join(app.root_path, 'frontend', 'dist', 'eiken', 'audio')
    public_audio_dir = os.path.join(app.root_path, 'frontend', 'public', 'eiken', 'audio')
    if os.path.exists(os.path.join(dist_audio_dir, filename)):
        return send_from_directory(dist_audio_dir, filename)
    return send_from_directory(public_audio_dir, filename)


@app.route('/eiken/images/<path:filename>')
def serve_eiken_images(filename):
    dist_images_dir = os.path.join(app.root_path, 'frontend', 'dist', 'eiken', 'images')
    public_images_dir = os.path.join(app.root_path, 'frontend', 'public', 'eiken', 'images')
    if os.path.exists(os.path.join(dist_images_dir, filename)):
        return send_from_directory(dist_images_dir, filename)
    return send_from_directory(public_images_dir, filename)


@app.route('/api/home')
def api_home():
    settings = load_settings()
    progress = load_progress()
    target = settings.get('daily_target', 20)
    progress_count = int(progress.get('count') or 0)
    remain = max(0, target - progress_count)
    total_words = len(vocab_list)
    child_id = request.args.get('child_id', '').strip()
    if child_id:
        try:
            child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
    else:
        child_id = None

    if child_id is not None:
        conn = get_db_connection()
        try:
            child_row = conn.execute(
                'SELECT daily_target FROM children WHERE id = ?',
                (child_id,),
            ).fetchone()
            daily_row = conn.execute(
                'SELECT studied_count FROM daily_study_log WHERE child_id = ? AND study_date = ?',
                (child_id, get_today()),
            ).fetchone()
            mastered_row = conn.execute(
                'SELECT COUNT(*) AS count FROM child_vocab_progress WHERE child_id = ? AND mastered = 1',
                (child_id,),
            ).fetchone()
            review_needed_row = conn.execute(
                '''
                SELECT COUNT(*) AS count
                FROM child_vocab_progress
                WHERE child_id = ? AND status = 'review'
                ''',
                (child_id,),
            ).fetchone()
            study_days_row = conn.execute(
                'SELECT COUNT(DISTINCT study_date) AS count FROM daily_study_log WHERE child_id = ? AND studied_count > 0',
                (child_id,),
            ).fetchone()
            stage_clear_set = get_child_world_stage_clear_set(conn, child_id)
        finally:
            conn.close()
        if child_row and child_row['daily_target']:
            target = int(child_row['daily_target'])
        progress_count = int(daily_row['studied_count'] or 0) if daily_row else 0
        remain = max(0, target - progress_count)
        mastered_words = int(mastered_row['count'] or 0) if mastered_row else 0
        review_needed = int(review_needed_row['count'] or 0) if review_needed_row else 0
        study_days = int(study_days_row['count'] or 0) if study_days_row else 0
        eigo_quest_progress = build_eigo_quest_progress_from_clears(stage_clear_set)
    else:
        mastered_words = len(progress.get('mastered_words', []))
        review_needed = 0
        study_days = 1 if progress.get('count', 0) > 0 else 0
        eigo_quest_progress = build_eigo_quest_progress_from_clears(set())

    pet = get_child_pet_state(child_id) or get_pet_state(progress, settings)
    if child_id and pet:
        pet['learned_today'] = progress_count
        pet['daily_target'] = target
        pet['completion'] = min(100, round((progress_count / max(1, target)) * 100))
    return jsonify(
        progress=progress_count,
        studied_today=progress_count,
        target=target,
        remain=remain,
        total_words=total_words,
        mastered_words=mastered_words,
        mastered_total=mastered_words,
        review_needed=review_needed,
        study_days=study_days,
        pet=pet,
        eigo_quest_progress=eigo_quest_progress,
    )


@app.route('/api/pet-exp', methods=['POST'])
def api_pet_exp():
    data = request.get_json(silent=True) or {}
    child_id = data.get('child_id')
    exp_amount = data.get('exp_amount')
    if child_id in [None, '', 'null']:
        abort(400, 'child_id is required')
    try:
        child_id = int(child_id)
    except (TypeError, ValueError):
        abort(400, 'child_id must be an integer')
    try:
        exp_amount = int(exp_amount)
    except (TypeError, ValueError):
        abort(400, 'exp_amount must be an integer')

    pet = addPetExp(child_id, exp_amount)
    return jsonify(pet=pet, pet_exp_awarded=exp_amount)


@app.route('/api/flashcard')
def api_flashcard():
    requested_word = request.args.get('word', '').strip()
    importance = request.args.get('importance', '').strip()
    frequency = request.args.get('frequency', '').strip()
    child_id = parse_optional_child_id_arg()
    mastered_vocab_ids = set()
    mastered_words = []
    if child_id is not None:
        conn = get_db_connection()
        try:
            child_row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
            if not child_row:
                abort(404, 'child not found')
            mastered_rows = conn.execute(
                'SELECT vocab_id FROM child_vocab_progress WHERE child_id = ? AND mastered = 1',
                (child_id,),
            ).fetchall()
            mastered_vocab_ids = {str(row['vocab_id']) for row in mastered_rows}
        finally:
            conn.close()
    else:
        progress = load_progress()
        mastered_words = [w.strip() for w in progress.get('mastered_words', []) if w.strip()]
    entries = filter_vocab_entries(vocab_list, importance=importance, frequency=frequency)
    if not entries and not vocab_list:
        abort(404, '今日の単語がまだありません')

    if requested_word:
        vocab = resolve_vocab_entry(requested_word, entries) or resolve_vocab_entry(requested_word, vocab_list)
    else:
        if child_id is not None:
            available = [v for v in entries if str(v.get('ID', '')).strip() not in mastered_vocab_ids]
        else:
            available = [v for v in entries if _clean_csv_value(v.get('English')) not in mastered_words]
        if not available:
            available = entries or vocab_list
        vocab = random.choice(available)

    if vocab is None:
        abort(404, 'word not found')

    word = _clean_csv_value(vocab.get('English'))
    if not word:
        abort(404, 'word not found')
    sentence_jp = get_context_sentence(word)
    return jsonify(
        id=vocab.get('ID', ''),
        word=word,
        jp=vocab.get('Japanese', ''),
        cn=vocab.get('Chinese', ''),
        category=vocab.get('Category', ''),
        importance=vocab.get('Importance', ''),
        frequency_in_test=vocab.get('Frequency_In_Test', ''),
        phrase=vocab.get('Phrase', ''),
        synonyms=vocab.get('Synonyms', ''),
        synonyms_japanese=vocab.get('Synonyms_Japanese', ''),
        antonyms=vocab.get('Antonyms', ''),
        antonyms_japanese=vocab.get('Antonyms_Japanese', ''),
        example_short=vocab.get('Example_English_Short', ''),
        example=vocab.get('Example_English', ''),
        example_jp=vocab.get('Example_Japanese', ''),
        example_cn=vocab.get('Example_Chinese', ''),
        sentence_jp=sentence_jp
    )


DAILY_IMPORTANCE_ORDER = {'A': 0, 'B': 1, 'C': 2}
DAILY_PART_OF_SPEECH_ORDER = [
    ('\u52d5\u8a5e', '\u52a8\u8bcd', 'verb', 'v.'),
    ('\u5f62\u5bb9\u8a5e', '\u5f62\u5bb9\u8bcd', 'adjective', 'adj.'),
    ('\u540d\u8a5e', '\u540d\u8bcd', 'noun', 'n.'),
]


def get_daily_importance_rank(vocab):
    importance = str(vocab.get('Importance') or '').strip().upper()
    return DAILY_IMPORTANCE_ORDER.get(importance, 9)


def get_daily_part_of_speech_rank(vocab):
    category = str(vocab.get('Category') or '').strip().lower()
    for index, terms in enumerate(DAILY_PART_OF_SPEECH_ORDER):
        if any(term.lower() in category for term in terms):
            return index
    return 9


def get_child_mastered_vocab_keys(child_id):
    if child_id is None:
        return set()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT vocab_id
            FROM child_vocab_progress
            WHERE child_id = ? AND status = 'mastered'
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    return {str(row['vocab_id']).strip().lower() for row in rows if str(row['vocab_id']).strip()}


WORD_STATUS_VALUES = {'new', 'learning', 'mastered', 'review', 'priority'}
STUDY_MODE_VALUES = {'normal', 'full_review', 'exam_mode'}


def normalize_word_status(status):
    normalized = str(status or '').strip().lower()
    return normalized if normalized in WORD_STATUS_VALUES else 'learning'


def normalize_study_mode(study_mode):
    normalized = str(study_mode or '').strip().lower()
    return normalized if normalized in STUDY_MODE_VALUES else 'normal'


def default_word_status_for_progress(row):
    if not row:
        return 'new'
    explicit_status = str(row['status'] or '').strip().lower() if 'status' in row.keys() else ''
    if explicit_status in WORD_STATUS_VALUES and explicit_status != 'new':
        return explicit_status
    if int(row['mastered'] or 0) == 1 or int(row['mastery'] or 0) >= 100:
        return 'mastered'
    if int(row['wrong_count'] or 0) > 0:
        return 'review'
    return 'learning'


def get_child_word_progress_map(child_id):
    if child_id is None:
        return {}
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT vocab_id, status, mastered_at, last_reviewed_at, wrong_count, correct_count,
                   mastered, mastery, is_parent_marked_mastered, last_studied_at
            FROM child_vocab_progress
            WHERE child_id = ?
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    return {str(row['vocab_id']): row for row in rows}


def get_child_study_mode(child_id):
    if child_id is None:
        return 'normal'
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT study_mode FROM children WHERE id = ?', (child_id,)).fetchone()
    finally:
        conn.close()
    return normalize_study_mode(row['study_mode'] if row else 'normal')


def get_entry_eiken_level(entry):
    return _clean_csv_value(entry.get('Level') or entry.get('level') or entry.get('Eiken_Level') or '準2級')


def build_word_status_payload(child_id, level=None, search=None):
    progress_map = get_child_word_progress_map(child_id)
    level = _clean_csv_value(level)
    search = _clean_csv_value(search).lower()
    words = []
    for entry in vocab_list:
        vocab_id = str(entry.get('ID') or '').strip()
        if not vocab_id:
            continue
        eiken_level = get_entry_eiken_level(entry)
        word = entry.get('English', '')
        meaning = entry.get('Japanese', '')
        if level and level != 'ALL' and eiken_level != level:
            continue
        if search and search not in word.lower() and search not in meaning.lower():
            continue
        progress = progress_map.get(vocab_id)
        status = default_word_status_for_progress(progress)
        words.append({
            'id': int(vocab_id) if vocab_id.isdigit() else vocab_id,
            'word': word,
            'japanese': meaning,
            'meaningJa': meaning,
            'level': eiken_level,
            'status': status,
            'mastered_at': progress['mastered_at'] if progress else None,
            'last_reviewed_at': progress['last_reviewed_at'] if progress else None,
            'wrong_count': int(progress['wrong_count'] or 0) if progress else 0,
            'correct_count': int(progress['correct_count'] or 0) if progress else 0,
            'is_parent_marked_mastered': bool(progress['is_parent_marked_mastered']) if progress else False,
        })
    return words


def get_child_mastered_vocab_entries(child_id, entries=None):
    mastered_keys = get_child_mastered_vocab_keys(child_id)
    if not mastered_keys:
        return []
    source_entries = entries or vocab_list
    return [
        entry for entry in source_entries
        if get_vocab_key(entry) and get_vocab_key(entry).lower() in mastered_keys
    ]


def select_daily_vocab_entries(limit, child_id=None, study_mode=None):
    progress_map = get_child_word_progress_map(child_id)
    study_mode = normalize_study_mode(study_mode or get_child_study_mode(child_id))
    status_order = {'priority': 0, 'review': 1, 'learning': 2, 'new': 3, 'mastered': 4}
    candidates = []
    for index, vocab in enumerate(vocab_list):
        progress = progress_map.get(str(vocab.get('ID') or '').strip())
        status = default_word_status_for_progress(progress)
        if status == 'mastered' and study_mode == 'normal':
            continue
        candidates.append((index, vocab, status, progress))

    candidates.sort(
        key=lambda item: (
            status_order.get(item[2], 9),
            -int(item[3]['wrong_count'] or 0) if item[3] and study_mode == 'exam_mode' else 0,
            get_daily_importance_rank(item[1]),
            get_daily_part_of_speech_rank(item[1]),
            item[0],
        )
    )
    if study_mode == 'full_review':
        regular = [item for item in candidates if item[2] != 'mastered']
        mastered = [item for item in candidates if item[2] == 'mastered']
        review_slots = max(1, limit // 10) if mastered else 0
        candidates = regular[:max(0, limit - review_slots)] + mastered[:review_slots]
    elif study_mode == 'exam_mode':
        regular = [item for item in candidates if item[2] != 'mastered']
        mastered = [item for item in candidates if item[2] == 'mastered']
        review_slots = max(1, limit // 5) if mastered else 0
        candidates = regular[:max(0, limit - review_slots)] + mastered[:review_slots]
    return [vocab for _, vocab, _, _ in candidates[:limit]]


def build_daily_word_payloads(entries, child_id=None):
    progress_map = get_child_word_progress_map(child_id) if child_id is not None else {}
    return [
        {
            'id': vocab.get('ID', ''),
            'word': vocab.get('English', ''),
            'partOfSpeech': vocab.get('Category', ''),
            'meaningJa': vocab.get('Japanese', ''),
            'level': get_entry_eiken_level(vocab),
            'status': default_word_status_for_progress(progress_map.get(str(vocab.get('ID') or '').strip())),
            'meaningZh': vocab.get('Chinese', ''),
            'exampleEn': vocab.get('Example_English', '') or vocab.get('Example_English_Short', ''),
            'exampleJa': vocab.get('Example_Japanese', ''),
            'exampleZh': vocab.get('Example_Chinese', ''),
            'phrase': vocab.get('Phrase', ''),
            'importance': vocab.get('Importance', ''),
        }
        for vocab in entries
    ]


def select_stage_vocab_entries(world_id=None, stage=None, limit=20):
    try:
        stage_number = int(stage)
    except (TypeError, ValueError):
        return None
    normalized_world_id = str(world_id or '').strip().lower()
    world = EIGO_QUEST_WORLD_MAP.get(normalized_world_id)
    if not world:
        return None
    if stage_number < 1 or stage_number > world['stage_count']:
        return None
    safe_limit = EIGO_QUEST_WORDS_PER_STAGE
    start = world['word_start_index'] + (stage_number - 1) * EIGO_QUEST_WORDS_PER_STAGE
    end = start + safe_limit
    world_end = world['word_start_index'] + world['word_count']
    if end > world_end:
        return None
    return vocab_list[start:end]


def normalize_stage_status(status):
    normalized = str(status or '').strip().lower()
    return 'cleared' if normalized in {'clear', 'cleared', 'completed'} else 'in_progress'


def get_child_world_stage_clear_set(conn, child_id):
    rows = conn.execute(
        '''
        SELECT world_id, stage_number
        FROM child_world_stage_progress
        WHERE child_id = ? AND status = 'cleared'
        ''',
        (child_id,),
    ).fetchall()
    return {
        (str(row['world_id']).strip().lower(), int(row['stage_number']))
        for row in rows
    }


def build_eigo_quest_progress_from_clears(clear_set):
    unlocked_next = True
    current_world = None
    current_stage = None
    mainline_complete = True
    worlds = []
    completed_stage_count = 0

    for world in EIGO_QUEST_WORLDS:
        stage_items = []
        world_has_current = False
        world_cleared_count = 0
        for stage_number in range(1, world['stage_count'] + 1):
            key = (world['id'], stage_number)
            cleared = key in clear_set
            unlocked = unlocked_next or cleared
            if cleared:
                status = 'cleared'
                world_cleared_count += 1
                completed_stage_count += 1
            elif unlocked and current_stage is None:
                status = 'current'
                current_world = world['id']
                current_stage = stage_number
                world_has_current = True
                mainline_complete = False
            else:
                status = 'locked'
                mainline_complete = False

            stage_items.append({
                'stage': stage_number,
                'status': status,
                'cleared': cleared,
                'unlocked': unlocked,
            })
            unlocked_next = unlocked_next and cleared

        worlds.append({
            'id': world['id'],
            'order': world['order'],
            'stage_count': world['stage_count'],
            'word_count': world['word_count'],
            'word_start_index': world['word_start_index'],
            'unlocked': any(stage['unlocked'] for stage in stage_items),
            'cleared': world_cleared_count == world['stage_count'],
            'cleared_stage_count': world_cleared_count,
            'has_current_stage': world_has_current,
            'stages': stage_items,
        })

    return {
        'source': 'child_world_stage_progress',
        'total_stages': EIGO_QUEST_TOTAL_STAGES,
        'total_words': EIGO_QUEST_TOTAL_WORDS,
        'completed_stage_count': completed_stage_count,
        'mainline_complete': mainline_complete,
        'current_world': None if mainline_complete else current_world,
        'current_stage': None if mainline_complete else current_stage,
        'worlds': worlds,
    }


def get_child_eigo_quest_progress(child_id):
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        clear_set = get_child_world_stage_clear_set(conn, child_id)
    finally:
        conn.close()
    return build_eigo_quest_progress_from_clears(clear_set)


def get_child_world_stage_progress(child_id, world_id, stage):
    stage_entries = select_stage_vocab_entries(world_id, stage, 20)
    if stage_entries is None:
        raise ValueError('valid world and stage are required')
    stage_number = int(stage)
    normalized_world_id = str(world_id or '').strip().lower()
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        row = conn.execute(
            '''
            SELECT status, cleared_at, updated_at
            FROM child_world_stage_progress
            WHERE child_id = ? AND world_id = ? AND stage_number = ?
            ''',
            (child_id, normalized_world_id, stage_number),
        ).fetchone()
    finally:
        conn.close()

    status = normalize_stage_status(row['status'] if row else 'in_progress')
    return {
        'child_id': child_id,
        'world': normalized_world_id,
        'stage': stage_number,
        'status': status,
        'cleared': status == 'cleared',
        'cleared_at': row['cleared_at'] if row else None,
        'updated_at': row['updated_at'] if row else None,
    }


def mark_child_world_stage_cleared(child_id, world_id, stage):
    stage_entries = select_stage_vocab_entries(world_id, stage, 20)
    if stage_entries is None:
        raise ValueError('valid world and stage are required')
    stage_number = int(stage)
    normalized_world_id = str(world_id or '').strip().lower()
    now = get_now_iso()
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        conn.execute(
            '''
            INSERT INTO child_world_stage_progress (
                child_id, world_id, stage_number, status, cleared_at, created_at, updated_at
            ) VALUES (?, ?, ?, 'cleared', ?, ?, ?)
            ON CONFLICT(child_id, world_id, stage_number) DO UPDATE SET
                status = 'cleared',
                cleared_at = COALESCE(child_world_stage_progress.cleared_at, excluded.cleared_at),
                updated_at = excluded.updated_at
            ''',
            (child_id, normalized_world_id, stage_number, now, now, now),
        )
        conn.commit()
    finally:
        conn.close()
    return get_child_world_stage_progress(child_id, normalized_world_id, stage_number)


def get_stage_reward_codes(world_id, stage):
    normalized_world_id = str(world_id or '').strip().lower()
    try:
        stage_number = int(stage)
    except (TypeError, ValueError):
        return []
    world = EIGO_QUEST_WORLD_MAP.get(normalized_world_id)
    if not world or stage_number < 1 or stage_number > world['stage_count']:
        return []

    reward_codes = []
    stage_codes = EIGO_QUEST_STAGE_REWARD_CODES.get(normalized_world_id, [])
    if 1 <= stage_number <= len(stage_codes):
        reward_codes.append(stage_codes[stage_number - 1])
    if normalized_world_id == 'shadow' and stage_number == world['stage_count']:
        reward_codes.extend(EIGO_QUEST_FINAL_REWARD_CODES)
    return reward_codes


def get_child_owned_hero_code_set(conn, child_id):
    if not _table_exists(conn, 'child_heroes') or not _table_exists(conn, 'heroes'):
        return set()
    rows = conn.execute(
        '''
        SELECT heroes.code
        FROM child_heroes
        JOIN heroes ON heroes.id = child_heroes.hero_id
        WHERE child_heroes.child_id = ?
        ''',
        (child_id,),
    ).fetchall()
    return {str(row['code'] or '') for row in rows if row['code']}


def get_table_columns(conn, table_name):
    try:
        return {row[1] for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()}
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        return set()


def get_hero_row_for_reward_code(conn, reward_code):
    code = str(reward_code or '').strip()
    if not code:
        return None
    codes_to_try = [code]
    legacy_code = EIGO_QUEST_LEGACY_REWARD_CODE_MAP.get(code)
    if legacy_code and legacy_code not in codes_to_try:
        codes_to_try.append(legacy_code)
    for candidate in codes_to_try:
        row = conn.execute(
            f'''
            SELECT {get_hero_select_sql(conn)}
            FROM heroes
            WHERE code = ?
            LIMIT 1
            ''',
            (candidate,),
        ).fetchone()
        if row:
            return row
    return None


def grant_child_hero_rewards(child_id, reward_codes, world_id=None, stage=None, reward_type='stage'):
    reward_codes = [str(code or '').strip() for code in (reward_codes or []) if str(code or '').strip()]
    if not reward_codes:
        return []

    conn = get_db_connection()
    awarded_rows = []
    try:
        ensure_child_exists(conn, child_id)
        if not _table_exists(conn, 'heroes'):
            return []
        if not _table_exists(conn, 'child_heroes'):
            return []

        now = get_now_iso()
        child_hero_columns = get_table_columns(conn, 'child_heroes')
        for code in reward_codes:
            hero_row = get_hero_row_for_reward_code(conn, code)
            if not hero_row:
                continue

            existing = conn.execute(
                'SELECT id FROM child_heroes WHERE child_id = ? AND hero_id = ?',
                (child_id, hero_row['id']),
            ).fetchone()
            if existing:
                continue

            insert_values = {
                'child_id': child_id,
                'hero_id': hero_row['id'],
                'hero_code': code,
                'awarded_world_id': str(world_id or '').strip().lower() or None,
                'awarded_stage_number': int(stage) if stage not in [None, ''] else None,
                'reward_type': reward_type,
                'awarded_at': now,
                'created_at': now,
                'updated_at': now,
            }
            insert_columns = [
                column for column in insert_values
                if column in child_hero_columns or column in {'child_id', 'hero_id'}
            ]
            placeholders = ', '.join(['?'] * len(insert_columns))
            conn.execute(
                f'''
                INSERT INTO child_heroes ({', '.join(insert_columns)})
                VALUES ({placeholders})
                ''',
                tuple(insert_values[column] for column in insert_columns),
            )
            owned = conn.execute(
                'SELECT id FROM child_heroes WHERE child_id = ? AND hero_id = ?',
                (child_id, hero_row['id']),
            ).fetchone()
            if owned:
                awarded_rows.append(hero_row_to_card(hero_row))
        conn.commit()
    finally:
        conn.close()
    return awarded_rows


def grant_child_stage_rewards(child_id, world_id, stage):
    reward_codes = get_stage_reward_codes(world_id, stage)
    return grant_child_hero_rewards(
        child_id,
        reward_codes,
        world_id=world_id,
        stage=stage,
        reward_type='final_pack' if str(world_id).strip().lower() == 'shadow' and int(stage) == 5 else 'stage',
    )


def get_grammar_lesson_reward_hero_row(conn, lesson_id):
    lesson_id = str(lesson_id or '').strip()
    if not lesson_id:
        return None
    if not _table_exists(conn, 'grammar_lesson_rewards') or not _table_exists(conn, 'heroes'):
        return None
    hero_columns = get_table_columns(conn, 'heroes')
    collection_type_select = 'h.collection_type' if 'collection_type' in hero_columns else "NULL AS collection_type"
    collection_key_select = 'h.collection_key' if 'collection_key' in hero_columns else "NULL AS collection_key"
    return conn.execute(
        f'''
        SELECT h.id, h.world_id, h.code, h.name_ja, h.name_cn, h.rarity, h.image_url, h.description_ja,
               {collection_type_select}, {collection_key_select}
        FROM grammar_lesson_rewards glr
        JOIN heroes h ON h.id = glr.hero_id
        WHERE glr.lesson_id = ?
          AND COALESCE(glr.is_active, 1) = 1
        LIMIT 1
        ''',
        (lesson_id,),
    ).fetchone()


def grant_child_grammar_lesson_reward(child_id, lesson_id, lesson_title='', correct_count=0, total_count=0):
    lesson_id = str(lesson_id or '').strip()
    if not lesson_id:
        return []

    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        hero_row = get_grammar_lesson_reward_hero_row(conn, lesson_id)
        if not hero_row:
            return []
        existing = None
        if _table_exists(conn, 'child_heroes'):
            existing = conn.execute(
                'SELECT id FROM child_heroes WHERE child_id = ? AND hero_id = ?',
                (child_id, hero_row['id']),
            ).fetchone()
    finally:
        conn.close()

    awarded_rows = grant_child_hero_rewards(
        child_id,
        [hero_row['code']],
        reward_type='grammar_lesson',
    )
    reward_card = awarded_rows[0] if awarded_rows else hero_row_to_card(hero_row)
    reward_card.update({
        'rewardType': 'grammar_lesson',
        'reward_type': 'grammar_lesson',
        'source': 'grammar_lesson',
        'lessonId': lesson_id,
        'lesson_id': lesson_id,
        'lessonTitle': lesson_title or '',
        'lesson_title': lesson_title or '',
        'correctCount': int(correct_count or 0),
        'correct_count': int(correct_count or 0),
        'totalCount': int(total_count or 0),
        'total_count': int(total_count or 0),
        'alreadyOwned': bool(existing and not awarded_rows),
        'already_owned': bool(existing and not awarded_rows),
    })
    return [reward_card]


def get_stage_quiz_expected_answer(entry, question_type):
    qtype = _clean_csv_value(question_type)
    if qtype == 'Meaning':
        return _clean_csv_value(entry.get('Japanese'))
    return _clean_csv_value(entry.get('English'))


def submit_child_stage_quiz_attempt(child_id, world_id, stage, answers, attempt_id=None):
    stage_entries = select_stage_vocab_entries(world_id, stage, 20)
    if stage_entries is None:
        raise ValueError('valid world and stage are required')
    if not isinstance(answers, list) or not answers:
        raise ValueError('answers are required')

    normalized_world_id = str(world_id or '').strip().lower()
    stage_number = int(stage)
    attempt_id = _clean_csv_value(attempt_id) or str(uuid.uuid4())
    entries_by_id = {
        _clean_csv_value(entry.get('ID')): entry
        for entry in stage_entries
        if _clean_csv_value(entry.get('ID'))
    }
    now = get_now_iso()

    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        existing = conn.execute(
            '''
            SELECT attempt_id, child_id, world_id, stage_number, total_questions,
                   correct_count, passed, answers_json, submitted_at
            FROM child_stage_quiz_attempts
            WHERE attempt_id = ?
            ''',
            (attempt_id,),
        ).fetchone()
        if existing:
            return {
                'attempt_id': existing['attempt_id'],
                'child_id': existing['child_id'],
                'world': existing['world_id'],
                'stage': existing['stage_number'],
                'total': existing['total_questions'],
                'score': existing['correct_count'],
                'passed': bool(existing['passed']),
                'stage_cleared': bool(existing['passed']),
                'submitted_at': existing['submitted_at'],
                'answers': json.loads(existing['answers_json'] or '[]'),
                'reward_queue': [],
                'duplicate': True,
            }

        normalized_answers = []
        correct_count = 0
        for answer in answers:
            if not isinstance(answer, dict):
                continue
            vocab_id = _clean_csv_value(answer.get('id') or answer.get('vocab_id') or answer.get('vocabId'))
            selected = _clean_csv_value(answer.get('selected') or answer.get('selected_answer') or answer.get('selectedAnswer'))
            question_type = _clean_csv_value(answer.get('type') or answer.get('question_type') or answer.get('questionType'))
            entry = entries_by_id.get(vocab_id)
            if not entry:
                continue
            correct_answer = get_stage_quiz_expected_answer(entry, question_type)
            is_correct = bool(selected and correct_answer and selected == correct_answer)
            correct_count += 1 if is_correct else 0
            normalized_answer = {
                'id': vocab_id,
                'word': _clean_csv_value(entry.get('English')),
                'type': question_type,
                'selected': selected,
                'correct': correct_answer,
                'is_correct': is_correct,
            }
            normalized_answers.append(normalized_answer)
            if not is_correct:
                try:
                    numeric_vocab_id = int(vocab_id)
                except (TypeError, ValueError):
                    numeric_vocab_id = None
                if numeric_vocab_id is not None:
                    conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (numeric_vocab_id,))
                    conn.execute(
                        '''
                        INSERT INTO child_vocab_progress (
                            child_id, vocab_id, correct_count, wrong_count, review_count,
                            memory_level, last_studied_at, mastered, created_at, updated_at,
                            correct_streak, mastery, status, last_reviewed_at
                        ) VALUES (?, ?, 0, 1, 1, 0, ?, 0, ?, ?, 0, 0, 'review', ?)
                        ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                            wrong_count = child_vocab_progress.wrong_count + 1,
                            review_count = child_vocab_progress.review_count + 1,
                            correct_streak = 0,
                            status = 'review',
                            last_reviewed_at = excluded.last_reviewed_at,
                            updated_at = excluded.updated_at
                        ''',
                        (child_id, numeric_vocab_id, now, now, now, now),
                    )

        total_questions = len(stage_entries)
        passed = len(normalized_answers) >= total_questions and correct_count >= total_questions
        conn.execute(
            '''
            INSERT INTO child_stage_quiz_attempts (
                attempt_id, child_id, world_id, stage_number, total_questions,
                correct_count, passed, answers_json, submitted_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                attempt_id,
                child_id,
                normalized_world_id,
                stage_number,
                total_questions,
                correct_count,
                1 if passed else 0,
                json.dumps(normalized_answers, ensure_ascii=False),
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    reward_queue = []
    if passed:
        stage_progress = mark_child_world_stage_cleared(child_id, normalized_world_id, stage_number)
        reward_queue = grant_child_stage_rewards(child_id, normalized_world_id, stage_number)
    else:
        stage_progress = get_child_world_stage_progress(child_id, normalized_world_id, stage_number)
    return {
        'attempt_id': attempt_id,
        'child_id': child_id,
        'world': normalized_world_id,
        'stage': stage_number,
        'total': total_questions,
        'score': correct_count,
        'passed': passed,
        'stage_cleared': bool(stage_progress['cleared']),
        'submitted_at': now,
        'answers': normalized_answers,
        'reward_queue': reward_queue,
        'duplicate': False,
    }


def record_child_vocab_wrong_review(child_id, vocab_id, world_id=None, stage_number=None, question_type=None):
    if child_id is None or vocab_id is None:
        raise ValueError('child_id and vocab_id are required')
    normalized_vocab_id = int(vocab_id)
    normalized_world_id = _clean_csv_value(world_id) or None
    normalized_question_type = _clean_csv_value(question_type) or None
    normalized_stage_number = None
    if stage_number not in [None, '', 'null']:
        normalized_stage_number = int(stage_number)
    now = get_now_iso()

    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        ensure_vocab_entry_exists(str(normalized_vocab_id))
        vocab_row = conn.execute('SELECT id FROM vocabulary WHERE id = ?', (normalized_vocab_id,)).fetchone()
        if not vocab_row:
            conn.execute('INSERT INTO vocabulary (id) VALUES (?)', (normalized_vocab_id,))
        conn.execute(
            '''
            INSERT INTO child_vocab_wrong_reviews (
                child_id, vocab_id, world_id, stage_number, question_type,
                wrong_count, last_wrong_at, review_count, last_reviewed_at,
                review_status, mastered_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, 0, NULL, 'pending', NULL, ?, ?)
            ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                world_id = COALESCE(excluded.world_id, child_vocab_wrong_reviews.world_id),
                stage_number = COALESCE(excluded.stage_number, child_vocab_wrong_reviews.stage_number),
                question_type = COALESCE(excluded.question_type, child_vocab_wrong_reviews.question_type),
                wrong_count = child_vocab_wrong_reviews.wrong_count + 1,
                last_wrong_at = excluded.last_wrong_at,
                review_status = 'pending',
                mastered_at = NULL,
                updated_at = excluded.updated_at
            ''',
            (
                child_id,
                normalized_vocab_id,
                normalized_world_id,
                normalized_stage_number,
                normalized_question_type,
                now,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return get_child_vocab_wrong_review_item(child_id, normalized_vocab_id)


def build_vocab_wrong_review_payload(row):
    vocab_id = str(row['vocab_id'])
    vocab = resolve_vocab_entry(vocab_id, vocab_list)
    example_en = ''
    if vocab:
        example_en = (vocab.get('Example_English', '') or vocab.get('Example_English_Short', '')).strip()
    return {
        'child_id': row['child_id'],
        'childId': row['child_id'],
        'vocab_id': row['vocab_id'],
        'vocabId': row['vocab_id'],
        'word': vocab.get('English', '') if vocab else vocab_id,
        'meaning_ja': vocab.get('Japanese', '') if vocab else '',
        'meaningJa': vocab.get('Japanese', '') if vocab else '',
        'meaning_cn': vocab.get('Chinese', '') if vocab else '',
        'meaningCn': vocab.get('Chinese', '') if vocab else '',
        'part_of_speech': vocab.get('Category', '') if vocab else '',
        'partOfSpeech': vocab.get('Category', '') if vocab else '',
        'phrase': vocab.get('Phrase', '') if vocab else '',
        'example_en': example_en,
        'exampleEn': example_en,
        'example_ja': vocab.get('Example_Japanese', '').strip() if vocab else '',
        'exampleJa': vocab.get('Example_Japanese', '').strip() if vocab else '',
        'world_id': row['world_id'],
        'worldId': row['world_id'],
        'stage_number': row['stage_number'],
        'stageNumber': row['stage_number'],
        'question_type': row['question_type'],
        'questionType': row['question_type'],
        'wrong_count': int(row['wrong_count'] or 0),
        'wrongCount': int(row['wrong_count'] or 0),
        'last_wrong_at': row['last_wrong_at'],
        'lastWrongAt': row['last_wrong_at'],
        'review_count': int(row['review_count'] or 0),
        'reviewCount': int(row['review_count'] or 0),
        'last_reviewed_at': row['last_reviewed_at'],
        'lastReviewedAt': row['last_reviewed_at'],
        'review_status': row['review_status'],
        'reviewStatus': row['review_status'],
        'mastered_at': row['mastered_at'],
        'masteredAt': row['mastered_at'],
    }


def get_child_vocab_wrong_review_item(child_id, vocab_id):
    conn = get_db_connection()
    try:
        row = conn.execute(
            '''
            SELECT child_id, vocab_id, world_id, stage_number, question_type,
                   wrong_count, last_wrong_at, review_count, last_reviewed_at,
                   review_status, mastered_at, created_at, updated_at
            FROM child_vocab_wrong_reviews
            WHERE child_id = ? AND vocab_id = ?
            ''',
            (child_id, vocab_id),
        ).fetchone()
    finally:
        conn.close()
    return build_vocab_wrong_review_payload(row) if row else None


def get_child_vocab_wrong_reviews(child_id):
    init_db()
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        rows = conn.execute(
            '''
            SELECT child_id, vocab_id, world_id, stage_number, question_type,
                   wrong_count, last_wrong_at, review_count, last_reviewed_at,
                   review_status, mastered_at, created_at, updated_at
            FROM child_vocab_wrong_reviews
            WHERE child_id = ? AND review_status <> 'mastered'
            ORDER BY wrong_count DESC, last_wrong_at DESC, updated_at DESC
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    return [build_vocab_wrong_review_payload(row) for row in rows]


def build_child_vocab_wrong_review_question(child_id, vocab_id):
    init_db()
    normalized_vocab_id = int(vocab_id)
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
    finally:
        conn.close()

    correct_vocab = resolve_vocab_entry(str(normalized_vocab_id), vocab_list)
    if not correct_vocab:
        raise LookupError('word not found')

    correct_answer = _clean_csv_value(correct_vocab.get('English'))
    meaning_ja = _clean_csv_value(correct_vocab.get('Japanese'))
    if not correct_answer or not meaning_ja:
        raise LookupError('question data not found')

    distractors = [
        _clean_csv_value(entry.get('English'))
        for entry in vocab_list
        if _clean_csv_value(entry.get('ID')) != str(normalized_vocab_id)
        and _clean_csv_value(entry.get('English'))
        and _clean_csv_value(entry.get('English')) != correct_answer
    ]
    distractors = list(dict.fromkeys(distractors))
    if len(distractors) < 3:
        raise LookupError('not enough choices')

    choices = [correct_answer] + random.sample(distractors, 3)
    random.shuffle(choices)
    return {
        'vocab_id': normalized_vocab_id,
        'vocabId': normalized_vocab_id,
        'word': correct_answer,
        'meaning_ja': meaning_ja,
        'meaningJa': meaning_ja,
        'meaning_cn': _clean_csv_value(correct_vocab.get('Chinese')),
        'meaningCn': _clean_csv_value(correct_vocab.get('Chinese')),
        'question_type': 'ja-to-en',
        'questionType': 'ja-to-en',
        'prompt': f'「{meaning_ja}」に合う英単語を選びなさい。',
        'choices': choices,
        'correct_answer': correct_answer,
        'correctAnswer': correct_answer,
    }


def get_database_host_for_debug():
    database_url = get_database_url()
    if not database_url:
        return ''
    parsed = urllib.parse.urlparse(database_url)
    return parsed.hostname or ''


def get_table_count_for_debug(conn, table_name):
    try:
        row = conn.execute(f'SELECT COUNT(*) AS count FROM {table_name}').fetchone()
        return int(row['count'] or 0) if row else 0
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        return {'error': str(exc)}


def hero_row_to_card(row):
    code = str(row['code'] or '').strip()
    world_id = str(row['world_id'] or '').strip()
    image_url = row['image_url'] or ''
    collection_type = str(_row_value(row, 'collection_type') or '').strip().lower()
    collection_key = str(_row_value(row, 'collection_key') or '').strip().lower()
    if not collection_type and (
        code.startswith('grammar-')
        or '/grammar card/' in image_url
        or '/grammar-cards/' in image_url
    ):
        collection_type = 'grammar'
    if collection_type == 'grammar' and not collection_key:
        collection_key = 'temple'
    return {
        'id': code or f'hero-{row["id"]}',
        'heroId': row['id'],
        'worldId': {
            '1': 'wind',
            '2': 'fire',
            '3': 'water',
            '4': 'thunder',
            '5': 'wood',
            '6': 'rock',
            '7': 'light',
            '8': 'shadow',
        }.get(world_id, world_id),
        'code': code,
        'nameJa': row['name_ja'] or '',
        'nameZh': row['name_cn'] or '',
        'type': 'hero',
        'rarity': row['rarity'] or 'R',
        'image': image_url,
        'image_url': image_url,
        'collectionType': collection_type,
        'collection_type': collection_type,
        'collectionKey': collection_key,
        'collection_key': collection_key,
        'descriptionJa': row['description_ja'] or '',
        'unlockCondition': '',
        'reviewMode': 'mixed',
    }


def get_hero_select_sql(conn, table_alias=''):
    columns = get_table_columns(conn, 'heroes')
    prefix = f'{table_alias}.' if table_alias else ''
    collection_type_select = f'{prefix}collection_type' if 'collection_type' in columns else 'NULL AS collection_type'
    collection_key_select = f'{prefix}collection_key' if 'collection_key' in columns else 'NULL AS collection_key'
    return (
        f'id, world_id, code, name_ja, name_cn, rarity, image_url, description_ja, '
        f'{collection_type_select}, {collection_key_select}'
    )


@app.route('/api/heroes')
def api_heroes():
    conn = get_db_connection()
    try:
        if not _table_exists(conn, 'heroes'):
            return jsonify(heroes=[])
        rows = conn.execute(
            f'''
            SELECT {get_hero_select_sql(conn)}
            FROM heroes
            ORDER BY world_id, id
            '''
        ).fetchall()
    finally:
        conn.close()
    return jsonify(heroes=[hero_row_to_card(row) for row in rows])


@app.route('/api/children/<int:child_id>/heroes')
def api_child_heroes(child_id):
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        if not _table_exists(conn, 'heroes'):
            return jsonify(heroes=[], owned_hero_ids=[], owned_codes=[])

        owned_codes = get_child_owned_hero_code_set(conn, child_id)
        rows = conn.execute(
            f'''
            SELECT {get_hero_select_sql(conn)}
            FROM heroes
            ORDER BY world_id, id
            '''
        ).fetchall()
    except LookupError as exc:
        abort(404, str(exc))
    finally:
        conn.close()

    heroes = []
    owned_hero_ids = []
    for row in rows:
        card = hero_row_to_card(row)
        card['owned'] = card['code'] in owned_codes
        if card['owned']:
            owned_hero_ids.append(card['id'])
        heroes.append(card)
    return jsonify(
        heroes=heroes,
        owned_hero_ids=owned_hero_ids,
        owned_codes=sorted(owned_codes),
    )


@app.route('/debug/db')
def debug_db():
    child_id = request.args.get('child_id', '').strip()
    resolved_child_id = None
    if child_id:
        try:
            resolved_child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')

    payload = {
        'database_type': 'postgres' if use_postgres() else 'sqlite',
        'database_url_present': bool(get_database_url()),
        'database_url_host': get_database_host_for_debug(),
        'database_path': get_db_path() if not use_postgres() else '',
        'csv_word_count': len(vocab_list),
        'first_5_words': [
            {
                'id': entry.get('ID', ''),
                'word': entry.get('English', ''),
                'meaningJa': entry.get('Japanese', ''),
            }
            for entry in vocab_list[:5]
        ],
    }

    try:
        conn = get_db_connection()
        try:
            payload.update(
                child_count=get_table_count_for_debug(conn, 'children'),
                db_vocabulary_count=get_table_count_for_debug(conn, 'vocabulary'),
                daily_study_log_count=get_table_count_for_debug(conn, 'daily_study_log'),
            )
        finally:
            conn.close()
    except Exception as exc:
        app.logger.exception('Failed to inspect debug database')
        payload.update(
            child_count={'error': str(exc)},
            db_vocabulary_count={'error': str(exc)},
            daily_study_log_count={'error': str(exc)},
        )

    try:
        daily_entries = select_daily_vocab_entries(20, resolved_child_id, 'normal')
        payload['daily_words_count'] = len(daily_entries)
        payload['daily_words_preview'] = [
            {
                'id': entry.get('ID', ''),
                'word': entry.get('English', ''),
                'meaningJa': entry.get('Japanese', ''),
            }
            for entry in daily_entries[:5]
        ]
    except Exception as exc:
        app.logger.exception('Failed to build debug daily words')
        payload['daily_words_count'] = {'error': str(exc)}
        payload['daily_words_preview'] = []

    return jsonify(payload)


@app.route('/api/daily-words')
def api_daily_words():
    child_id = request.args.get('child_id', '').strip()
    requested_limit = request.args.get('limit')
    requested_world = request.args.get('world', '').strip()
    requested_stage = request.args.get('stage', '').strip()
    resolved_child_id = None
    child_row = None
    if child_id:
        try:
            resolved_child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
        conn = get_db_connection()
        try:
            child_row = conn.execute('SELECT daily_target, study_mode FROM children WHERE id = ?', (resolved_child_id,)).fetchone()
        finally:
            conn.close()
        if not child_row:
            abort(404, 'child not found')
    try:
        limit = int(requested_limit if requested_limit not in [None, ''] else 20)
    except (TypeError, ValueError):
        limit = 20
    if requested_limit in [None, ''] and child_row:
        if child_row and child_row['daily_target']:
            limit = int(child_row['daily_target'])
    limit = max(1, min(200, limit))
    study_mode = normalize_study_mode(child_row['study_mode'] if child_row else 'normal')
    has_stage_request = bool(requested_world) or requested_stage not in [None, '']
    stage_entries = select_stage_vocab_entries(requested_world, requested_stage, limit)
    if has_stage_request and stage_entries is None:
        abort(400, 'valid world and stage are required')
    if stage_entries is not None:
        words = build_daily_word_payloads(stage_entries, resolved_child_id)
        return jsonify(
            words=words,
            targetWordCount=len(words),
            studyMode=study_mode,
            world=requested_world,
            stage=int(requested_stage),
            reviewMode='stage',
        )
    words = build_daily_word_payloads(select_daily_vocab_entries(limit, resolved_child_id, study_mode), resolved_child_id)
    return jsonify(words=words, targetWordCount=limit, studyMode=study_mode)


@app.route('/api/children/<int:child_id>/daily-words')
def api_child_daily_words(child_id):
    return api_daily_words_for_child(child_id)


def api_daily_words_for_child(child_id):
    requested_limit = request.args.get('limit')
    conn = get_db_connection()
    try:
        child_row = conn.execute('SELECT daily_target, study_mode FROM children WHERE id = ?', (child_id,)).fetchone()
    finally:
        conn.close()
    if not child_row:
        abort(404, 'child not found')
    try:
        limit = int(requested_limit if requested_limit not in [None, ''] else child_row['daily_target'] or 20)
    except (TypeError, ValueError):
        limit = int(child_row['daily_target'] or 20)
    limit = max(1, min(200, limit))
    study_mode = normalize_study_mode(child_row['study_mode'])
    words = build_daily_word_payloads(select_daily_vocab_entries(limit, child_id, study_mode), child_id)
    return jsonify(words=words, targetWordCount=limit, studyMode=study_mode)


def ensure_child_exists(conn, child_id):
    row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
    if not row:
        abort(404, 'child not found')


def require_child_belongs_to_current_account(child_id):
    account = require_current_account()
    account_id = account['id']
    conn = get_db_connection()
    try:
        row = conn.execute(
            'SELECT id FROM children WHERE id = ? AND account_id = ?',
            (child_id, account_id),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        abort(404, 'child not found')
    return row


def is_production_env():
    if any(
        os.getenv(name, '').strip().lower() in {'1', 'true', 'yes', 'on', 'production', 'prod'}
        for name in ['ENV', 'FLASK_ENV', 'APP_ENV', 'RENDER']
    ):
        return True
    return any(
        os.getenv(name, '').strip().lower().startswith('https://')
        for name in ['FRONTEND_ORIGIN', 'FRONTEND_URL', 'RENDER_EXTERNAL_URL']
    )


def get_auth_cookie_secure():
    if is_production_env():
        return True
    configured = os.getenv('AUTH_COOKIE_SECURE', '').strip().lower()
    if configured in {'1', 'true', 'yes', 'on'}:
        return True
    if configured in {'0', 'false', 'no', 'off'}:
        return False
    return False


def get_auth_cookie_samesite():
    return 'None' if is_production_env() else 'Lax'


def get_auth_cookie_options():
    return {
        'httponly': True,
        'secure': get_auth_cookie_secure(),
        'samesite': get_auth_cookie_samesite(),
        'path': '/',
    }


def auth_account_payload(row):
    return {
        'id': row['id'],
        'email': row['email'],
        'phone': row['phone'],
        'provider': row['provider'],
        'display_name': row['display_name'],
        'displayName': row['display_name'],
    }


def normalize_family_code(value):
    cleaned = _clean_csv_value(value).upper()
    return re.sub(r'\s+', '', cleaned)


def admin_code_is_valid():
    expected = os.getenv('ADMIN_CODE', '').strip()
    provided = request.headers.get('X-Admin-Code', '').strip()
    return bool(expected) and secrets.compare_digest(provided, expected)


def require_admin_code():
    if not admin_code_is_valid():
        response = jsonify(ok=False, error='admin_forbidden')
        response.status_code = 403
        return response
    return None


def generate_family_code(conn):
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for _ in range(40):
        code = 'FAM-' + ''.join(secrets.choice(alphabet) for _ in range(6))
        existing = conn.execute('SELECT id FROM family_login_codes WHERE family_code = ?', (code,)).fetchone()
        if not existing:
            return code
    raise RuntimeError('family code could not be generated')


def get_account_by_id(account_id):
    conn = get_db_connection()
    try:
        return conn.execute(
            'SELECT id, email, phone, provider, display_name, created_at, updated_at FROM accounts WHERE id = ?',
            (account_id,),
        ).fetchone()
    finally:
        conn.close()


def create_session_response(account):
    session = create_auth_session(account['id'])
    children = get_children_list(account['id'])
    response = jsonify(ok=True, account=auth_account_payload(account), children=children)
    response.set_cookie(
        AUTH_SESSION_COOKIE_NAME,
        session['session_token'],
        max_age=AUTH_SESSION_DAYS * 24 * 60 * 60,
        **get_auth_cookie_options(),
    )
    return response


def create_auth_session(account_id):
    if account_id is None:
        raise ValueError('account_id is required')
    init_db()
    token = secrets.token_urlsafe(32)
    now = get_now_iso()
    expires_at = (datetime.datetime.now() + datetime.timedelta(days=AUTH_SESSION_DAYS)).isoformat(timespec='seconds')
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id FROM accounts WHERE id = ?', (account_id,)).fetchone()
        if not row:
            raise LookupError('account not found')
        conn.execute(
            '''
            INSERT INTO auth_sessions (account_id, session_token, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            ''',
            (account_id, token, expires_at, now),
        )
        conn.commit()
    finally:
        conn.close()
    return {'session_token': token, 'expires_at': expires_at}


def get_current_account_id():
    init_db()
    session_token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)
    if not session_token:
        return None
    now = get_now_iso()
    conn = get_db_connection()
    try:
        row = conn.execute(
            '''
            SELECT account_id, expires_at
            FROM auth_sessions
            WHERE session_token = ?
            ''',
            (session_token,),
        ).fetchone()
        if not row:
            return None
        if row['expires_at'] <= now:
            conn.execute('DELETE FROM auth_sessions WHERE session_token = ?', (session_token,))
            conn.commit()
            return None
        return row['account_id']
    finally:
        conn.close()


def require_current_account():
    account_id = get_current_account_id()
    if not account_id:
        abort(401, 'login required')
    conn = get_db_connection()
    try:
        row = conn.execute(
            'SELECT id, email, phone, provider, display_name, created_at, updated_at FROM accounts WHERE id = ?',
            (account_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        abort(401, 'login required')
    return row


def upsert_child_word_status(child_id, vocab_id, status, parent_marked=False):
    status = normalize_word_status(status)
    now = get_now_iso()
    mastered = 1 if status == 'mastered' else 0
    mastery = 100 if status == 'mastered' else 0
    mastered_at = now if status == 'mastered' else None
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        ensure_vocab_entry_exists(str(vocab_id))
        conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
        conn.execute(
            '''
            INSERT INTO child_vocab_progress (
                child_id, vocab_id, correct_count, wrong_count, review_count,
                memory_level, last_studied_at, mastered, created_at, updated_at,
                correct_streak, mastery, status, mastered_at, last_reviewed_at,
                is_parent_marked_mastered
            ) VALUES (?, ?, 0, 0, 0, 0, NULL, ?, ?, ?, 0, ?, ?, ?, NULL, ?)
            ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                status = excluded.status,
                mastered = excluded.mastered,
                mastery = CASE
                    WHEN excluded.mastered = 1 AND child_vocab_progress.mastery < excluded.mastery THEN excluded.mastery
                    ELSE child_vocab_progress.mastery
                END,
                mastered_at = CASE WHEN excluded.mastered = 1 THEN COALESCE(child_vocab_progress.mastered_at, excluded.mastered_at) ELSE NULL END,
                is_parent_marked_mastered = CASE WHEN excluded.status = 'mastered' AND ? = 1 THEN 1 WHEN excluded.status <> 'mastered' THEN 0 ELSE child_vocab_progress.is_parent_marked_mastered END,
                updated_at = excluded.updated_at
            ''',
            (
                child_id,
                vocab_id,
                mastered,
                now,
                now,
                mastery,
                status,
                mastered_at,
                1 if parent_marked and status == 'mastered' else 0,
                1 if parent_marked and status == 'mastered' else 0,
            ),
        )
        conn.commit()
    finally:
        conn.close()


@app.route('/api/children/<int:child_id>/word-status')
def api_child_word_status(child_id):
    level = request.args.get('level', '').strip()
    search = request.args.get('search', '').strip()
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        child_row = conn.execute('SELECT study_mode FROM children WHERE id = ?', (child_id,)).fetchone()
    finally:
        conn.close()
    levels = sorted({get_entry_eiken_level(entry) for entry in vocab_list if get_entry_eiken_level(entry)})
    return jsonify(
        child_id=child_id,
        study_mode=normalize_study_mode(child_row['study_mode'] if child_row else 'normal'),
        levels=levels,
        words=build_word_status_payload(child_id, level=level, search=search),
    )


@app.route('/api/children/<int:child_id>/words/<int:vocab_id>/status', methods=['POST'])
def api_update_child_word_status(child_id, vocab_id):
    data = request.get_json(silent=True) or {}
    status = normalize_word_status(data.get('status'))
    upsert_child_word_status(child_id, vocab_id, status, parent_marked=bool(data.get('is_parent_marked_mastered') or status == 'mastered'))
    words = build_word_status_payload(child_id)
    updated = next((word for word in words if str(word['id']) == str(vocab_id)), None)
    return jsonify(word=updated)


@app.route('/api/children/<int:child_id>/words/bulk-status', methods=['POST'])
def api_bulk_update_child_word_status(child_id):
    data = request.get_json(silent=True) or {}
    status = normalize_word_status(data.get('status'))
    raw_ids = data.get('word_ids') or data.get('wordIds') or []
    if not isinstance(raw_ids, list) or not raw_ids:
        abort(400, 'word_ids is required')
    vocab_ids = []
    for raw_id in raw_ids:
        try:
            vocab_ids.append(int(raw_id))
        except (TypeError, ValueError):
            abort(400, 'word_ids must be integers')
    for vocab_id in vocab_ids:
        upsert_child_word_status(child_id, vocab_id, status, parent_marked=(status == 'mastered'))
    return jsonify(updated_count=len(vocab_ids), status=status)


@app.route('/api/children/<int:child_id>/study-mode', methods=['POST'])
def api_update_child_study_mode(child_id):
    data = request.get_json(silent=True) or {}
    study_mode = normalize_study_mode(data.get('study_mode'))
    conn = get_db_connection()
    try:
        ensure_child_exists(conn, child_id)
        conn.execute(
            'UPDATE children SET study_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (study_mode, child_id),
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify(child_id=child_id, study_mode=study_mode)


@app.route('/api/children/<int:child_id>/world-stage-progress', methods=['GET', 'POST'])
def api_child_world_stage_progress(child_id):
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        world_id = data.get('world') or data.get('world_id') or request.args.get('world')
        stage = data.get('stage') or data.get('stage_number') or request.args.get('stage')
        status = normalize_stage_status(data.get('status') or 'cleared')
    else:
        world_id = request.args.get('world') or request.args.get('world_id')
        stage = request.args.get('stage') or request.args.get('stage_number')
        status = 'in_progress'

    try:
        if request.method == 'POST' and status == 'cleared':
            payload = mark_child_world_stage_cleared(child_id, world_id, stage)
        else:
            payload = get_child_world_stage_progress(child_id, world_id, stage)
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))

    return jsonify(payload)


@app.route('/api/children/<int:child_id>/eigo-quest-progress')
def api_child_eigo_quest_progress(child_id):
    try:
        return jsonify(get_child_eigo_quest_progress(child_id))
    except LookupError as exc:
        abort(404, str(exc))
 

@app.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    init_db()
    data = request.get_json(silent=True) or {}
    raw_code = data.get('code') or data.get('familyCode') or data.get('identifier')
    family_code = normalize_family_code(raw_code)
    if family_code:
        conn = get_db_connection()
        try:
            code_row = conn.execute(
                '''
                SELECT account_id
                FROM family_login_codes
                WHERE family_code = ? AND is_active = 1
                ''',
                (family_code,),
            ).fetchone()
        finally:
            conn.close()
        if not code_row:
            response = jsonify(
                ok=False,
                error='invalid_family_code',
                message='ファミリーコードが正しくありません',
            )
            response.status_code = 401
            return response
        account = get_account_by_id(code_row['account_id'])
        if not account:
            response = jsonify(ok=False, error='invalid_family_code', message='ファミリーコードが正しくありません')
            response.status_code = 401
            return response
        return create_session_response(account)

    email = _clean_csv_value(data.get('email')).lower()
    if not email or '@' not in email:
        abort(400, 'valid email is required')
    display_name = _clean_csv_value(data.get('display_name') or data.get('displayName')) or email.split('@', 1)[0]
    now = get_now_iso()

    conn = get_db_connection()
    try:
        account = conn.execute(
            'SELECT id, email, phone, provider, display_name, created_at, updated_at FROM accounts WHERE email = ?',
            (email,),
        ).fetchone()
        if not account:
            conn.execute(
                '''
                INSERT INTO accounts (email, phone, provider, display_name, created_at, updated_at)
                VALUES (?, NULL, 'email', ?, ?, ?)
                ''',
                (email, display_name, now, now),
            )
            conn.commit()
            account = conn.execute(
                'SELECT id, email, phone, provider, display_name, created_at, updated_at FROM accounts WHERE email = ?',
                (email,),
            ).fetchone()
    finally:
        conn.close()

    return create_session_response(account)


@app.route('/api/auth/me')
def api_auth_me():
    account = require_current_account()
    return jsonify(account=auth_account_payload(account))


@app.route('/api/debug/routes')
def api_debug_routes():
    routes = []
    for rule in sorted(app.url_map.iter_rules(), key=lambda item: item.rule):
        routes.append({
            'rule': rule.rule,
            'endpoint': rule.endpoint,
            'methods': sorted(method for method in rule.methods if method not in {'HEAD', 'OPTIONS'}),
        })
    return jsonify(routes=routes)


@app.route('/api/admin/families')
def api_admin_families():
    forbidden = require_admin_code()
    if forbidden is not None:
        return forbidden
    init_db()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT
                flc.id AS code_id,
                flc.account_id,
                flc.family_code,
                flc.label,
                flc.is_active,
                flc.created_at,
                flc.updated_at,
                a.display_name
            FROM family_login_codes flc
            JOIN accounts a ON a.id = flc.account_id
            ORDER BY flc.id DESC
            '''
        ).fetchall()
    finally:
        conn.close()

    families = []
    for row in rows:
        children = get_children_list(row['account_id'])
        families.append({
            'accountId': row['account_id'],
            'familyName': row['label'] or row['display_name'] or f"Family {row['account_id']}",
            'familyCode': row['family_code'],
            'codeId': row['code_id'],
            'isActive': bool(row['is_active']),
            'children': children,
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })
    return jsonify(ok=True, families=families)


@app.route('/api/admin/families', methods=['POST'])
def api_admin_create_family():
    forbidden = require_admin_code()
    if forbidden is not None:
        return forbidden
    init_db()
    data = request.get_json(silent=True) or {}
    family_name = _clean_csv_value(data.get('familyName') or data.get('family_name') or data.get('label'))
    if not family_name:
        abort(400, 'familyName is required')
    children_payload = data.get('children') if isinstance(data.get('children'), list) else []
    now = get_now_iso()
    local_email = f"family_{uuid.uuid4().hex}@local.eigoquest"

    conn = get_db_connection()
    try:
        conn.execute(
            '''
            INSERT INTO accounts (email, phone, provider, display_name, created_at, updated_at)
            VALUES (?, NULL, 'family_code', ?, ?, ?)
            ''',
            (local_email, family_name, now, now),
        )
        conn.commit()
        account = conn.execute(
            'SELECT id, email, phone, provider, display_name, created_at, updated_at FROM accounts WHERE email = ?',
            (local_email,),
        ).fetchone()
        if not account:
            abort(500, 'account could not be created')
        family_code = generate_family_code(conn)
        conn.execute(
            '''
            INSERT INTO family_login_codes (account_id, family_code, label, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ''',
            (account['id'], family_code, family_name, now, now),
        )
        conn.commit()
        code_row = conn.execute(
            'SELECT id FROM family_login_codes WHERE family_code = ?',
            (family_code,),
        ).fetchone()
    finally:
        conn.close()

    created_children = []
    for child_data in children_payload:
        if not isinstance(child_data, dict):
            continue
        child_name = _clean_csv_value(child_data.get('name') or child_data.get('nickname'))
        if not child_name:
            continue
        created_children.append(upsert_child_profile({
            'nickname': child_name,
            'grade': _clean_csv_value(child_data.get('grade')) or '1',
            'target_level': _clean_csv_value(child_data.get('target_level') or child_data.get('targetLevel')) or '三\u7d1a',
            'learning_goal': _clean_csv_value(child_data.get('learning_goal') or child_data.get('learningGoal') or child_data.get('target_level') or child_data.get('targetLevel')) or '三\u7d1a',
            'daily_word_target': child_data.get('daily_word_target') or child_data.get('dailyWordTarget') or 20,
        }, account['id']))

    family = {
        'accountId': account['id'],
        'familyName': family_name,
        'familyCode': family_code,
        'codeId': code_row['id'] if code_row else None,
        'isActive': True,
        'children': created_children,
    }
    return jsonify(ok=True, family=family)


@app.route('/api/admin/family-codes/<int:code_id>/disable', methods=['POST'])
def api_admin_disable_family_code(code_id):
    forbidden = require_admin_code()
    if forbidden is not None:
        return forbidden
    init_db()
    conn = get_db_connection()
    try:
        conn.execute(
            '''
            UPDATE family_login_codes
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''',
            (code_id,),
        )
        conn.commit()
    finally:
        conn.close()
    return jsonify(ok=True, codeId=code_id, isActive=False)


@app.route('/api/auth/logout', methods=['POST'])
def api_auth_logout():
    session_token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)
    if session_token:
        conn = get_db_connection()
        try:
            conn.execute('DELETE FROM auth_sessions WHERE session_token = ?', (session_token,))
            conn.commit()
        finally:
            conn.close()
    response = jsonify(ok=True)
    response.delete_cookie(
        AUTH_SESSION_COOKIE_NAME,
        path='/',
        secure=get_auth_cookie_secure(),
        samesite=get_auth_cookie_samesite(),
    )
    return response


@app.route('/api/mark-mastered', methods=['POST'])
def api_mark_mastered():
    data = request.get_json(silent=True) or {}
    word = data.get('word', '').strip()
    if not word:
        abort(400, 'word is required')
    child_id = data.get('child_id')
    vocab_id = data.get('vocab_id')
    if child_id not in [None, '', 'null'] and vocab_id not in [None, '', 'null']:
        try:
            child_id = int(child_id)
            vocab_id = int(vocab_id)
        except (TypeError, ValueError):
            abort(400, 'child_id and vocab_id must be integers')
        ensure_vocab_entry_exists(str(vocab_id))

        now = get_now_iso()
        today = get_today()
        conn = get_db_connection()
        try:
            ensure_child_exists(conn, child_id)
            conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
            existing_progress = conn.execute(
                'SELECT mastery, mastered, status FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_id),
            ).fetchone()
            current_mastery = int(existing_progress['mastery'] or 0) if existing_progress else 0
            is_already_mastered = bool(existing_progress and existing_progress['mastered'])
            next_mastery = 100 if is_already_mastered else min(99, max(current_mastery, 1))
            conn.execute(
                '''
                INSERT INTO child_vocab_progress (
                    child_id, vocab_id, correct_count, wrong_count, review_count,
                    memory_level, last_studied_at, mastered, created_at, updated_at,
                    correct_streak, mastery, status, mastered_at, last_reviewed_at
                ) VALUES (?, ?, 1, 0, 1, 0, ?, 0, ?, ?, 1, ?, 'learning', NULL, ?)
                ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                    correct_count = child_vocab_progress.correct_count + 1,
                    review_count = child_vocab_progress.review_count + 1,
                    last_studied_at = excluded.last_studied_at,
                    last_reviewed_at = excluded.last_reviewed_at,
                    mastered = child_vocab_progress.mastered,
                    status = CASE
                        WHEN child_vocab_progress.mastered = 1 THEN 'mastered'
                        WHEN child_vocab_progress.status = 'review' THEN 'learning'
                        ELSE child_vocab_progress.status
                    END,
                    mastered_at = child_vocab_progress.mastered_at,
                    mastery = excluded.mastery,
                    correct_streak = child_vocab_progress.correct_streak + 1,
                    updated_at = excluded.updated_at
                ''',
                (child_id, vocab_id, now, now, now, next_mastery, now),
            )
            conn.execute(
                '''
                INSERT INTO daily_study_log (
                    child_id, study_date, studied_count, correct_count, wrong_count,
                    study_minutes, created_at, updated_at
                ) VALUES (?, ?, 1, 1, 0, 0, ?, ?)
                ON CONFLICT(child_id, study_date) DO UPDATE SET
                    studied_count = daily_study_log.studied_count + 1,
                    correct_count = daily_study_log.correct_count + 1,
                    updated_at = excluded.updated_at
                ''',
                (child_id, today, now, now),
            )
            conn.commit()
        finally:
            conn.close()

    progress = mark_word_mastered(word) if child_id in [None, '', 'null'] else {'count': 0, 'mastered_words': []}
    settings = load_settings()
    target = settings.get('daily_target', 20)
    if child_id not in [None, '', 'null']:
        conn = get_db_connection()
        try:
            child_row = conn.execute(
                'SELECT daily_target FROM children WHERE id = ?',
                (child_id,),
            ).fetchone()
            if child_row and child_row['daily_target']:
                target = int(child_row['daily_target'])
            mastered_count = conn.execute(
                '''
                SELECT COUNT(*) AS count
                FROM child_vocab_progress
                WHERE child_id = ? AND mastered = 1
                ''',
                (child_id,),
            ).fetchone()
            studied_row = conn.execute(
                'SELECT studied_count FROM daily_study_log WHERE child_id = ? AND study_date = ?',
                (child_id, get_today()),
            ).fetchone()
            progress['count'] = int(studied_row['studied_count'] or 0) if studied_row else 0
            progress['mastered_total'] = int(mastered_count['count'] or 0) if mastered_count else 0
        finally:
            conn.close()
    remain = max(0, target - progress['count'])
    return jsonify(
        progress=progress['count'],
        studied_today=progress['count'],
        target=target,
        remain=remain,
        mastered_total=progress.get('mastered_total', len(progress.get('mastered_words', []))),
        mastered_words=progress.get('mastered_total', progress.get('mastered_words', [])),
    )


@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        daily_target = data.get('daily_target', 20)
        try:
            daily_target = int(daily_target)
        except (TypeError, ValueError):
            abort(400, 'daily_target must be an integer')
        if daily_target < 1:
            abort(400, 'daily_target must be at least 1')
        settings = {'daily_target': daily_target}
        save_settings(settings)
        return jsonify(settings)
    return jsonify(load_settings())


@app.route('/api/quiz')
def api_quiz():
    requested_word = request.args.get('word', '').strip()
    importance = request.args.get('importance', '').strip()
    frequency = request.args.get('frequency', '').strip()
    child_id = request.args.get('child_id') or request.args.get('childId')
    if child_id in [None, '', 'null']:
        abort(400, 'child_id is required')
    try:
        child_id = int(child_id)
    except (TypeError, ValueError):
        abort(400, 'child_id must be an integer')
    entries = filter_vocab_entries(vocab_list, importance=importance, frequency=frequency)
    if not entries:
        entries = vocab_list

    mastered_entries = get_child_mastered_vocab_entries(child_id, entries)
    mastered_words = [entry.get('English', '').strip() for entry in mastered_entries if entry.get('English', '').strip()]
    quiz_candidates = [
        entry for entry in mastered_entries
        if build_example_cloze_question(_clean_csv_value(entry.get('Example_English')), entry.get('English'))
    ]

    if not requested_word and not mastered_entries:
        return jsonify(
            question='まだ復習できる単語がありません。まず単語カードで覚えましょう。',
            choices=[],
            correct='',
            word='',
            id='',
            mastered_count=len(mastered_words),
            error_count=0,
            review_mode='mastered_words',
        )
    if len(mastered_entries) < 4:
        return jsonify(
            question='4択クイズには、覚えた単語が4つ以上必要です。まず単語カードで覚えましょう。',
            choices=[],
            correct='',
            word='',
            id='',
            mastered_count=len(mastered_words),
            error_count=0,
            review_mode='mastered_words',
        )
    if not requested_word and not quiz_candidates:
        return jsonify(
            question='例文つきで復習できる単語がまだありません。まず単語カードで覚えましょう。',
            choices=[],
            correct='',
            word='',
            id='',
            mastered_count=len(mastered_words),
            error_count=0,
            review_mode='mastered_words',
        )

    conn = get_db_connection()
    try:
        rows = conn.execute(
            '''
            SELECT vocab_id, wrong_count
            FROM child_vocab_progress
            WHERE child_id = ?
            ''',
            (child_id,),
        ).fetchall()
    finally:
        conn.close()
    error_counts = {}
    for row in rows:
        error_counts[str(row['vocab_id']).strip().lower()] = int(row['wrong_count'] or 0)

    def get_entry_error_count(entry):
        keys = [
            str(entry.get('ID', '')).strip().lower(),
            str(entry.get('English', '')).strip().lower(),
        ]
        return max([error_counts.get(key, 0) for key in keys] or [0])

    if requested_word:
        correct_vocab = resolve_vocab_entry(requested_word, entries) or resolve_vocab_entry(requested_word, vocab_list)
        if not correct_vocab or get_vocab_key(correct_vocab).lower() not in {
            get_vocab_key(entry).lower() for entry in mastered_entries if get_vocab_key(entry)
        }:
            return jsonify(
                question='まだ復習できる単語がありません。まず単語カードで覚えましょう。',
                choices=[],
                correct='',
                word='',
                id='',
                mastered_count=len(mastered_words),
                error_count=0,
                review_mode='mastered_words',
            )
    else:
        weighted_candidates = []
        for entry in quiz_candidates:
            weight = 1 + min(8, get_entry_error_count(entry) * 2)
            weighted_candidates.extend([entry] * weight)
        correct_vocab = random.choice(weighted_candidates) if weighted_candidates else random.choice(quiz_candidates)

    if correct_vocab is None:
        abort(404, 'Word not found')

    correct_answer = correct_vocab['English']
    example_sentence = _clean_csv_value(correct_vocab.get('Example_English'))
    question = build_example_cloze_question(example_sentence, correct_answer)
    if not question:
        question = f'Choose the word that fits: ____'
    distractor_pool = mastered_entries
    other_vocabs = [v for v in distractor_pool if v['English'] != correct_answer]
    if len(other_vocabs) < 3:
        return jsonify(
            question='4択クイズには、覚えた単語が4つ以上必要です。まず単語カードで覚えましょう。',
            choices=[],
            correct='',
            word='',
            id='',
            mastered_count=len(mastered_words),
            error_count=0,
            review_mode='mastered_words',
        )
    wrong_choices = random.sample(other_vocabs, 3)
    choices = [correct_answer] + [v['English'] for v in wrong_choices]
    random.shuffle(choices)
    sentence_jp = get_context_sentence(correct_answer)
    return jsonify(
        question=question,
        choices=choices,
        correct=correct_answer,
        word=correct_answer,
        id=correct_vocab.get('ID', ''),
        japanese=correct_vocab.get('Japanese', ''),
        example=correct_vocab.get('Example_English', ''),
        example_jp=sentence_jp or correct_vocab.get('Example_Japanese', ''),
        mastered_count=len(mastered_words),
        error_count=get_entry_error_count(correct_vocab),
        review_mode='mastered_words',
        question_type='example_cloze',
    )


@app.route('/api/vocab-expansion')
def api_vocab_expansion():
    child_id = request.args.get('child_id') or request.args.get('childId')
    if child_id in [None, '', 'null']:
        abort(400, 'child_id is required')
    try:
        child_id = int(child_id)
    except (TypeError, ValueError):
        abort(400, 'child_id must be an integer')
    try:
        question = build_vocab_expansion_question(request.args.get('mode'), child_id)
    except LookupError as exc:
        abort(404, str(exc))
    return jsonify(question)


@app.route('/api/vocab-expansion/answer', methods=['POST'])
def api_vocab_expansion_answer():
    data = request.get_json(silent=True) or {}
    vocab_id = _clean_csv_value(data.get('id') or data.get('vocab_id'))
    selected = _clean_csv_value(data.get('selected'))
    correct = _clean_csv_value(data.get('correct'))
    child_id = data.get('child_id')
    if not selected or not correct:
        abort(400, 'selected and correct are required')

    is_correct = selected.lower() == correct.lower()
    study_result = None
    if vocab_id.isdigit() and child_id not in [None, '', 'null']:
        try:
            study_result = recordStudyResult(int(child_id), int(vocab_id), is_correct)
        except ValueError:
            study_result = None
    if not is_correct and vocab_id:
        log_error(vocab_id)

    return jsonify(
        correct=is_correct,
        correct_answer=correct,
        selected=selected,
        pet_exp_awarded=study_result['pet_exp_awarded'] if study_result else 0,
        pet=study_result['pet'] if study_result else None,
    )


@app.route('/api/today-review-quiz')
def api_today_review_quiz():
    child_id = parse_optional_child_id_arg()
    world_id = request.args.get('world', '').strip()
    stage = request.args.get('stage', '').strip()
    attempt_id = request.args.get('attempt_id') or request.args.get('attemptId')
    try:
        return jsonify(api_today_review_quiz_payload(child_id=child_id, world_id=world_id, stage=stage, attempt_id=attempt_id))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))


@app.route('/api/children/<int:child_id>/stage-quiz-attempts', methods=['POST'])
def api_child_stage_quiz_attempts(child_id):
    data = request.get_json(silent=True) or {}
    world_id = data.get('world') or data.get('world_id')
    stage = data.get('stage') or data.get('stage_number')
    answers = data.get('answers')
    attempt_id = data.get('attempt_id') or data.get('attemptId')
    try:
        result = submit_child_stage_quiz_attempt(child_id, world_id, stage, answers, attempt_id)
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result), 201


@app.route('/api/children/<int:child_id>/vocab-wrong-reviews', methods=['GET', 'POST'])
def api_child_vocab_wrong_reviews(child_id):
    if request.method == 'GET':
        try:
            wrong_reviews = get_child_vocab_wrong_reviews(child_id)
        except LookupError as exc:
            abort(404, str(exc))
        return jsonify(
            child_id=child_id,
            childId=child_id,
            count=len(wrong_reviews),
            wrong_reviews=wrong_reviews,
            wrongReviews=wrong_reviews,
        )

    data = request.get_json(silent=True) or {}
    vocab_id = data.get('vocab_id') or data.get('vocabId')
    if vocab_id in [None, '', 'null']:
        abort(400, 'vocab_id is required')
    try:
        item = record_child_vocab_wrong_review(
            child_id,
            int(vocab_id),
            data.get('world_id') or data.get('worldId'),
            data.get('stage_number') or data.get('stageNumber'),
            data.get('question_type') or data.get('questionType'),
        )
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(item), 201


@app.route('/api/children/<int:child_id>/vocab-wrong-reviews/<int:vocab_id>/question')
def api_child_vocab_wrong_review_question(child_id, vocab_id):
    try:
        question = build_child_vocab_wrong_review_question(child_id, vocab_id)
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(question)


@app.route('/api/ai-practice/next')
def api_ai_practice_next():
    raw_child_id = request.args.get('child_id', '').strip()
    child_id = None
    if raw_child_id:
        try:
            child_id = int(raw_child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
    else:
        child_id = get_default_child_id()
    if child_id is None:
        abort(400, 'child profile is required')
    try:
        question = get_ai_practice_question(child_id)
    except Exception as exc:
        app.logger.exception('AI practice question generation failed')
        abort(500, str(exc))
    return jsonify(question=question)


@app.route('/api/ai-practice/answer', methods=['POST'])
def api_ai_practice_answer():
    data = request.get_json(silent=True) or {}
    raw_child_id = data.get('child_id')
    raw_question_id = data.get('question_id')
    selected_answer = (data.get('selected_answer') or data.get('selected') or '').strip()
    if raw_child_id in [None, '', 'null']:
        raw_child_id = get_default_child_id()
    try:
        child_id = int(raw_child_id)
        question_id = int(raw_question_id)
    except (TypeError, ValueError):
        abort(400, 'child_id and question_id must be integers')
    if not selected_answer:
        abort(400, 'selected_answer is required')
    try:
        result = submit_ai_practice_answer(child_id, question_id, selected_answer)
    except ValueError as exc:
        abort(404, str(exc))
    return jsonify(result)


@app.route('/api/battle/start', methods=['POST'])
def api_battle_start():
    data = request.get_json(silent=True) or {}
    try:
        result = start_battle_session(
            child_id=data.get('child_id') or data.get('childId'),
            level=data.get('level'),
        )
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result), 201


@app.route('/api/battle/<session_id>/answer', methods=['POST'])
def api_battle_answer(session_id):
    data = request.get_json(silent=True) or {}
    try:
        result = submit_battle_answer(
            session_id,
            data.get('question_id') or data.get('questionId'),
            data.get('selected_answer') or data.get('selectedAnswer'),
        )
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/battle/<session_id>/capture', methods=['POST'])
def api_battle_capture(session_id):
    try:
        result = capture_battle_monster(session_id)
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/battle/monsters')
def api_battle_monsters():
    try:
        result = get_battle_monster_collection(request.args.get('child_id') or request.args.get('childId'))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/battle/wrong-questions')
def api_battle_wrong_questions():
    try:
        result = get_battle_wrong_questions(request.args.get('child_id') or request.args.get('childId'))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/battle/wrong-questions/<int:wrong_id>/master', methods=['POST'])
def api_battle_wrong_question_master(wrong_id):
    try:
        result = master_battle_wrong_question(wrong_id)
    except LookupError as exc:
        abort(404, str(exc))
    return jsonify(result)


@app.route('/api/grammar-lessons')
@app.route('/api/grammar/lessons')
def api_grammar_lessons():
    child_id = request.args.get('child_id') or request.args.get('childId')
    try:
        result = get_grammar_lessons_for_child(child_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/lessons/<lesson_id>')
def api_grammar_lesson_detail(lesson_id):
    child_id = request.args.get('child_id') or request.args.get('childId')
    try:
        result = get_grammar_lesson_detail(child_id, lesson_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/lessons/<lesson_id>/view', methods=['POST'])
def api_grammar_lesson_view(lesson_id):
    data = request.get_json(silent=True) or {}
    try:
        result = mark_grammar_lesson_viewed(data.get('child_id') or data.get('childId'), lesson_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/quizzes/<quiz_id>/answer', methods=['POST'])
def api_grammar_quiz_answer(quiz_id):
    data = request.get_json(silent=True) or {}
    try:
        result = submit_grammar_quiz_answer(
            data.get('child_id') or data.get('childId'),
            quiz_id,
            data.get('selected_index') if 'selected_index' in data else data.get('selectedIndex'),
        )
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/quiz-wrong-questions')
def api_grammar_quiz_wrong_questions():
    child_id = request.args.get('child_id') or request.args.get('childId')
    try:
        result = get_grammar_quiz_wrong_questions(child_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/form-practice')
def api_grammar_form_practice():
    child_id = request.args.get('child_id') or request.args.get('childId')
    lesson_id = request.args.get('lesson_id') or request.args.get('lessonId')
    try:
        result = get_grammar_form_practice(child_id, request.args.get('limit') or 5, lesson_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/form-practice/<test_id>/answer', methods=['POST'])
def api_grammar_form_practice_answer(test_id):
    data = request.get_json(silent=True) or {}
    try:
        result = submit_grammar_form_practice_answer(
            data.get('child_id') or data.get('childId'),
            test_id,
            data.get('selected_index') if 'selected_index' in data else data.get('selectedIndex'),
        )
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/form-practice/wrong-questions')
def api_grammar_form_wrong_questions():
    child_id = request.args.get('child_id') or request.args.get('childId')
    try:
        result = get_grammar_form_wrong_questions(child_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except FileNotFoundError as exc:
        abort(500, str(exc))
    return jsonify(result)


@app.route('/api/grammar/form-practice/wrong-questions/<test_id>/master', methods=['POST'])
def api_grammar_form_wrong_question_master(test_id):
    data = request.get_json(silent=True) or {}
    child_id = data.get('child_id') or data.get('childId') or request.args.get('child_id') or request.args.get('childId')
    try:
        result = master_grammar_form_wrong_question(child_id, test_id)
    except ValueError as exc:
        abort(400, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    return jsonify(result)


@app.route('/api/eiken-pre2/sets')
def api_eiken_pre2_sets():
    try:
        return jsonify(sets=list_eiken_pre2_sets())
    except FileNotFoundError as exc:
        abort(500, str(exc))


@app.route('/api/eiken-pre2/sets/<set_id>')
@app.route('/api/eiken-pre2/sets/<set_id>/questions')
def api_eiken_pre2_set(set_id):
    try:
        question_set = get_eiken_pre2_set(set_id, include_correct=False)
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    if not question_set:
        abort(404, 'set_id not found')
    return jsonify(question_set)


@app.route('/api/eiken-pre2/attempts', methods=['POST'])
def api_eiken_pre2_submit_attempt():
    data = request.get_json(silent=True) or {}
    child_id = data.get('student_id', data.get('child_id'))
    set_id = data.get('set_id')
    answers = data.get('answers')
    try:
        result = submit_eiken_pre2_attempt(
            child_id=child_id,
            set_id=set_id,
            raw_answers=answers,
            started_at=data.get('started_at'),
            attempt_id=data.get('attempt_id'),
            question_ids=data.get('question_ids'),
        )
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except RuntimeError as exc:
        if str(exc) == 'duplicate attempt_id':
            abort(409, str(exc))
        abort(500, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result), 201


@app.route('/api/eiken-pre2/attempts/start', methods=['POST'])
def api_eiken_pre2_start_attempt():
    data = request.get_json(silent=True) or {}
    try:
        if data.get('source_attempt_id'):
            result = start_eiken_pre2_review_attempt(
                data.get('source_attempt_id'),
                student_id=data.get('student_id') or data.get('child_id'),
            )
        else:
            result = start_eiken_pre2_attempt(
                data.get('student_id') or data.get('child_id'),
                data.get('set_id'),
                mode=data.get('mode') or 'ai_training',
                question_ids=data.get('question_ids'),
            )
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result), 201


@app.route('/api/eiken-pre2/attempts/<attempt_id>/answer', methods=['POST'])
def api_eiken_pre2_submit_single_answer(attempt_id):
    data = request.get_json(silent=True) or {}
    try:
        result = submit_eiken_pre2_single_answer(
            attempt_id,
            data.get('question_id'),
            student_answer=data.get('student_answer'),
            time_spent_seconds=data.get('time_spent_seconds'),
            timed_out=bool(data.get('timed_out')),
        )
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/eiken-pre2/attempts/<attempt_id>/complete', methods=['POST'])
def api_eiken_pre2_complete_attempt(attempt_id):
    try:
        result = complete_eiken_pre2_attempt(attempt_id)
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/eiken-pre2/attempts/<attempt_id>')
@app.route('/api/eiken-pre2/attempts/<attempt_id>/result')
def api_eiken_pre2_attempt_result(attempt_id):
    try:
        result = get_eiken_pre2_attempt_result(attempt_id)
    except FileNotFoundError as exc:
        abort(500, str(exc))
    if not result:
        abort(404, 'attempt_id not found')
    return jsonify(result)


@app.route('/api/eiken-pre2/wrong-questions')
def api_eiken_pre2_wrong_questions():
    child_id = request.args.get('student_id') or request.args.get('child_id')
    latest_only = request.args.get('latest_only', '').strip().lower() in ['1', 'true', 'yes']
    question_type = request.args.get('question_type', '').strip() or None
    weak_point_tag = request.args.get('weak_point_tag', '').strip() or None
    limit = request.args.get('limit', '').strip() or None
    if child_id in [None, '', 'null']:
        abort(400, 'student_id is required')
    try:
        result = get_eiken_pre2_wrong_questions(
            child_id,
            latest_only=latest_only,
            question_type=question_type,
            weak_point_tag=weak_point_tag,
            limit=limit,
        )
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/eiken-pre2/students/<student_id>/wrong-answers')
def api_eiken_pre2_student_wrong_answers(student_id):
    latest_only = request.args.get('latest_only', '1').strip().lower() in ['1', 'true', 'yes']
    question_type = request.args.get('question_type', '').strip() or None
    weak_point_tag = request.args.get('weak_point_tag', '').strip() or None
    limit = request.args.get('limit', '').strip() or None
    try:
        result = get_eiken_pre2_wrong_questions(
            student_id,
            latest_only=latest_only,
            question_type=question_type,
            weak_point_tag=weak_point_tag,
            limit=limit,
        )
    except FileNotFoundError as exc:
        abort(500, str(exc))
    except LookupError as exc:
        abort(404, str(exc))
    except ValueError as exc:
        abort(400, str(exc))
    return jsonify(result)


@app.route('/api/eiken')
def api_eiken():
    force_ai = request.args.get('force_ai', '').strip().lower() in ['1', 'true', 'yes']
    nonce = request.args.get('nonce', '').strip() or None
    importance = request.args.get('importance', '').strip()
    frequency = request.args.get('frequency', '').strip()
    try:
        questions, source, warning = generate_practice_questions(
            VOCAB_FILENAME,
            force_ai=force_ai,
            nonce=nonce,
            importance=importance,
            frequency=frequency,
        )
    except Exception as exc:
        app.logger.exception('Practice question generation failed; using in-memory fallback')
        try:
            questions = generate_rule_questions(vocab_list)
        except Exception:
            abort(500, str(exc))
        source = 'rule'
        warning = f'Question generation failed; using local fallback questions. {exc}'
    response = jsonify(questions=questions, source=source, warning=warning)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.route('/api/ai-status')
def api_ai_status():
    api_key = get_openai_api_key()
    return jsonify(
        openai_api_key_configured=bool(api_key),
        openai_api_key_length=len(api_key),
        openai_model=get_openai_model(),
        openai_reasoning_effort=get_openai_reasoning_effort(get_openai_model()),
        ai_questions_enabled=os.getenv('AI_QUESTIONS_ENABLED', '1').strip().lower() not in ['0', 'false', 'no'],
    )


@app.route('/api/practice-answer', methods=['POST'])
def api_practice_answer():
    data = request.get_json(silent=True) or {}
    word = (data.get('word') or '').strip()
    vocab_id = (data.get('id') or data.get('word_id') or '').strip()
    selected = (data.get('selected') or '').strip()
    correct_answer = (data.get('correct') or data.get('correct_answer') or '').strip()
    child_id = data.get('child_id')
    if not word or not selected:
        abort(400, 'word and selected are required')

    vocab = resolve_vocab_entry(vocab_id, vocab_list) if vocab_id else None
    if vocab is None:
        vocab = resolve_vocab_entry(word, vocab_list)

    expected_answer = correct_answer
    if not expected_answer and vocab is not None:
        expected_answer = vocab['English'].strip()
    if not expected_answer:
        abort(400, 'correct answer is required')

    is_correct = selected.strip().lower() == expected_answer.strip().lower()
    if not is_correct and vocab is not None:
        log_error(vocab.get('ID', '') or vocab['English'].strip())

    study_result = None
    if child_id not in [None, '', 'null']:
        try:
            child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
        if vocab is not None and str(vocab.get('ID', '')).strip():
            try:
                study_result = recordStudyResult(child_id, int(vocab['ID']), is_correct)
            except ValueError:
                study_result = None

    sentence_jp = get_context_sentence(vocab['English'] if vocab else word)
    if vocab is not None:
        explanation = f'"{vocab["English"]}" means "{vocab["Japanese"]}".'
        if sentence_jp:
            explanation += f' Japanese note: {sentence_jp}'
        elif vocab.get('Example_Japanese', '').strip():
            explanation += f' Example in Japanese: {vocab["Example_Japanese"].strip()}'
    else:
        explanation = 'This answer was checked against the question set.'

    return jsonify(
        correct=is_correct,
        correct_answer=expected_answer,
        id=vocab.get('ID', '') if vocab else vocab_id,
        japanese=vocab['Japanese'] if vocab else '',
        example_jp=sentence_jp or (vocab.get('Example_Japanese', '').strip() if vocab else ''),
        explanation=explanation,
        selected=selected,
        pet_exp_awarded=study_result['pet_exp_awarded'] if study_result else 0,
        pet=study_result['pet'] if study_result else None,
    )


@app.route('/api/error-review')
def api_error_review():
    child_id = parse_optional_child_id_arg()
    try:
        review_list = get_review_list(child_id)
    except LookupError as exc:
        abort(404, str(exc))
    except Exception as exc:
        abort(500, str(exc))
    return jsonify(review_list=review_list)


@app.route('/api/pokedex')
def api_pokedex():
    child_id = request.args.get('child_id', '').strip()
    if child_id:
        try:
            child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
    else:
        child_id = None
    return jsonify(get_child_pokedex_collection(child_id))


@app.route('/api/petroom')
def api_petroom():
    settings = load_settings()
    progress = load_progress()
    pet_state = get_pet_state(progress, settings)
    pets = [
        {
            'name': pet['name'],
            'emoji': pet['emoji'],
            'mood': pet_state['mood'],
            'unlocked': pet['unlocked'],
            'unlock_at': pet['unlock_at'],
        }
        for pet in get_pet_collection(progress, settings)
        if pet['unlocked']
    ]
    return jsonify(pets=pets)


@app.route('/api/petlevel')
def api_petlevel():
    pet = get_pet_state()
    return jsonify(pet=pet)


@app.route('/api/progress')
def api_progress():
    child_id = request.args.get('child_id', '').strip()
    selected_date = request.args.get('date', '').strip()
    if child_id:
        try:
            child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
    else:
        child_id = None
    return jsonify(get_child_progress_report(child_id, selected_date or None))


@app.route('/api/child-stats')
def api_child_stats():
    child_id = request.args.get('child_id', '').strip()
    if child_id:
        try:
            child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
    else:
        child_id = None
    return jsonify(get_child_learning_stats(child_id))


@app.route('/api/learned-words')
def api_learned_words():
    child_id = request.args.get('child_id', '').strip()
    if child_id:
        try:
            child_id = int(child_id)
        except (TypeError, ValueError):
            abort(400, 'child_id must be an integer')
    else:
        child_id = None
    return jsonify(get_child_learned_words(child_id))


@app.route('/api/children', methods=['GET', 'POST'])
def api_children():
    started_at = time.perf_counter()
    account = require_current_account()
    account_id = account['id']
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        try:
            child = upsert_child_profile(data, account_id)
        except LookupError as exc:
            abort(404, str(exc))
        except ValueError as exc:
            abort(400, str(exc))
        app.logger.info('/api/children POST completed in %sms', int((time.perf_counter() - started_at) * 1000))
        return jsonify(child=child)
    children = get_children_list(account_id)
    app.logger.info('/api/children GET completed in %sms count=%s', int((time.perf_counter() - started_at) * 1000), len(children))
    return jsonify(children=children)


@app.route('/api/children/<int:child_id>', methods=['DELETE'])
def api_delete_child(child_id):
    require_child_belongs_to_current_account(child_id)
    conn = get_db_connection()
    try:
        account_id = get_current_account_id()
        row = conn.execute('SELECT id FROM children WHERE id = ? AND account_id = ?', (child_id, account_id)).fetchone()
        if not row:
            abort(404, 'child not found')
        conn.execute('DELETE FROM children WHERE id = ? AND account_id = ?', (child_id, account_id))
        conn.commit()
    finally:
        conn.close()
    return jsonify(deleted=True, child_id=child_id)


@app.route('/api/child-starter-options')
def api_child_starter_options():
    return jsonify(options=get_child_starter_options())


@app.route('/flashcard')
def flashcard_redirect():
    return redirect('/app/flashcard')


@app.route('/quiz')
def quiz_redirect():
    return redirect('/app/quiz')


@app.route('/vocab-expansion')
def vocab_expansion_redirect():
    return redirect('/app/vocab-expansion')


@app.route('/ai-practice')
def ai_practice_redirect():
    return redirect('/app/ai-practice')


@app.route('/battle')
def battle_redirect():
    return redirect('/app/battle')


@app.route('/eiken-pre2')
def eiken_pre2_redirect():
    return redirect('/app/eiken-pre2')


@app.route('/eiken-real')
def eiken_real_redirect():
    return redirect('/app/eiken-real')


@app.route('/eiken-pre2/result/<path:attempt_id>')
def eiken_pre2_result_redirect(attempt_id):
    return redirect(f'/app/eiken-pre2/result/{attempt_id}')


@app.route('/eiken-pre2/wrong-review')
def eiken_pre2_wrong_review_redirect():
    query = request.query_string.decode('utf-8')
    suffix = f'?{query}' if query else ''
    return redirect(f'/app/eiken-pre2/wrong-review{suffix}')


@app.route('/hatch')
def hatch_redirect():
    return redirect('/app/hatch')


@app.route('/pokedex')
def pokedex_redirect():
    return redirect('/app/pokedex')


@app.route('/petroom')
def petroom_redirect():
    return redirect('/app/petroom')


@app.route('/petlevel')
def petlevel_redirect():
    return redirect('/app/petlevel')


@app.route('/progress')
def progress_redirect():
    return redirect('/app/progress')


@app.route('/parent/word-manager')
def parent_word_manager_redirect():
    return redirect('/app/parent/word-manager')


@app.route('/settings')
def settings_redirect():
    return redirect('/app/settings')


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)

