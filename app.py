from flask import Flask, abort, request, Response, jsonify, redirect, send_from_directory
import csv
import datetime
import json
import os
import random
import re
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
import uuid

from pokeapi_service import PokeApiError, getPokemonById

app = Flask(__name__)

DB_FILENAME = 'practice_data.db'
VOCAB_FILENAME = os.path.join('data', 'eiken_vocab_database_with_synonyms_utf8_bom.csv')
EIKEN_PRE2_BANK_FILENAME = os.path.join('data', 'eiken_pre2_web_ready_db', 'eiken_pre2_web_ready.sqlite')
OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
AI_QUESTION_TYPES = ['Vocabulary', 'Grammar', 'Conversation', 'Reading Cloze']
AI_AUTO_QUESTION_TYPES = ['multiple_choice', 'fill_blank', 'en_to_ja', 'ja_to_en', 'sentence', 'reading', 'writing']
STARTER_POKEMON_IDS = [4, 7, 1]
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


def build_vocab_expansion_question(mode=None):
    candidates = get_vocab_expansion_entries()
    if not candidates:
        raise LookupError('No vocabulary expansion data is available')

    requested_mode = _clean_csv_value(mode).lower()
    if requested_mode not in ['synonym', 'antonym']:
        requested_mode = random.choice(['synonym', 'antonym'])

    mode_key = 'Synonyms' if requested_mode == 'synonym' else 'Antonyms'
    available = [entry for entry in candidates if split_related_vocab_terms(entry.get(mode_key))]
    if not available:
        fallback_mode = 'antonym' if requested_mode == 'synonym' else 'synonym'
        mode_key = 'Synonyms' if fallback_mode == 'synonym' else 'Antonyms'
        available = [entry for entry in candidates if split_related_vocab_terms(entry.get(mode_key))]
        requested_mode = fallback_mode
    if not available:
        raise LookupError('No vocabulary expansion data is available')

    entry = random.choice(available)
    correct = random.choice(split_related_vocab_terms(entry.get(mode_key)))
    distractor_pool = []
    for other in candidates:
        if get_vocab_key(other) == get_vocab_key(entry):
            continue
        distractor_pool.extend(split_related_vocab_terms(other.get('Synonyms')))
        distractor_pool.extend(split_related_vocab_terms(other.get('Antonyms')))

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


def load_vocabulary(filename=VOCAB_FILENAME):
    vocab = []
    for row in _read_csv_with_fallback(filename):
        normalized = normalize_vocab_row(row)
        if normalized:
            vocab.append(normalized)
    return vocab


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
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
    try:
        row = conn.execute(
            'SELECT pokemon_id FROM pokemon_catalog WHERE pokemon_id BETWEEN 1 AND 151 ORDER BY RANDOM() LIMIT 1'
        ).fetchone()
        if row:
            return int(row['pokemon_id'])
        return random.randint(1, 151)
    finally:
        if close_conn:
            conn.close()


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
    try:
        normalized_id = int(pokemon_id)
    except (TypeError, ValueError):
        normalized_id = None
    if not normalized_id or normalized_id <= 0:
        return None, None
    return (
        f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{normalized_id}.png',
        f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{normalized_id}.png',
    )


def get_pokemon_fallback_name(pokemon_id):
    try:
        normalized_id = int(pokemon_id)
    except (TypeError, ValueError):
        normalized_id = None
    if not normalized_id or normalized_id <= 0:
        return None
    return POKEMON_NAME_FALLBACKS.get(normalized_id)


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
    pokemon = pokemon or None
    pokemon_error = pokemon_error or None
    pet_type = get_pokemon_primary_type(pokemon)
    pet_emoji = {'fire': '・滓ｨ奇ｽｫ・ｨ', 'water': '・滓ｨ雁ｦ', 'grass': '・滓ｫ・ｽｫ・ｺ', 'electric': '髫ｨ讖ｸ・ｽ・｡'}.get(pet_type, '髫ｨ・ｨ繝ｻ・ｨ')
    max_level = int(row['max_level'] or 10)
    level = int(row['level'] or 1)
    max_exp = get_pet_exp_required(level)
    if level >= max_level:
      max_exp = get_pet_exp_required(level)

    progress_percent = None
    if collection_count is not None:
        progress_percent = round((collection_count / 151) * 100, 1)

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
        state['collection_total'] = 151
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
        pokemon = getPokemonById(normalized_id)
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
    pokemon = None
    pokemon_error = None
    try:
        pokemon = get_cached_pokemon_by_id(pokemon_id)
    except PokeApiError as exc:
        pokemon_error = str(exc)
    collection_count = None
    conn = get_db_connection()
    try:
        collection_count = conn.execute(
            'SELECT COUNT(*) AS count FROM child_pokemon_collection WHERE child_id = ?',
            (child_id,),
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
        fallback_name = get_pokemon_fallback_name(pokemon_id)
        raw_name = _row_value(row, 'catalog_name') or _row_value(row, 'pokemon_name')
        if _is_japanese_text(raw_name):
            return raw_name
        if isinstance(raw_name, str) and re.fullmatch(r"[A-Za-z0-9 .'-]+", raw_name.strip()):
            return raw_name.strip()
        return fallback_name or 'Pokemon'

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
            WHERE c.child_id = ?
            ORDER BY c.pokemon_id ASC
            ''',
            (resolved_child_id,),
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
        for pokemon_id in range(1, 152):
            row = owned_by_id.get(pokemon_id)
            if not row:
                pets.append({
                    'pokemon_id': pokemon_id,
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
            fallback_image_url, fallback_sprite_url = get_pokemon_fallback_image_urls(pokemon_id)
            pets.append({
                'pokemon_id': pokemon_id,
                'unlocked': True,
                'name': display_name,
                'nickname': _row_value(row, 'nickname') or _row_value(row, 'pet_name') or display_name,
                'level': level,
                'exp': exp,
                'total_exp': int(row['total_exp'] or 0),
                'max_exp': max_exp,
                'max_level': max_level,
                'exp_progress': 100 if is_master else min(100, round((exp / max(1, max_exp)) * 100)),
                'image_url': _row_value(row, 'image_url') or fallback_image_url,
                'sprite_url': _row_value(row, 'sprite_url') or fallback_sprite_url,
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
            'total_count': 151,
            'current_pet': current_pet,
            'reward_status': {
                'today_progress': studied_count,
                'today_target': daily_target,
                'today_progress_percent': min(100, round((studied_count / max(1, daily_target)) * 100)),
                'next_unlock_exp': next_unlock_exp,
                'has_locked_pokemon': len(rows) < 151,
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
        WHERE child_id = ?
        ORDER BY is_active DESC, id ASC
        LIMIT 1
        ''',
        (child_id,),
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


def unlockRandomPokemon(childId):
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
                'SELECT pokemon_id FROM child_pokemon_collection WHERE child_id = ?',
                (childId,),
            ).fetchall()
        }
        available_ids = [pokemon_id for pokemon_id in range(1, 152) if pokemon_id not in owned_ids]
        if not available_ids:
            return None

        pokemon_id = random.choice(available_ids)
        try:
            pokemon = get_cached_pokemon_by_id(pokemon_id)
        except PokeApiError:
            pokemon = None

        pet_name = (
            pokemon.get('name_jp')
            if pokemon and pokemon.get('name_jp')
            else pokemon.get('name')
            if pokemon and pokemon.get('name')
            else 'ポケモン'
        )
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
            'SELECT COUNT(*) AS count FROM child_pokemon_collection WHERE child_id = ?',
            (childId,),
        ).fetchone()
        return _child_collection_row_to_state(
            row,
            pokemon=pokemon,
            collection_count=collection_count['count'] if collection_count else None,
        )
    finally:
        conn.close()


def setActivePokemon(childId, pokemonId):
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


def addPokemonExp(childId, expAmount):
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
                unlockRandomPokemon(childId)
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


def addPetExp(childId, expAmount):
    return addPokemonExp(childId, expAmount)


def get_db_path():
    return data_path(DB_FILENAME)


def get_db_connection():
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


def init_db():
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
                word_id TEXT PRIMARY KEY,
                error_date TEXT NOT NULL,
                error_count INTEGER NOT NULL
            )
            '''
        )
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS children (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                grade TEXT NOT NULL,
                target_level TEXT NOT NULL,
                daily_target INTEGER NOT NULL DEFAULT 20,
                starter_pokemon_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
                FOREIGN KEY (child_id) REFERENCES children (id) ON UPDATE CASCADE ON DELETE CASCADE,
                FOREIGN KEY (vocab_id) REFERENCES vocabulary (id) ON UPDATE CASCADE ON DELETE CASCADE,
                UNIQUE (child_id, vocab_id)
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
        migrate_pokemon_catalog(conn)
        migrate_child_pokemon_collection(conn)
        migrate_children_profile_fields(conn)
        seed_demo_children(conn)
        seed_grammar_battle_data(conn)
        migrate_vocabulary_word_columns(conn)
        migrate_vocabulary_ids(conn)
        migrate_child_vocab_progress(conn)
        conn.commit()
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
        ('infinitive_pup', 'トゥードッグ', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png', 'infinitive', 100, 'normal', 0.7, '不定詞のポイント：want to do / decide to do / It is important to do を見つけよう。'),
        ('gerund_fox', 'イングフォックス', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/37.png', 'gerund', 100, 'normal', 0.7, '動名詞のポイント：enjoy / finish / 前置詞の後ろは ing 形になりやすいよ。'),
        ('comparison_cat', 'くらべキャット', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/300.png', 'comparison', 100, 'rare', 0.65, '比較のポイント：than は比較級、the と範囲があると最上級、as ... as は原級だよ。'),
        ('relative_owl', 'つなぐフクロウ', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/163.png', 'relative_pronoun', 100, 'normal', 0.7, '関係代名詞のポイント：人は who、物は which、場所は where をまず考えよう。'),
        ('perfect_squirrel', 'かんりょうリス', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/417.png', 'present_perfect', 100, 'rare', 0.65, '現在完了のポイント：ever / already / since / for がヒントになるよ。'),
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


def migrate_children_profile_fields(conn):
    columns = {row[1] for row in conn.execute('PRAGMA table_info(children)').fetchall()}
    if 'daily_target' not in columns:
        conn.execute('ALTER TABLE children ADD COLUMN daily_target INTEGER NOT NULL DEFAULT 20')
    if 'starter_pokemon_id' not in columns:
        conn.execute('ALTER TABLE children ADD COLUMN starter_pokemon_id INTEGER')

    child_rows = conn.execute(
        '''
        SELECT c.id
        FROM children AS c
        LEFT JOIN child_pokemon_collection AS p ON p.child_id = c.id
        WHERE c.daily_target IS NULL OR c.daily_target <= 0 OR c.starter_pokemon_id IS NULL
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
            'UPDATE children SET daily_target = COALESCE(daily_target, 20), starter_pokemon_id = ? WHERE id = ?',
            (starter_id, child_id),
        )
    conn.commit()


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
    today = get_today()
    conn = get_db_connection()
    try:
        existing = conn.execute(
            'SELECT error_count FROM error_log WHERE word_id = ?',
            (word_id,)
        ).fetchone()

        if existing:
            conn.execute(
                'UPDATE error_log SET error_count = error_count + 1, error_date = ? WHERE word_id = ?',
                (today, word_id)
            )
        else:
            conn.execute(
                'INSERT INTO error_log (word_id, error_date, error_count) VALUES (?, ?, ?)',
                (word_id, today, 1)
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


def get_review_list():
    init_db()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            'SELECT word_id, error_date, error_count FROM error_log WHERE error_count > 2 ORDER BY error_count DESC, error_date DESC'
        ).fetchall()
    finally:
        conn.close()

    vocab_map = get_vocab_index(vocab_list)
    english_map = {v['English'].strip().lower(): v for v in vocab_list if v.get('English')}
    review_items = []
    for row in rows:
        word_id = row['word_id']
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
            'last_error_date': row['error_date'],
        })
    return review_items


def get_children_list():
    init_db()
    conn = get_db_connection()
    try:
        rows = conn.execute(
            'SELECT id, name, grade, target_level, daily_target, starter_pokemon_id, created_at, updated_at FROM children ORDER BY id ASC'
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            'id': row['id'],
            'name': row['name'],
            'grade': row['grade'],
            'target_level': row['target_level'],
            'daily_target': row['daily_target'],
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
        conn = get_db_connection()
        try:
            row = conn.execute(
                '''
                SELECT pokemon_id, name, pokemon_name, image_url, sprite_url, type1, type2, generation, types
                FROM pokemon_catalog
                WHERE pokemon_id = ?
                ''',
                (pokemon_id,),
            ).fetchone()
        finally:
            conn.close()

        raw_name = _row_value(row, 'name') or _row_value(row, 'pokemon_name')
        display_name = raw_name if row and _is_japanese_text(raw_name) else (get_pokemon_fallback_name(pokemon_id) or 'ポケモン')
        option = {
            'id': int(pokemon_id),
            'name': display_name,
            'image_url': _row_value(row, 'image_url'),
            'sprite_url': _row_value(row, 'sprite_url'),
            'types': [],
        }
        if row and _row_value(row, 'types'):
            try:
                option['types'] = json.loads(_row_value(row, 'types'))
            except (TypeError, json.JSONDecodeError):
                option['types'] = []
        if not option['image_url'] or not option['sprite_url']:
            fallback_image_url, fallback_sprite_url = get_pokemon_fallback_image_urls(pokemon_id)
            option['image_url'] = option['image_url'] or fallback_image_url
            option['sprite_url'] = option['sprite_url'] or fallback_sprite_url
        options.append(option)

    return options
def upsert_child_profile(data):
    name = (data.get('name') or '').strip()
    grade = (data.get('grade') or '').strip()
    target_level = (data.get('target_level') or '').strip()
    daily_target = data.get('daily_target', 20)
    starter_pokemon_id = data.get('starter_pokemon_id')
    child_id = data.get('id')

    if not name:
        raise ValueError('name is required')
    if not grade:
        grade = '1'
    if not target_level:
        raise ValueError('target_level is required')
    allowed_target_levels = {'\u4e09\u7d1a', '\u6e96\u0032\u7d1a'}
    if target_level not in allowed_target_levels:
        target_level = '\u4e09\u7d1a'
    try:
        daily_target = int(daily_target)
    except (TypeError, ValueError):
        raise ValueError('daily_target must be an integer')
    if daily_target < 1:
        raise ValueError('daily_target must be at least 1')

    starter_row = None
    if starter_pokemon_id not in [None, '', 'null']:
        try:
            starter_pokemon_id = int(starter_pokemon_id)
        except (TypeError, ValueError):
            raise ValueError('starter_pokemon_id must be an integer')
        if starter_pokemon_id < 1 or starter_pokemon_id > 151:
            raise ValueError('starter_pokemon_id must be between 1 and 151')
        try:
            starter_row = get_cached_pokemon_by_id(starter_pokemon_id)
        except Exception:
            starter_row = None
    else:
        starter_pokemon_id = None

    conn = get_db_connection()
    try:
        if child_id not in [None, '', 'null']:
            try:
                child_id = int(child_id)
            except (TypeError, ValueError):
                raise ValueError('id must be an integer')
            conn.execute(
                '''
                UPDATE children
                SET name = ?, grade = ?, target_level = ?, daily_target = ?, starter_pokemon_id = ?
                WHERE id = ?
                ''',
                (name, grade, target_level, daily_target, starter_pokemon_id, child_id),
            )
            target_child_id = child_id
        else:
            cur = conn.execute(
                '''
                INSERT INTO children (name, grade, target_level, daily_target, starter_pokemon_id)
                VALUES (?, ?, ?, ?, ?)
                ''',
                (name, grade, target_level, daily_target, starter_pokemon_id),
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
                    starter_row.get('name') if starter_row else (get_pokemon_fallback_name(starter_pokemon_id) or 'ポケモン'),
                    starter_row.get('name') if starter_row else (get_pokemon_fallback_name(starter_pokemon_id) or 'ポケモン'),
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
            SELECT id, name, grade, target_level, daily_target, starter_pokemon_id, created_at, updated_at
            FROM children
            WHERE id = ?
            ''',
            (target_child_id,),
        ).fetchone()
        return dict(child_row) if child_row else None
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
            'SELECT id, correct_streak, mastery FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
            (child_id, vocab_id),
        ).fetchone()
        is_new_word = existing_progress is None
        previous_streak = int(existing_progress['correct_streak'] or 0) if existing_progress else 0
        next_streak = previous_streak + 1 if is_correct else 0
        previous_mastery = int(existing_progress['mastery'] or 0) if existing_progress else 0
        next_mastery = max(0, min(100, previous_mastery + (8 + min(next_streak, 5) if is_correct else -10)))

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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                correct_count = child_vocab_progress.correct_count + excluded.correct_count,
                wrong_count = child_vocab_progress.wrong_count + excluded.wrong_count,
                review_count = child_vocab_progress.review_count + 1,
                last_studied_at = excluded.last_studied_at,
                correct_streak = excluded.correct_streak,
                mastery = excluded.mastery,
                mastered = CASE WHEN excluded.mastery >= 100 THEN 1 ELSE child_vocab_progress.mastered END,
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
            pet_result = addPokemonExp(child_id, pet_exp)
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
            ORDER BY last_studied_at DESC, id DESC
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
            'importance': vocab.get('Importance', ''),
            'mastery': int(row['mastery'] or 0),
            'correct_count': int(row['correct_count'] or 0),
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
        rows = conn.execute('SELECT word_id, error_date, error_count FROM error_log').fetchall()
        if not rows:
            return

        merged_rows = {}
        for row in rows:
            old_key = row['word_id']
            normalized = old_key.strip().lower()
            vocab = vocab_by_id.get(old_key.strip()) or vocab_by_english.get(normalized)
            key = vocab.get('ID', '').strip() if vocab and vocab.get('ID', '').strip() else old_key
            current = merged_rows.get(key)
            if current:
                current['error_count'] += row['error_count']
                current['error_date'] = max(current['error_date'], row['error_date'])
            else:
                merged_rows[key] = {'error_date': row['error_date'], 'error_count': row['error_count']}

        conn.execute('DELETE FROM error_log')
        for key, value in merged_rows.items():
            conn.execute(
                'INSERT INTO error_log (word_id, error_date, error_count) VALUES (?, ?, ?)',
                (key, value['error_date'], value['error_count']),
            )
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


def get_today_review_entries(limit=20):
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


def generate_today_review_questions(limit=20):
    entries = get_today_review_entries(limit=limit)
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

    return questions[:20]


def api_today_review_quiz_payload():
    questions = generate_today_review_questions()
    progress = load_progress()
    return {
        'day': int(progress.get('count', 0) // 20) + 1 if progress.get('count', 0) else 1,
        'progress': int(progress.get('count', 0)),
        'target': 20,
        'questions': questions,
    }


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
            study_result = {'pet': addPokemonExp(child_id, xp_awarded), 'pet_exp_awarded': xp_awarded}
        except Exception:
            study_result = None

    if study_result and is_correct and xp_awarded > int(study_result.get('pet_exp_awarded') or 0):
        try:
            study_result['pet'] = addPokemonExp(child_id, xp_awarded - int(study_result.get('pet_exp_awarded') or 0))
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


@app.route('/api/home')
def api_home():
    settings = load_settings()
    progress = load_progress()
    target = settings.get('daily_target', 20)
    remain = max(0, target - progress['count'])
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
            mastered_row = conn.execute(
                'SELECT COUNT(*) AS count FROM child_vocab_progress WHERE child_id = ? AND mastered = 1',
                (child_id,),
            ).fetchone()
            study_days_row = conn.execute(
                'SELECT COUNT(DISTINCT study_date) AS count FROM daily_study_log WHERE child_id = ? AND studied_count > 0',
                (child_id,),
            ).fetchone()
        finally:
            conn.close()
        if child_row and child_row['daily_target']:
            target = int(child_row['daily_target'])
            remain = max(0, target - progress['count'])
        mastered_words = int(mastered_row['count'] or 0) if mastered_row else 0
        study_days = int(study_days_row['count'] or 0) if study_days_row else 0
    else:
        mastered_words = len(progress.get('mastered_words', []))
        study_days = 1 if progress.get('count', 0) > 0 else 0

    pet = get_child_pet_state(child_id) or get_pet_state(progress, settings)
    if child_id and pet:
        pet['learned_today'] = progress['count']
        pet['daily_target'] = target
        pet['completion'] = min(100, round((progress['count'] / max(1, target)) * 100))
    return jsonify(
        progress=progress['count'],
        target=target,
        remain=remain,
        total_words=total_words,
        mastered_words=mastered_words,
        study_days=study_days,
        pet=pet,
    )


@app.route('/api/pokemon-exp', methods=['POST'])
def api_pokemon_exp():
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

    pet = addPokemonExp(child_id, exp_amount)
    return jsonify(pet=pet, pet_exp_awarded=exp_amount)


@app.route('/api/flashcard')
def api_flashcard():
    requested_word = request.args.get('word', '').strip()
    importance = request.args.get('importance', '').strip()
    frequency = request.args.get('frequency', '').strip()
    progress = load_progress()
    mastered_words = [w.strip() for w in progress.get('mastered_words', []) if w.strip()]
    entries = filter_vocab_entries(vocab_list, importance=importance, frequency=frequency)

    if requested_word:
        vocab = resolve_vocab_entry(requested_word, entries) or resolve_vocab_entry(requested_word, vocab_list)
    else:
        available = [v for v in entries if v['English'].strip() not in mastered_words]
        if not available:
            available = entries or vocab_list
        vocab = random.choice(available)

    if vocab is None:
        abort(404, 'Word not found')

    sentence_jp = get_context_sentence(vocab['English'])
    return jsonify(
        id=vocab.get('ID', ''),
        word=vocab['English'],
        jp=vocab['Japanese'],
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
        example=vocab['Example_English'],
        example_jp=vocab.get('Example_Japanese', ''),
        example_cn=vocab.get('Example_Chinese', ''),
        sentence_jp=sentence_jp
    )


@app.route('/api/daily-words')
def api_daily_words():
    try:
        limit = int(request.args.get('limit', 20))
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, min(200, limit))
    words = []
    for vocab in vocab_list[:limit]:
        words.append(
            {
                'id': vocab.get('ID', ''),
                'word': vocab.get('English', ''),
                'partOfSpeech': vocab.get('Category', ''),
                'meaningJa': vocab.get('Japanese', ''),
                'meaningZh': vocab.get('Chinese', ''),
                'exampleEn': vocab.get('Example_English', '') or vocab.get('Example_English_Short', ''),
                'exampleJa': vocab.get('Example_Japanese', ''),
                'exampleZh': vocab.get('Example_Chinese', ''),
                'phrase': vocab.get('Phrase', ''),
                'importance': vocab.get('Importance', ''),
            }
        )
    return jsonify(words=words, targetWordCount=limit)


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

        now = get_now_iso()
        today = get_today()
        conn = get_db_connection()
        try:
            conn.execute('INSERT OR IGNORE INTO vocabulary (id) VALUES (?)', (vocab_id,))
            existing_progress = conn.execute(
                'SELECT mastery FROM child_vocab_progress WHERE child_id = ? AND vocab_id = ?',
                (child_id, vocab_id),
            ).fetchone()
            current_mastery = int(existing_progress['mastery'] or 0) if existing_progress else 0
            next_mastery = max(current_mastery, 100)
            conn.execute(
                '''
                INSERT INTO child_vocab_progress (
                    child_id, vocab_id, correct_count, wrong_count, review_count,
                    memory_level, last_studied_at, mastered, created_at, updated_at,
                    correct_streak, mastery
                ) VALUES (?, ?, 1, 0, 1, 0, ?, 1, ?, ?, 1, ?)
                ON CONFLICT(child_id, vocab_id) DO UPDATE SET
                    correct_count = child_vocab_progress.correct_count + 1,
                    review_count = child_vocab_progress.review_count + 1,
                    last_studied_at = excluded.last_studied_at,
                    mastered = 1,
                    mastery = excluded.mastery,
                    correct_streak = child_vocab_progress.correct_streak + 1,
                    updated_at = excluded.updated_at
                ''',
                (child_id, vocab_id, now, now, now, next_mastery),
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

    progress = mark_word_mastered(word)
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
        finally:
            conn.close()
    remain = max(0, target - progress['count'])
    return jsonify(progress=progress['count'], target=target, remain=remain, mastered_words=progress['mastered_words'])


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
    progress = load_progress()
    mastered_words = [w.strip() for w in progress.get('mastered_words', []) if w.strip()]
    mastered_set = {word.lower() for word in mastered_words}
    entries = filter_vocab_entries(vocab_list, importance=importance, frequency=frequency)
    if not entries:
        entries = vocab_list

    mastered_entries = [
        entry for entry in entries
        if entry.get('English', '').strip().lower() in mastered_set
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

    error_counts = {}
    conn = get_db_connection()
    try:
        rows = conn.execute('SELECT word_id, error_count FROM error_log').fetchall()
    finally:
        conn.close()
    for row in rows:
        error_counts[str(row['word_id']).strip().lower()] = int(row['error_count'] or 0)

    def get_entry_error_count(entry):
        keys = [
            str(entry.get('ID', '')).strip().lower(),
            str(entry.get('English', '')).strip().lower(),
        ]
        return max([error_counts.get(key, 0) for key in keys] or [0])

    if requested_word:
        correct_vocab = resolve_vocab_entry(requested_word, entries) or resolve_vocab_entry(requested_word, vocab_list)
    else:
        weighted_candidates = []
        for entry in mastered_entries:
            weight = 1 + min(8, get_entry_error_count(entry) * 2)
            weighted_candidates.extend([entry] * weight)
        correct_vocab = random.choice(weighted_candidates) if weighted_candidates else random.choice(mastered_entries)

    if correct_vocab is None:
        abort(404, 'Word not found')

    question = f'「{correct_vocab["Japanese"]}」は英語でどれ？'
    correct_answer = correct_vocab['English']
    distractor_pool = mastered_entries if len(mastered_entries) >= 4 else entries
    if len(distractor_pool) < 4:
        distractor_pool = vocab_list
    other_vocabs = [v for v in distractor_pool if v['English'] != correct_answer]
    wrong_choices = random.sample(other_vocabs, min(3, len(other_vocabs)))
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
    )


@app.route('/api/vocab-expansion')
def api_vocab_expansion():
    try:
        question = build_vocab_expansion_question(request.args.get('mode'))
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
    return jsonify(api_today_review_quiz_payload())


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
    try:
        review_list = get_review_list()
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
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        try:
            child = upsert_child_profile(data)
        except ValueError as exc:
            abort(400, str(exc))
        return jsonify(child=child)
    return jsonify(children=get_children_list())


@app.route('/api/children/<int:child_id>', methods=['DELETE'])
def api_delete_child(child_id):
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id FROM children WHERE id = ?', (child_id,)).fetchone()
        if not row:
            abort(404, 'child not found')
        conn.execute('DELETE FROM children WHERE id = ?', (child_id,))
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


@app.route('/settings')
def settings_redirect():
    return redirect('/app/settings')


if __name__ == '__main__':
    app.run(debug=True)

