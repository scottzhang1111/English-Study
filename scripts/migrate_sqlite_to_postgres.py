import os
import sqlite3
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values


ROOT_DIR = Path(__file__).resolve().parent.parent
SQLITE_PATH = Path(os.getenv("SQLITE_PATH", ROOT_DIR / "practice_data.db"))
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

TABLES = [
    "vocabulary",
    "error_log",
    "pokemon_catalog",
    "pets_catalog",
    "children",
    "child_pets",
    "child_pokemon_collection",
    "child_vocab_progress",
    "ai_questions",
    "ai_wrong_answers",
    "ai_study_records",
    "daily_study_log",
    "grammar_questions",
    "wild_monsters",
    "user_monsters",
    "battle_sessions",
    "battle_answer_results",
    "grammar_wrong_questions",
    "child_grammar_progress",
    "child_grammar_quiz_attempts",
    "child_grammar_form_test_progress",
    "child_grammar_form_test_attempts",
    "eiken_pre2_attempts",
    "eiken_pre2_student_answers",
]


def quote_ident(name):
    return '"' + name.replace('"', '""') + '"'


def sqlite_table_exists(conn, table):
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def postgres_table_exists(conn, table):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = %s",
            (table,),
        )
        return cur.fetchone() is not None


def get_sqlite_columns(conn, table):
    return [row[1] for row in conn.execute(f"PRAGMA table_info({quote_ident(table)})").fetchall()]


def reset_identity_sequences(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_default LIKE 'nextval(%'
            """
        )
        sequence_columns = cur.fetchall()
        for table, column in sequence_columns:
            cur.execute(
                f"""
                SELECT setval(
                    pg_get_serial_sequence(%s, %s),
                    COALESCE((SELECT MAX({quote_ident(column)}) FROM {quote_ident(table)}), 1),
                    true
                )
                """,
                (table, column),
            )
    conn.commit()


def main():
    if not DATABASE_URL:
        print("DATABASE_URL is required.", file=sys.stderr)
        return 1
    if not SQLITE_PATH.exists():
        print(f"SQLite database not found: {SQLITE_PATH}", file=sys.stderr)
        return 1

    sys.path.insert(0, str(ROOT_DIR))
    import app

    app.init_db()

    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    pg_conn = psycopg2.connect(DATABASE_URL)

    try:
        for table in TABLES:
            if not sqlite_table_exists(sqlite_conn, table) or not postgres_table_exists(pg_conn, table):
                continue
            columns = get_sqlite_columns(sqlite_conn, table)
            if not columns:
                continue
            rows = sqlite_conn.execute(f"SELECT * FROM {quote_ident(table)}").fetchall()
            if not rows:
                print(f"{table}: 0 rows")
                continue

            column_sql = ", ".join(quote_ident(column) for column in columns)
            insert_sql = (
                f"INSERT INTO {quote_ident(table)} ({column_sql}) VALUES %s "
                "ON CONFLICT DO NOTHING"
            )
            values = [tuple(row[column] for column in columns) for row in rows]
            with pg_conn.cursor() as cur:
                execute_values(cur, insert_sql, values, page_size=500)
            pg_conn.commit()
            print(f"{table}: copied {len(rows)} rows")

        reset_identity_sequences(pg_conn)
    finally:
        sqlite_conn.close()
        pg_conn.close()

    print("Migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
