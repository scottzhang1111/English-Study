import csv
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BANK_DIR = ROOT / 'data' / 'eiken_pre2_ai_question_bank'
SQLITE_PATH = BANK_DIR / 'eiken_pre2_ai_question_bank.sqlite'
CSV_PATH = BANK_DIR / 'question_bank.csv'


def clean(value):
    return '' if value is None else str(value).strip()


def option_text(row, option):
    return clean(row.get(f'option_{option}'))


def build_explanation(row):
    correct = clean(row.get('correct_option')).upper()
    correct_text = option_text(row, correct)
    question_type = clean(row.get('question_type'))
    target_vocab = clean(row.get('target_vocab'))
    wrong_options = [
        option_text(row, option)
        for option in ['A', 'B', 'C', 'D']
        if option != correct and option_text(row, option)
    ]
    wrong_sample = '、'.join(wrong_options[:2])

    if question_type == 'reading':
        first = f'本文の内容に合う選択肢は、{correct} の「{correct_text}」です。'
        second = '問題文と本文の同じ意味になるところを探すと、答えの手がかりが見つかります。'
        third = f'{wrong_sample} などは、本文の内容と少しずれているので選びません。' if wrong_sample else ''
    elif question_type == 'dialogue_completion':
        first = f'会話の流れに合う返事は、{correct} の「{correct_text}」です。'
        second = '前後の文を読むと、相手が何を聞いているか、何に答えるべきかが分かります。'
        third = f'{wrong_sample} などは、会話として自然につながりにくい選択肢です。' if wrong_sample else ''
    else:
        first = f'文の流れでは「{correct_text}」という意味が必要なので、正解は {correct} です。'
        second = '空所の前後を読むと、どんな意味の単語が入るか分かります。'
        third = f'{target_vocab} はこの問題で覚えたい大事な語句です。' if target_vocab else ''

    return ''.join(part for part in [first, second, third] if part)


def ensure_sqlite_column(conn):
    columns = {row[1] for row in conn.execute('PRAGMA table_info(question_bank)').fetchall()}
    if 'explanation_ja' not in columns:
        conn.execute('ALTER TABLE question_bank ADD COLUMN explanation_ja TEXT')


def update_sqlite():
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(SQLITE_PATH)

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        ensure_sqlite_column(conn)
        rows = conn.execute('SELECT * FROM question_bank ORDER BY set_id, question_no').fetchall()
        for row in rows:
            data = dict(row)
            conn.execute(
                'UPDATE question_bank SET explanation_ja = ? WHERE question_id = ?',
                (build_explanation(data), data['question_id']),
            )
        conn.commit()
        return len(rows)
    finally:
        conn.close()


def update_csv():
    if not CSV_PATH.exists():
        raise FileNotFoundError(CSV_PATH)

    with CSV_PATH.open('r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        if 'explanation_ja' not in fieldnames:
            insert_at = fieldnames.index('explanation_zh') + 1 if 'explanation_zh' in fieldnames else len(fieldnames)
            fieldnames.insert(insert_at, 'explanation_ja')
        rows = []
        for row in reader:
            row['explanation_ja'] = build_explanation(row)
            rows.append(row)

    with CSV_PATH.open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main():
    sqlite_count = update_sqlite()
    csv_count = update_csv()
    print(f'Updated SQLite explanations: {sqlite_count}')
    print(f'Updated CSV explanations: {csv_count}')


if __name__ == '__main__':
    main()
