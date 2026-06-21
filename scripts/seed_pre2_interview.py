import argparse
import os
import re
import sqlite3
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_DIR = ROOT_DIR / 'data' / 'eiken' / 'eiken_pre2' / 'eiken_pre2 interview'
WORKBOOK_NAME = 'eiken_pre2_ai_interview_question_bank_v1.xlsx'
EXPECTED_IDS = [f'PRE2_INT_{index:03d}' for index in range(1, 11)]
QUESTION_TYPES = {
    1: 'passage',
    2: 'picture_present',
    3: 'picture_future',
    4: 'opinion_personal',
    5: 'opinion_social',
}
REQUIRED_COLUMNS = {
    'set_id', 'level', 'title', 'passage_title', 'passage_text', 'picture_prompt',
    *{f'q{index}' for index in range(1, 6)},
    *{f'sample_answer_q{index}' for index in range(1, 6)},
    *{f'tips_q{index}' for index in range(1, 6)},
}


def load_project_database_url():
    env_path = ROOT_DIR / '.env'
    if env_path.exists():
        for raw_line in env_path.read_text(encoding='utf-8-sig').splitlines():
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if key.strip() == 'DATABASE_URL' and value.strip():
                os.environ['DATABASE_URL'] = value.strip().strip('"').strip("'")
                return '.env'
    return 'process environment' if os.environ.get('DATABASE_URL', '').strip() else 'local SQLite'


def _xlsx_column_index(cell_reference):
    letters = re.match(r'[A-Z]+', cell_reference or '')
    if not letters:
        return 0
    value = 0
    for char in letters.group(0):
        value = value * 26 + ord(char) - 64
    return value - 1


def _xlsx_shared_strings(archive):
    try:
        root = ElementTree.fromstring(archive.read('xl/sharedStrings.xml'))
    except KeyError:
        return []
    namespace = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    return [
        ''.join(node.text or '' for node in item.findall('.//x:t', namespace))
        for item in root.findall('x:si', namespace)
    ]


def _xlsx_sheet_path(archive, sheet_name):
    workbook = ElementTree.fromstring(archive.read('xl/workbook.xml'))
    namespace = {
        'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    }
    relationship_id = None
    for sheet in workbook.findall('x:sheets/x:sheet', namespace):
        if sheet.attrib.get('name') == sheet_name:
            relationship_id = sheet.attrib.get(f"{{{namespace['r']}}}id")
            break
    if not relationship_id:
        raise ValueError(f'worksheet not found: {sheet_name}')
    relationships = ElementTree.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    for relationship in relationships:
        if relationship.attrib.get('Id') == relationship_id:
            target = relationship.attrib['Target'].lstrip('/')
            return target if target.startswith('xl/') else f'xl/{target}'
    raise ValueError(f'worksheet relationship not found: {sheet_name}')


def read_question_bank(workbook_path):
    with zipfile.ZipFile(workbook_path) as archive:
        shared_strings = _xlsx_shared_strings(archive)
        sheet_path = _xlsx_sheet_path(archive, 'QuestionBank')
        root = ElementTree.fromstring(archive.read(sheet_path))
    namespace = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows = []
    for row in root.findall('.//x:sheetData/x:row', namespace):
        values = []
        for cell in row.findall('x:c', namespace):
            index = _xlsx_column_index(cell.attrib.get('r'))
            while len(values) <= index:
                values.append('')
            cell_type = cell.attrib.get('t')
            if cell_type == 'inlineStr':
                value = ''.join(node.text or '' for node in cell.findall('.//x:t', namespace))
            else:
                value_node = cell.find('x:v', namespace)
                raw_value = value_node.text if value_node is not None else ''
                value = shared_strings[int(raw_value)] if cell_type == 's' and raw_value else raw_value
            values[index] = value
        rows.append(values)
    if not rows:
        raise ValueError('QuestionBank worksheet is empty')
    headers = [str(value or '').strip() for value in rows[0]]
    missing_columns = sorted(REQUIRED_COLUMNS - set(headers))
    if missing_columns:
        raise ValueError(f'missing workbook columns: {", ".join(missing_columns)}')
    records = []
    for values in rows[1:]:
        padded = values + [''] * max(0, len(headers) - len(values))
        record = {header: str(padded[index] or '').strip() for index, header in enumerate(headers)}
        if record.get('set_id'):
            records.append(record)
    return records


def validate_source(source_dir):
    source_dir = Path(source_dir)
    workbook_path = source_dir / WORKBOOK_NAME
    if not workbook_path.is_file():
        raise FileNotFoundError(f'workbook not found: {workbook_path}')
    records = read_question_bank(workbook_path)
    external_ids = [record['set_id'] for record in records]
    if external_ids != EXPECTED_IDS:
        raise ValueError(f'expected IDs {EXPECTED_IDS}, got {external_ids}')
    missing_values = []
    for record in records:
        for column in REQUIRED_COLUMNS:
            if not record.get(column):
                missing_values.append(f"{record['set_id']}:{column}")
        if record['level'] != 'eiken_pre2':
            raise ValueError(f"unexpected level for {record['set_id']}: {record['level']}")
    if missing_values:
        raise ValueError(f'missing required values: {", ".join(sorted(missing_values))}')
    image_files = sorted(path.name for path in source_dir.glob('PRE2_INT_*.png'))
    expected_images = [f'{external_id}.png' for external_id in EXPECTED_IDS]
    if image_files != expected_images:
        raise ValueError(f'expected images {expected_images}, got {image_files}')
    return records


class DirectPostgresConnection:
    def __init__(self, connection):
        self.connection = connection
        self.is_postgres = True

    def execute(self, sql, params=None):
        from psycopg2.extras import DictCursor

        cursor = self.connection.cursor(cursor_factory=DictCursor)
        cursor.execute(sql.replace('?', '%s'), params or ())
        return cursor

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


def connect_database():
    database_url = os.environ.get('DATABASE_URL', '').strip()
    if database_url:
        import psycopg2

        return DirectPostgresConnection(psycopg2.connect(database_url))
    conn = sqlite3.connect(ROOT_DIR / 'eigo_quest_local_v1.sqlite')
    conn.row_factory = sqlite3.Row
    return conn


def ensure_schema(conn):
    id_definition = 'INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY' if not isinstance(conn, sqlite3.Connection) else 'INTEGER PRIMARY KEY AUTOINCREMENT'
    conn.execute(
        f'''
        CREATE TABLE IF NOT EXISTS eiken_interview_sets (
            id {id_definition},
            external_id TEXT NOT NULL UNIQUE,
            level TEXT NOT NULL,
            title TEXT NOT NULL,
            passage_title TEXT NOT NULL,
            passage_text TEXT NOT NULL,
            image_filename TEXT NOT NULL,
            display_order INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    conn.execute(
        f'''
        CREATE TABLE IF NOT EXISTS eiken_interview_questions (
            id {id_definition},
            set_id INTEGER NOT NULL REFERENCES eiken_interview_sets(id) ON DELETE CASCADE,
            question_order INTEGER NOT NULL,
            question_type TEXT NOT NULL,
            question_text TEXT NOT NULL,
            model_answer TEXT NOT NULL,
            tip_ja TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (set_id, question_order)
        )
        '''
    )


def upsert_records(conn, records):
    for display_order, record in enumerate(records, start=1):
        conn.execute(
            '''
            INSERT INTO eiken_interview_sets (
                external_id, level, title, passage_title, passage_text,
                image_filename, display_order, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(external_id) DO UPDATE SET
                level = excluded.level,
                title = excluded.title,
                passage_title = excluded.passage_title,
                passage_text = excluded.passage_text,
                image_filename = excluded.image_filename,
                display_order = excluded.display_order,
                is_active = excluded.is_active
            ''',
            (
                record['set_id'], record['level'], record['title'], record['passage_title'],
                record['passage_text'], f"{record['set_id']}.png", display_order,
            ),
        )
        set_row = conn.execute(
            'SELECT id FROM eiken_interview_sets WHERE external_id = ?',
            (record['set_id'],),
        ).fetchone()
        set_id = int(set_row['id'])
        for question_order in range(1, 6):
            conn.execute(
                '''
                INSERT INTO eiken_interview_questions (
                    set_id, question_order, question_type, question_text, model_answer, tip_ja
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(set_id, question_order) DO UPDATE SET
                    question_type = excluded.question_type,
                    question_text = excluded.question_text,
                    model_answer = excluded.model_answer,
                    tip_ja = excluded.tip_ja
                ''',
                (
                    set_id,
                    question_order,
                    QUESTION_TYPES[question_order],
                    record[f'q{question_order}'],
                    record[f'sample_answer_q{question_order}'],
                    record[f'tips_q{question_order}'],
                ),
            )


def verify_counts(conn):
    placeholders = ', '.join('?' for _ in EXPECTED_IDS)
    set_count = int(conn.execute(
        f'SELECT COUNT(*) AS count FROM eiken_interview_sets WHERE external_id IN ({placeholders})',
        tuple(EXPECTED_IDS),
    ).fetchone()['count'])
    question_count = int(conn.execute(
        f'''
        SELECT COUNT(*) AS count
        FROM eiken_interview_questions AS q
        JOIN eiken_interview_sets AS s ON s.id = q.set_id
        WHERE s.external_id IN ({placeholders})
        ''',
        tuple(EXPECTED_IDS),
    ).fetchone()['count'])
    return set_count, question_count


def database_target_label():
    database_url = os.environ.get('DATABASE_URL', '').strip()
    if not database_url:
        return f"SQLite {ROOT_DIR / 'eigo_quest_local_v1.sqlite'}"
    parsed = urlparse(database_url)
    return f"PostgreSQL host={parsed.hostname} database={parsed.path.lstrip('/')}"


def main(argv=None):
    parser = argparse.ArgumentParser(description='Validate or seed Eiken Pre-2 interview question bank V1.')
    parser.add_argument('--apply', action='store_true', help='Write validated records to the configured database.')
    parser.add_argument('--source-dir', default=str(DEFAULT_SOURCE_DIR), help='Directory containing the workbook and PNG files.')
    args = parser.parse_args(argv)

    records = validate_source(args.source_dir)
    print(f'Validated {len(records)} sets, {len(records) * 5} questions, and {len(records)} images.')
    if not args.apply:
        print('Dry run only. Re-run with --apply to write to the database.')
        return 0

    source = load_project_database_url()
    print(f'Database source: {source}')
    print(f'Database target: {database_target_label()}')
    conn = connect_database()
    try:
        ensure_schema(conn)
        upsert_records(conn, records)
        conn.commit()
        set_count, question_count = verify_counts(conn)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    print(f'Seed complete. Seeded totals: {set_count} sets / {question_count} questions.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
