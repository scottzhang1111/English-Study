import argparse
import csv
import json
import os
import random
import re
import sys
from collections import Counter
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg2
from psycopg2.extras import DictCursor


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CSV_PATH = os.path.join(ROOT_DIR, 'data', 'eiken_vocab_0001_0900_updated_0078_0900.csv')
PHRASE_CSV_PATH = os.path.join(ROOT_DIR, 'data', 'eiken3_phrases_0901_1300.csv')
LEVEL_PRE2 = 'eiken_pre2'
LEVEL_EIKEN3 = 'eiken3'
PHRASE_PART_OF_SPEECH = '熟語'
QUESTION_TYPES = ('meaning_choice', 'reverse_choice', 'cloze', 'listening_script')


def clean(value):
    return str(value or '').strip()


def require_database_url():
    database_url = clean(os.environ.get('DATABASE_URL'))
    if not database_url:
        raise RuntimeError('DATABASE_URL is required. This script must run against Render PostgreSQL.')
    if database_url.startswith('sqlite'):
        raise RuntimeError('DATABASE_URL must be PostgreSQL, not SQLite.')
    parts = urlsplit(database_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if 'sslmode' not in query:
        query['sslmode'] = 'require'
        database_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return database_url


def fetch_table_columns(cur, table_name):
    cur.execute(
        '''
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ''',
        (table_name,),
    )
    columns = {row['column_name'] for row in cur.fetchall()}
    if not columns:
        raise RuntimeError(f'required table missing: {table_name}')
    return columns


def require_columns(cur, table_name, required):
    columns = fetch_table_columns(cur, table_name)
    missing = set(required) - columns
    if missing:
        raise RuntimeError(f'{table_name} missing required columns: {sorted(missing)}')
    return columns


def print_level_counts(cur, table_name):
    cur.execute(f'SELECT level, COUNT(*) AS count FROM {table_name} GROUP BY level ORDER BY level')
    rows = cur.fetchall()
    print(f'{table_name} by level:')
    if not rows:
        print('  (none)')
    for row in rows:
        print(f'  {row["level"]}: {row["count"]}')


def count_by_level(cur, table_name, level):
    cur.execute(f'SELECT COUNT(*) AS count FROM {table_name} WHERE level = %s', (level,))
    return int(cur.fetchone()['count'])


def load_csv_rows():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(CSV_PATH)
    with open(CSV_PATH, newline='', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        required = {'word', 'meaning_ja', 'example_en', 'example_ja', 'pos'}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f'CSV missing required columns: {sorted(missing)}')
        rows = []
        for row in reader:
            word = clean(row.get('word'))
            meaning = clean(row.get('meaning_ja'))
            if word and meaning:
                rows.append(row)
        return rows


def load_phrase_csv_rows():
    if not os.path.exists(PHRASE_CSV_PATH):
        raise FileNotFoundError(PHRASE_CSV_PATH)
    with open(PHRASE_CSV_PATH, newline='', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        required = {
            'word',
            'frequency',
            'meaning_ja',
            'meaning_cn',
            'phrase',
            'example_en',
            'example_ja',
            'example_cn',
            'synonym',
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f'phrase CSV missing required columns: {sorted(missing)}')
        rows = []
        for row in reader:
            word = clean(row.get('word'))
            meaning = clean(row.get('meaning_ja'))
            if word and meaning:
                rows.append(row)
        return rows


def blank_word(sentence, word):
    sentence = clean(sentence)
    word = clean(word)
    if not sentence:
        return 'Choose the word that fits: ____'
    pattern = re.compile(rf'\b{re.escape(word)}\b', re.IGNORECASE)
    result = pattern.sub('____', sentence, count=1)
    return result if result != sentence else f'{sentence}\n\nChoose the target word.'


def sample_choices(items, correct, key):
    correct = clean(correct)
    pool = [
        clean(item[key])
        for item in items
        if clean(item.get(key)) and clean(item.get(key)).lower() != correct.lower()
    ]
    random.shuffle(pool)
    choices = [correct] + pool[:3]
    while len(choices) < 4:
        choices.append(correct)
    random.shuffle(choices)
    return choices[:4]


def get_existing_global_word_keys(cur):
    cur.execute('SELECT lower(word) AS word_key FROM words')
    return {row['word_key'] for row in cur.fetchall()}


def get_eiken3_max_frequency(cur):
    cur.execute('SELECT COALESCE(MAX(frequency), 0) AS max_frequency FROM words WHERE level = %s', (LEVEL_EIKEN3,))
    return int(cur.fetchone()['max_frequency'] or 0)


def preview_import(cur, csv_rows):
    existing_words = get_existing_global_word_keys(cur)
    seen_csv = set()
    insert_rows = []
    duplicate_csv = 0
    skipped_existing_global = 0

    for row in csv_rows:
        word_key = clean(row.get('word')).lower()
        if word_key in seen_csv:
            duplicate_csv += 1
            continue
        seen_csv.add(word_key)
        if word_key in existing_words:
            skipped_existing_global += 1
            continue
        insert_rows.append(row)

    return insert_rows, duplicate_csv, skipped_existing_global


def update_old_levels(cur):
    updates = []
    for table in ('words', 'questions', 'grammar_lessons'):
        cur.execute(
            f'UPDATE {table} SET level = %s WHERE level IS DISTINCT FROM %s',
            (LEVEL_PRE2, LEVEL_EIKEN3),
        )
        updates.append((table, cur.rowcount))
    grammar_quiz_columns = fetch_table_columns(cur, 'grammar_quizzes')
    if 'level' in grammar_quiz_columns:
        cur.execute(
            'UPDATE grammar_quizzes SET level = %s WHERE level IS DISTINCT FROM %s',
            (LEVEL_PRE2, LEVEL_EIKEN3),
        )
        updates.append(('grammar_quizzes', cur.rowcount))
    return updates


def move_existing_eiken3_questions_to_pre2(cur):
    cur.execute(
        'UPDATE questions SET level = %s WHERE level = %s',
        (LEVEL_PRE2, LEVEL_EIKEN3),
    )
    return cur.rowcount


def insert_eiken3_words(cur, rows):
    frequency = get_eiken3_max_frequency(cur) + 1
    inserted = []
    for row in rows:
        cur.execute(
            '''
            INSERT INTO words (
                word, level, frequency, part_of_speech, meaning_ja,
                example_en, example_ja
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, word, meaning_ja, example_en, example_ja
            ''',
            (
                clean(row.get('word')),
                LEVEL_EIKEN3,
                frequency,
                clean(row.get('pos')),
                clean(row.get('meaning_ja')),
                clean(row.get('example_en')),
                clean(row.get('example_ja')),
            ),
        )
        inserted.append(dict(cur.fetchone()))
        frequency += 1
    return inserted


def parse_frequency(value):
    text = clean(value)
    if not text:
        raise RuntimeError('phrase CSV row missing frequency')
    try:
        return int(text)
    except ValueError as exc:
        raise RuntimeError(f'invalid frequency: {text}') from exc


def insert_eiken3_phrase_words(cur, rows):
    inserted = []
    for row in rows:
        cur.execute(
            '''
            INSERT INTO words (
                word, level, frequency, part_of_speech, meaning_ja,
                meaning_cn, phrase, example_en, example_ja, example_cn,
                synonyms
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, word, meaning_ja, example_en, example_ja
            ''',
            (
                clean(row.get('word')),
                LEVEL_EIKEN3,
                parse_frequency(row.get('frequency')),
                PHRASE_PART_OF_SPEECH,
                clean(row.get('meaning_ja')),
                clean(row.get('meaning_cn')),
                clean(row.get('phrase')),
                clean(row.get('example_en')),
                clean(row.get('example_ja')),
                clean(row.get('example_cn')),
                clean(row.get('synonym')),
            ),
        )
        inserted.append(dict(cur.fetchone()))
    return inserted


def existing_question_keys(cur):
    cur.execute(
        '''
        SELECT word_id, question_type
        FROM questions
        WHERE level = %s
          AND word_id IS NOT NULL
          AND question_type = ANY(%s)
        ''',
        (LEVEL_EIKEN3, list(QUESTION_TYPES)),
    )
    return {(row['word_id'], row['question_type']) for row in cur.fetchall()}


def build_question_specs(word, all_words):
    word_choices = sample_choices(all_words, word['word'], 'word')
    meaning_choices = sample_choices(all_words, word['meaning_ja'], 'meaning_ja')
    explanation = f'{word["word"]} = {word["meaning_ja"]}'
    return [
        (
            'meaning_choice',
            f'What is the Japanese meaning of "{word["word"]}"?',
            meaning_choices,
            word['meaning_ja'],
            explanation,
        ),
        (
            'reverse_choice',
            f'Which English word means 「{word["meaning_ja"]}」?',
            word_choices,
            word['word'],
            explanation,
        ),
        (
            'cloze',
            blank_word(word.get('example_en'), word['word']),
            word_choices,
            word['word'],
            explanation,
        ),
        (
            'listening_script',
            f'Listen to the script and choose the target word.\n{clean(word.get("example_en")) or word["word"]}',
            word_choices,
            word['word'],
            explanation,
        ),
    ]


def preview_question_inserts(cur, words):
    existing = existing_question_keys(cur)
    count = 0
    by_type = Counter()
    for word in words:
        for question_type in QUESTION_TYPES:
            if (word['id'], question_type) not in existing:
                count += 1
                by_type[question_type] += 1
    return count, by_type


def insert_questions(cur, words):
    existing = existing_question_keys(cur)
    inserted = 0
    by_type = Counter()
    for word in words:
        for question_type, prompt, choices, correct_answer, explanation in build_question_specs(word, words):
            if (word['id'], question_type) in existing:
                continue
            cur.execute(
                '''
                INSERT INTO questions (
                    category, section, question_type, level, word_id, prompt,
                    choices, correct_answer, explanation_ja, target_vocab,
                    external_question_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''',
                (
                    'vocabulary',
                    'vocabulary',
                    question_type,
                    LEVEL_EIKEN3,
                    word['id'],
                    prompt,
                    json.dumps(choices, ensure_ascii=False),
                    correct_answer,
                    explanation,
                    word['word'],
                    f'eiken3-auto-{word["id"]}-{question_type}',
                ),
            )
            existing.add((word['id'], question_type))
            inserted += 1
            by_type[question_type] += 1
    return inserted, by_type


def duplicate_word_count(cur):
    cur.execute(
        '''
        SELECT COUNT(*) AS count
        FROM (
            SELECT lower(word) AS word_key
            FROM words
            WHERE level IN (%s, %s)
            GROUP BY lower(word)
            HAVING BOOL_OR(level = %s) AND BOOL_OR(level = %s)
        ) duplicates
        ''',
        (LEVEL_PRE2, LEVEL_EIKEN3, LEVEL_PRE2, LEVEL_EIKEN3),
    )
    return int(cur.fetchone()['count'])


def daily_words_by_target_level(cur):
    cur.execute('SELECT DISTINCT target_level FROM children ORDER BY target_level')
    levels = [clean(row['target_level']) for row in cur.fetchall() if clean(row['target_level'])]
    results = []
    for level in levels:
        cur.execute('SELECT COUNT(*) AS count FROM words WHERE level = %s', (level,))
        results.append((level, int(cur.fetchone()['count']) > 0))
    return results


def validate_schema(cur):
    require_columns(
        cur,
        'words',
        {'id', 'word', 'level', 'frequency', 'part_of_speech', 'meaning_ja', 'example_en', 'example_ja'},
    )
    require_columns(
        cur,
        'questions',
        {
            'category',
            'section',
            'question_type',
            'level',
            'word_id',
            'prompt',
            'choices',
            'correct_answer',
            'explanation_ja',
            'target_vocab',
            'external_question_id',
        },
    )
    require_columns(cur, 'grammar_lessons', {'level'})
    fetch_table_columns(cur, 'grammar_quizzes')
    require_columns(cur, 'children', {'target_level'})


def validate_phrase_schema(cur):
    require_columns(
        cur,
        'words',
        {
            'id',
            'word',
            'level',
            'frequency',
            'part_of_speech',
            'meaning_ja',
            'meaning_cn',
            'phrase',
            'example_en',
            'example_ja',
            'example_cn',
            'synonyms',
        },
    )
    require_columns(
        cur,
        'questions',
        {
            'category',
            'section',
            'question_type',
            'level',
            'word_id',
            'prompt',
            'choices',
            'correct_answer',
            'explanation_ja',
            'target_vocab',
            'external_question_id',
        },
    )


def count_eiken3_phrases(cur):
    cur.execute(
        '''
        SELECT COUNT(*) AS count
        FROM words
        WHERE level = %s AND part_of_speech = %s
        ''',
        (LEVEL_EIKEN3, PHRASE_PART_OF_SPEECH),
    )
    return int(cur.fetchone()['count'])


def run_phrases(apply):
    database_url = require_database_url()
    csv_rows = load_phrase_csv_rows()
    conn = psycopg2.connect(database_url, cursor_factory=DictCursor)
    try:
        conn.autocommit = False
        cur = conn.cursor()
        validate_phrase_schema(cur)

        insert_rows, duplicate_csv, skipped_existing_global = preview_import(cur, csv_rows)
        questions_to_generate = len(insert_rows) * len(QUESTION_TYPES)

        print('mode:', 'APPLY' if apply else 'DRY-RUN')
        print('csv_path:', PHRASE_CSV_PATH)
        print(f'CSV total: {len(csv_rows)}')
        print(f'existing words in global words table: {skipped_existing_global}')
        print(f'duplicate CSV rows skipped: {duplicate_csv}')
        print(f'eiken3 phrase words to insert: {len(insert_rows)}')
        print(f'eiken3 questions to generate: {questions_to_generate}')

        if apply:
            print('inserting eiken3 phrase words...')
            inserted_words = insert_eiken3_phrase_words(cur, insert_rows)
            print(f'  inserted words: {len(inserted_words)}')
            print('generating eiken3 phrase questions...')
            inserted_questions, by_type = insert_questions(cur, inserted_words)
            print(f'  inserted questions: {inserted_questions}')
            for question_type in QUESTION_TYPES:
                print(f'  {question_type}: {by_type[question_type]}')
            conn.commit()
            print('committed: yes')
            print('words by level:')
            print_level_counts(cur, 'words')
            print('questions by level:')
            print_level_counts(cur, 'questions')
            print(f'eiken3 熟語 count: {count_eiken3_phrases(cur)}')
        else:
            conn.rollback()
            print('committed: no')
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run(apply):
    database_url = require_database_url()
    csv_rows = load_csv_rows()
    conn = psycopg2.connect(database_url, cursor_factory=DictCursor)
    try:
        conn.autocommit = False
        cur = conn.cursor()
        validate_schema(cur)

        print('mode:', 'APPLY' if apply else 'DRY-RUN')
        print('csv_path:', CSV_PATH)
        print('csv_rows:', len(csv_rows))
        print('before:')
        print_level_counts(cur, 'words')
        print_level_counts(cur, 'questions')
        print_level_counts(cur, 'grammar_lessons')

        insert_rows, duplicate_csv, skipped_existing_global = preview_import(cur, csv_rows)
        print('planned old-level updates:')
        for table in ('words', 'questions', 'grammar_lessons'):
            cur.execute(
                f'SELECT COUNT(*) AS count FROM {table} WHERE level IS DISTINCT FROM %s',
                (LEVEL_EIKEN3,),
            )
            print(f'  {table}: {cur.fetchone()["count"]}')
        grammar_quiz_columns = fetch_table_columns(cur, 'grammar_quizzes')
        if 'level' in grammar_quiz_columns:
            cur.execute(
                'SELECT COUNT(*) AS count FROM grammar_quizzes WHERE level IS DISTINCT FROM %s',
                (LEVEL_EIKEN3,),
            )
            print(f'  grammar_quizzes: {cur.fetchone()["count"]}')
        else:
            print('  grammar_quizzes: no level column')
        print('planned import:')
        print(f'  CSV total: {len(csv_rows)}')
        print(f'  existing words in global words table: {skipped_existing_global}')
        print(f'  eiken3 words to insert: {len(insert_rows)}')
        print(f'  duplicate CSV words skipped: {duplicate_csv}')
        print(f'  eiken3 questions to generate: {len(insert_rows) * len(QUESTION_TYPES)}')

        if apply:
            print('moving existing eiken3 questions to eiken_pre2...')
            moved_questions = move_existing_eiken3_questions_to_pre2(cur)
            print(f'  questions: {moved_questions}')
            print('applying old-level updates...')
            for table, rowcount in update_old_levels(cur):
                print(f'  {table}: {rowcount}')
            print('inserting eiken3 words...')
            inserted_words = insert_eiken3_words(cur, insert_rows)
            print(f'  inserted words: {len(inserted_words)}')
            print('generating eiken3 questions...')
            inserted_questions, by_type = insert_questions(cur, inserted_words)
            print(f'  inserted questions: {inserted_questions}')
            for question_type in QUESTION_TYPES:
                print(f'  {question_type}: {by_type[question_type]}')
            conn.commit()
            print('committed: yes')
        else:
            print('planned questions:')
            print(f'  eiken3 words from this import: {len(insert_rows)}')
            print(f'  eiken3 questions from this import: {len(insert_rows) * len(QUESTION_TYPES)}')
            conn.rollback()
            print('committed: no')

        if apply:
            print('after:')
            print_level_counts(cur, 'words')
            print_level_counts(cur, 'questions')
            print_level_counts(cur, 'grammar_lessons')
            print('final counts:')
            print(f'  eiken_pre2 words: {count_by_level(cur, "words", LEVEL_PRE2)}')
            print(f'  eiken_pre2 questions: {count_by_level(cur, "questions", LEVEL_PRE2)}')
            print(f'  eiken3 words: {count_by_level(cur, "words", LEVEL_EIKEN3)}')
            print(f'  eiken3 questions: {count_by_level(cur, "questions", LEVEL_EIKEN3)}')
            print(f'  duplicate words across eiken3/eiken_pre2: {duplicate_word_count(cur)}')
            print('daily words availability by target_level:')
            for level, available in daily_words_by_target_level(cur):
                print(f'  {level}: {"ok" if available else "empty"}')
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Migrate Render PostgreSQL content for EIKEN 3 support.')
    parser.add_argument('--apply', action='store_true', help='commit changes; omitted means dry-run')
    parser.add_argument('--phrases', action='store_true', help='import EIKEN 3 phrase CSV instead of the base vocab CSV')
    args = parser.parse_args()
    try:
        if args.phrases:
            run_phrases(args.apply)
        else:
            run(args.apply)
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        raise


if __name__ == '__main__':
    main()
