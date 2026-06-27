#!/usr/bin/env python3
"""
Migrate Eigo Quest grammar content from local SQLite to Render PostgreSQL.

Default mode is a dry-run. It reads the local SQLite source and the PostgreSQL
target, prints counts and planned changes, and does not write to PostgreSQL.

Apply mode:
  python scripts/migrate_grammar_sqlite_to_render.py --apply

Required environment:
  DATABASE_URL  PostgreSQL URL for the Render database.

Optional:
  SOURCE_SQLITE_PATH  Defaults to ./eigo_quest_local_v1.sqlite
"""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:  # pragma: no cover - environment guard
    psycopg2 = None
    execute_values = None


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = ROOT_DIR / "eigo_quest_local_v1.sqlite"
CONTENT_TABLES = [
    "grammar_points",
    "grammar_lessons",
    "grammar_quizzes",
    "grammar_form_test_items",
]
REQUIRED_TARGET_TABLES = {
    "grammar_points",
    "grammar_lessons",
    "grammar_quizzes",
}
OPTIONAL_TARGET_TABLES = {
    "grammar_form_test_items",
    "child_grammar_progress",
    "child_grammar_quiz_attempts",
    "grammar_lesson_rewards",
}
BACKUP_TABLES = CONTENT_TABLES + ["child_grammar_progress"]
PRIMARY_KEYS = {
    "grammar_points": ("id",),
    "grammar_lessons": ("lesson_id",),
    "grammar_quizzes": ("quiz_id",),
    "grammar_form_test_items": ("test_id",),
}
TARGET_LEVELS = ("eiken3", "eiken_pre2")


@dataclass(frozen=True)
class TableRows:
    table: str
    rows: list[dict[str, Any]]


def quote_ident(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def qname(name: str) -> str:
    return quote_ident(name)


def sqlite_readonly_uri(path: Path) -> str:
    normalized = str(path.resolve()).replace("\\", "/")
    return "file:" + quote(normalized, safe="/:") + "?mode=ro"


def connect_sqlite(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(sqlite_readonly_uri(path), uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def connect_postgres(database_url: str):
    if psycopg2 is None:
        raise RuntimeError("psycopg2-binary is required to connect to PostgreSQL.")
    return psycopg2.connect(database_url)


def parse_target(database_url: str) -> tuple[str, str, str]:
    parsed = urlparse(database_url)
    return (
        parsed.hostname or "(unknown)",
        parsed.path.lstrip("/") or "(unknown)",
        parsed.username or "(unknown)",
    )


def print_target(database_url: str) -> None:
    host, dbname, user = parse_target(database_url)
    print("Target PostgreSQL:")
    print(f"  host: {host}")
    print(f"  dbname: {dbname}")
    print(f"  user: {user}")
    print("  password: (hidden)")


def table_exists_sqlite(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def table_exists_postgres(cur, table: str) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = %s
        )
        """,
        (table,),
    )
    return bool(cur.fetchone()[0])


def sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row["name"] for row in conn.execute(f"PRAGMA table_info({qname(table)})").fetchall()]


def postgres_columns(cur, table: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [row[0] for row in cur.fetchall()]


def postgres_required_columns_without_default(cur, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND is_nullable = 'NO'
          AND column_default IS NULL
        """,
        (table,),
    )
    return {row[0] for row in cur.fetchall()}


def rows_from_query(conn: sqlite3.Connection, table: str, sql: str, params: tuple[Any, ...] = ()) -> TableRows:
    rows = [dict(row) for row in conn.execute(sql, params).fetchall()]
    return TableRows(table=table, rows=rows)


def load_source_rows(conn: sqlite3.Connection) -> dict[str, TableRows]:
    missing = [table for table in CONTENT_TABLES if not table_exists_sqlite(conn, table)]
    if missing:
        raise RuntimeError(f"Missing source SQLite tables: {', '.join(missing)}")

    lesson_ids = [
        row["lesson_id"]
        for row in conn.execute(
            """
            SELECT lesson_id
            FROM grammar_lessons
            WHERE level IN ('eiken3', 'eiken_pre2')
              AND lesson_id LIKE 'GR-%'
            ORDER BY display_order, lesson_id
            """
        ).fetchall()
    ]
    if not lesson_ids:
        raise RuntimeError("No GR-* eiken3/eiken_pre2 grammar lessons found in SQLite source.")

    placeholders = ", ".join("?" for _ in lesson_ids)
    rows = {
        "grammar_points": rows_from_query(
            conn,
            "grammar_points",
            """
            SELECT *
            FROM grammar_points
            WHERE level IN ('eiken3', 'eiken_pre2')
              AND (id BETWEEN 201 AND 227 OR id BETWEEN 301 AND 313)
            ORDER BY id
            """,
        ),
        "grammar_lessons": rows_from_query(
            conn,
            "grammar_lessons",
            """
            SELECT *
            FROM grammar_lessons
            WHERE level IN ('eiken3', 'eiken_pre2')
              AND lesson_id LIKE 'GR-%'
            ORDER BY display_order, lesson_id
            """,
        ),
        "grammar_quizzes": rows_from_query(
            conn,
            "grammar_quizzes",
            f"""
            SELECT *
            FROM grammar_quizzes
            WHERE lesson_id IN ({placeholders})
            ORDER BY lesson_id, quiz_id
            """,
            tuple(lesson_ids),
        ),
        "grammar_form_test_items": rows_from_query(
            conn,
            "grammar_form_test_items",
            f"""
            SELECT *
            FROM grammar_form_test_items
            WHERE lesson_id IN ({placeholders})
            ORDER BY lesson_id, test_id
            """,
            tuple(lesson_ids),
        ),
    }
    return rows


def old_to_new_lesson_id(old_id: str) -> str | None:
    if old_id.startswith("G-PREP2-") and old_id[8:].isdigit():
        index = int(old_id[8:])
        if 1 <= index <= 17:
            return f"GR-P2-CORE-{index:03d}"
    if old_id.startswith("G3-GRAMMAR-") and old_id[11:].isdigit():
        index = int(old_id[11:])
        if 1 <= index <= 13:
            return f"GR-E3-CORE-{index:03d}"

    explicit = {
        "G-PREP2-PATTERN-DOING": "GR-P2-PATTERN-001",
        "G-PREP2-PATTERN-DO": "GR-P2-PATTERN-002",
        "G-PREP2-PATTERN-TO-DO": "GR-P2-PATTERN-003",
        "G-PREP2-CONJ-01": "GR-P2-CONJ-001",
        "G-PREP2-CONJ-02": "GR-P2-CONJ-002",
        "G-PREP2-REL-01": "GR-P2-REL-001",
        "G-PREP2-REL-02": "GR-P2-REL-002",
        "G-PREP2-RELADV-01": "GR-P2-RELADV-001",
        "G-PREP2-WHCLAUSE-01": "GR-P2-WHCLAUSE-001",
        "G-PREP2-COMPOUND-01": "GR-P2-COMPOUND-001",
    }
    return explicit.get(old_id)


def grammar_id_for_new_lesson(lesson_id: str) -> int | None:
    if lesson_id.startswith("GR-P2-CORE-") and lesson_id[-3:].isdigit():
        index = int(lesson_id[-3:])
        if 1 <= index <= 17:
            return 200 + index
    if lesson_id == "GR-P2-PATTERN-001":
        return 218
    if lesson_id == "GR-P2-PATTERN-002":
        return 219
    if lesson_id == "GR-P2-PATTERN-003":
        return 220
    explicit = {
        "GR-P2-CONJ-001": 221,
        "GR-P2-CONJ-002": 222,
        "GR-P2-REL-001": 223,
        "GR-P2-REL-002": 224,
        "GR-P2-RELADV-001": 225,
        "GR-P2-WHCLAUSE-001": 226,
        "GR-P2-COMPOUND-001": 227,
    }
    if lesson_id in explicit:
        return explicit[lesson_id]
    if lesson_id.startswith("GR-E3-CORE-") and lesson_id[-3:].isdigit():
        index = int(lesson_id[-3:])
        if 1 <= index <= 13:
            return 300 + index
    return None


def old_to_new_quiz_id(old_id: str) -> str | None:
    match = re.fullmatch(r"Q-PREP2-(\d{3})-(\d{2,3})", old_id)
    if match:
        lesson_index = int(match.group(1))
        question_index = int(match.group(2))
        if 1 <= lesson_index <= 17:
            return f"GQ-P2-CORE-{lesson_index:03d}-{question_index:03d}"

    match = re.fullmatch(r"Q-G3-(\d{3})-(\d{2,3})", old_id)
    if match:
        lesson_index = int(match.group(1))
        question_index = int(match.group(2))
        if 1 <= lesson_index <= 13:
            return f"GQ-E3-CORE-{lesson_index:03d}-{question_index:03d}"

    match = re.fullmatch(r"Q-PREP2-PATTERN-(DOING|DO|TO-DO)-(\d{2,3})", old_id)
    if match:
        lesson_map = {
            "DOING": "001",
            "DO": "002",
            "TO-DO": "003",
        }
        return f"GQ-P2-PATTERN-{lesson_map[match.group(1)]}-{int(match.group(2)):03d}"

    match = re.fullmatch(r"Q-PREP2-(CONJ|REL)-(\d{2})-(\d{2,3})", old_id)
    if match:
        family = match.group(1)
        lesson_index = int(match.group(2))
        question_index = int(match.group(3))
        if family == "CONJ" and 1 <= lesson_index <= 2:
            return f"GQ-P2-CONJ-{lesson_index:03d}-{question_index:03d}"
        if family == "REL" and 1 <= lesson_index <= 2:
            return f"GQ-P2-REL-{lesson_index:03d}-{question_index:03d}"

    match = re.fullmatch(r"Q-PREP2-(RELADV|WHCLAUSE|COMPOUND)-01-(\d{2,3})", old_id)
    if match:
        family_map = {
            "RELADV": "RELADV",
            "WHCLAUSE": "WHCLAUSE",
            "COMPOUND": "COMPOUND",
        }
        return f"GQ-P2-{family_map[match.group(1)]}-001-{int(match.group(2)):03d}"

    return None


def scalar(cur, sql: str, params: tuple[Any, ...] | None = None) -> Any:
    if params is None:
        cur.execute(sql)
    else:
        cur.execute(sql, params)
    row = cur.fetchone()
    return row[0] if row else 0


def fetch_count(cur, sql: str, params: tuple[Any, ...] | None = None) -> int:
    return int(scalar(cur, sql, params) or 0)


def print_query_rows(cur, label: str, sql: str) -> None:
    print(f"\n{label}:")
    cur.execute(sql)
    rows = cur.fetchall()
    if not rows:
        print("  (no rows)")
        return
    for row in rows:
        print(" ", tuple(row))


def ensure_required_target_tables(cur) -> dict[str, bool]:
    tables = sorted(REQUIRED_TARGET_TABLES | OPTIONAL_TARGET_TABLES)
    existence = {}
    print("\nTarget table existence:")
    for table in tables:
        exists = table_exists_postgres(cur, table)
        existence[table] = exists
        if exists:
            print(f"  table exists: {table}")
        elif table in OPTIONAL_TARGET_TABLES:
            print(f"  table missing: {table}")
        else:
            print(f"  table missing: {table}")
            raise RuntimeError(f"Required PostgreSQL table missing: {table}")
    return existence


def run_count_check(
    cur,
    name: str,
    sql: str,
    required_tables: tuple[str, ...],
    table_existence: dict[str, bool],
) -> int | None:
    missing_tables = [table for table in required_tables if not table_existence.get(table, False)]
    if missing_tables:
        print(f"  {name}: skipped, table missing: {', '.join(missing_tables)}")
        return None
    try:
        value = fetch_count(cur, sql)
        print(f"  {name}: {value}")
        return value
    except Exception as exc:
        print(f"  check {name} failed: {exc}")
        try:
            cur.connection.rollback()
        except Exception:
            pass
        return None


def current_target_report(cur) -> dict[str, int]:
    table_existence = ensure_required_target_tables(cur)
    print_query_rows(
        cur,
        "Current Render grammar_lessons by level",
        """
        SELECT level, COUNT(*)
        FROM grammar_lessons
        GROUP BY level
        ORDER BY level
        """,
    )
    print_query_rows(
        cur,
        "Current Render grammar_points by level",
        """
        SELECT level, COUNT(*)
        FROM grammar_points
        GROUP BY level
        ORDER BY level
        """,
    )
    checks = {
        "old_lesson_id_count": (
            """
            SELECT COUNT(*)
            FROM grammar_lessons
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("grammar_lessons",),
        ),
        "old_quiz_id_count": (
            """
            SELECT COUNT(*)
            FROM grammar_quizzes
            WHERE quiz_id LIKE 'Q-PREP2-%'
               OR quiz_id LIKE 'Q-G3-%'
            """,
            ("grammar_quizzes",),
        ),
        "old_progress_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_progress
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("child_grammar_progress",),
        ),
        "old_reward_count": (
            """
            SELECT COUNT(*)
            FROM grammar_lesson_rewards
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("grammar_lesson_rewards",),
        ),
        "orphan_quiz_count": (
            """
            SELECT COUNT(*)
            FROM grammar_quizzes q
            LEFT JOIN grammar_lessons l ON l.lesson_id = q.lesson_id
            WHERE l.lesson_id IS NULL
            """,
            ("grammar_quizzes", "grammar_lessons"),
        ),
        "orphan_progress_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_progress p
            LEFT JOIN grammar_lessons l ON l.lesson_id = p.lesson_id
            WHERE l.lesson_id IS NULL
            """,
            ("child_grammar_progress", "grammar_lessons"),
        ),
        "grammar_points_join_missing_count": (
            """
            SELECT COUNT(*)
            FROM grammar_lessons l
            LEFT JOIN grammar_points gp ON gp.id = l.display_order
            WHERE l.level IN ('eiken3', 'eiken_pre2')
              AND gp.id IS NULL
            """,
            ("grammar_lessons", "grammar_points"),
        ),
        "old_quiz_attempt_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_quiz_attempts
            WHERE quiz_id LIKE 'Q-PREP2-%'
               OR quiz_id LIKE 'Q-G3-%'
            """,
            ("child_grammar_quiz_attempts",),
        ),
        "orphan_quiz_attempt_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_quiz_attempts a
            LEFT JOIN grammar_quizzes q ON q.quiz_id = a.quiz_id
            WHERE q.quiz_id IS NULL
            """,
            ("child_grammar_quiz_attempts", "grammar_quizzes"),
        ),
    }
    result = {}
    print("\nCurrent Render checks:")
    for name, (sql, required_tables) in checks.items():
        value = run_count_check(cur, name, sql, required_tables, table_existence)
        if value is not None:
            result[name] = value
    return result


def validate_source(sqlite_conn: sqlite3.Connection, source_rows: dict[str, TableRows]) -> bool:
    print("\nSQLite source checks:")
    integrity = sqlite_conn.execute("PRAGMA integrity_check").fetchone()[0]
    print(f"  integrity_check: {integrity}")
    for table, rows in source_rows.items():
        print(f"  {table}: {len(rows.rows)} rows selected")

    lesson_counts = sqlite_conn.execute(
        """
        SELECT level, COUNT(*)
        FROM grammar_lessons
        WHERE level IN ('eiken3', 'eiken_pre2')
          AND lesson_id LIKE 'GR-%'
        GROUP BY level
        ORDER BY level
        """
    ).fetchall()
    quiz_counts = sqlite_conn.execute(
        """
        SELECT l.level, COUNT(q.quiz_id)
        FROM grammar_quizzes q
        JOIN grammar_lessons l ON l.lesson_id = q.lesson_id
        WHERE l.level IN ('eiken3', 'eiken_pre2')
          AND l.lesson_id LIKE 'GR-%'
        GROUP BY l.level
        ORDER BY l.level
        """
    ).fetchall()
    print("  lessons by level:", [tuple(row) for row in lesson_counts])
    print("  quizzes by level:", [tuple(row) for row in quiz_counts])
    lesson_count_map = {row[0]: int(row[1] or 0) for row in lesson_counts}
    quiz_count_map = {row[0]: int(row[1] or 0) for row in quiz_counts}
    return (
        integrity == "ok"
        and lesson_count_map.get("eiken3") == 13
        and lesson_count_map.get("eiken_pre2") == 27
        and quiz_count_map.get("eiken3") == 65
        and quiz_count_map.get("eiken_pre2") == 171
        and len(source_rows["grammar_points"].rows) == 40
        and len(source_rows["grammar_lessons"].rows) == 40
        and len(source_rows["grammar_quizzes"].rows) == 236
    )


def validate_target_schema(cur, source_rows: dict[str, TableRows]) -> dict[str, list[str]]:
    print("\nTarget schema compatibility:")
    common_columns: dict[str, list[str]] = {}
    for table, table_rows in source_rows.items():
        if not table_exists_postgres(cur, table):
            if table in OPTIONAL_TARGET_TABLES:
                common_columns[table] = []
                print(f"  table missing: {table}")
                continue
            raise RuntimeError(f"Missing PostgreSQL table: {table}")
        if not table_rows.rows:
            common_columns[table] = []
            print(f"  {table}: source has 0 rows")
            continue
        source_cols = set(table_rows.rows[0])
        target_cols = postgres_columns(cur, table)
        target_col_set = set(target_cols)
        common = [column for column in target_cols if column in source_cols]
        required_missing = sorted(
            postgres_required_columns_without_default(cur, table) - set(common) - set(PRIMARY_KEYS.get(table, ()))
        )
        if required_missing:
            raise RuntimeError(
                f"{table}: PostgreSQL NOT NULL columns missing from SQLite source: {', '.join(required_missing)}"
            )
        if not common:
            raise RuntimeError(f"{table}: no common columns between source and target")
        ignored = sorted(source_cols - target_col_set)
        print(f"  {table}: common={len(common)} ignored_source_columns={ignored or 'none'}")
        common_columns[table] = common
    return common_columns


def create_backups(cur, suffix: str) -> list[str]:
    backup_names = []
    for table in BACKUP_TABLES:
        if not table_exists_postgres(cur, table):
            print(f"Backup skipped, table missing: {table}")
            continue
        backup_name = f"{table}_backup_{suffix}"
        cur.execute(f"CREATE TABLE {qname(backup_name)} AS SELECT * FROM {qname(table)}")
        backup_names.append(backup_name)
        print(f"Created backup: {backup_name}")
    return backup_names


def old_progress_rows(cur) -> list[tuple[int, str]]:
    if not table_exists_postgres(cur, "child_grammar_progress"):
        return []
    cur.execute(
        """
        SELECT child_id, lesson_id
        FROM child_grammar_progress
        WHERE lesson_id LIKE 'G-PREP2-%'
           OR lesson_id LIKE 'G3-GRAMMAR-%'
        ORDER BY child_id, lesson_id
        """
    )
    return [(int(row[0]), str(row[1])) for row in cur.fetchall()]


def old_progress_lesson_counts(cur) -> list[tuple[str, int]]:
    if not table_exists_postgres(cur, "child_grammar_progress"):
        return []
    cur.execute(
        """
        SELECT lesson_id, COUNT(*)
        FROM child_grammar_progress
        WHERE lesson_id LIKE 'G-PREP2-%'
           OR lesson_id LIKE 'G3-GRAMMAR-%'
        GROUP BY lesson_id
        ORDER BY lesson_id
        """
    )
    return [(str(row[0]), int(row[1] or 0)) for row in cur.fetchall()]


def print_old_progress_mapping_preview(cur) -> tuple[dict[str, str], list[str], int]:
    counts = old_progress_lesson_counts(cur)
    mapping: dict[str, str] = {}
    unmapped: list[str] = []
    print("\nOld progress lesson_id mapping preview:")
    if not table_exists_postgres(cur, "child_grammar_progress"):
        print("  table missing: child_grammar_progress")
        return mapping, unmapped, 0
    if not counts:
        print("  (no old progress lesson_id rows)")
        return mapping, unmapped, 0
    for old_id, count in counts:
        new_id = old_to_new_lesson_id(old_id)
        if new_id is None:
            unmapped.append(old_id)
            print(f"  unmapped old progress lesson_id: {old_id}, count={count}")
        else:
            mapping[old_id] = new_id
            print(f"  {old_id} -> {new_id}, count={count}")
    return mapping, unmapped, sum(count for _old_id, count in counts)


def analyze_progress_mapping(cur) -> tuple[dict[str, str], list[str], int]:
    if not table_exists_postgres(cur, "child_grammar_progress"):
        return {}, [], 0
    rows = old_progress_rows(cur)
    mapping = {}
    unmapped = []
    for _child_id, old_id in rows:
        new_id = old_to_new_lesson_id(old_id)
        if new_id is None:
            unmapped.append(old_id)
        else:
            mapping[old_id] = new_id

    collision_count = 0
    for child_id, old_id in rows:
        new_id = old_to_new_lesson_id(old_id)
        if not new_id:
            continue
        cur.execute(
            """
            SELECT COUNT(*)
            FROM child_grammar_progress
            WHERE child_id = %s AND lesson_id = %s
            """,
            (child_id, new_id),
        )
        collision_count += int(cur.fetchone()[0] or 0)
    return mapping, sorted(set(unmapped)), collision_count


def print_content_rows_to_replace(cur) -> dict[str, int | None]:
    print("\nContent rows to replace:")
    table_existence = {
        table: table_exists_postgres(cur, table)
        for table in REQUIRED_TARGET_TABLES | OPTIONAL_TARGET_TABLES
    }
    checks = {
        "grammar_points eiken3/eiken_pre2 count": (
            """
            SELECT COUNT(*)
            FROM grammar_points
            WHERE level IN ('eiken3', 'eiken_pre2')
               OR id BETWEEN 201 AND 227
               OR id BETWEEN 301 AND 313
            """,
            ("grammar_points",),
        ),
        "grammar_lessons old target count": (
            """
            SELECT COUNT(*)
            FROM grammar_lessons
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("grammar_lessons",),
        ),
        "grammar_lessons new target count": (
            """
            SELECT COUNT(*)
            FROM grammar_lessons
            WHERE lesson_id LIKE 'GR-P2-%'
               OR lesson_id LIKE 'GR-E3-%'
            """,
            ("grammar_lessons",),
        ),
        "grammar_quizzes old target count": (
            """
            SELECT COUNT(*)
            FROM grammar_quizzes
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
               OR quiz_id LIKE 'Q-PREP2-%'
               OR quiz_id LIKE 'Q-G3-%'
            """,
            ("grammar_quizzes",),
        ),
        "grammar_quizzes new target count": (
            """
            SELECT COUNT(*)
            FROM grammar_quizzes
            WHERE lesson_id LIKE 'GR-P2-%'
               OR lesson_id LIKE 'GR-E3-%'
               OR quiz_id LIKE 'GQ-P2-%'
               OR quiz_id LIKE 'GQ-E3-%'
            """,
            ("grammar_quizzes",),
        ),
        "grammar_form_test_items old target count": (
            """
            SELECT COUNT(*)
            FROM grammar_form_test_items
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("grammar_form_test_items",),
        ),
        "grammar_form_test_items new target count": (
            """
            SELECT COUNT(*)
            FROM grammar_form_test_items
            WHERE lesson_id LIKE 'GR-P2-%'
               OR lesson_id LIKE 'GR-E3-%'
               OR test_id LIKE 'GFT-%'
            """,
            ("grammar_form_test_items",),
        ),
    }
    results: dict[str, int | None] = {}
    for name, (sql, required_tables) in checks.items():
        value = run_count_check(cur, name, sql, required_tables, table_existence)
        results[name] = value
    return results


def old_quiz_attempt_count(cur) -> int | None:
    if not table_exists_postgres(cur, "child_grammar_quiz_attempts"):
        return None
    return fetch_count(
        cur,
        """
        SELECT COUNT(*)
        FROM child_grammar_quiz_attempts
        WHERE quiz_id LIKE 'Q-PREP2-%'
           OR quiz_id LIKE 'Q-G3-%'
        """,
    )


def old_quiz_attempt_counts(cur) -> list[tuple[str, int]]:
    if not table_exists_postgres(cur, "child_grammar_quiz_attempts"):
        return []
    cur.execute(
        """
        SELECT quiz_id, COUNT(*)
        FROM child_grammar_quiz_attempts
        WHERE quiz_id LIKE 'Q-PREP2-%'
           OR quiz_id LIKE 'Q-G3-%'
        GROUP BY quiz_id
        ORDER BY quiz_id
        """
    )
    return [(str(row[0]), int(row[1] or 0)) for row in cur.fetchall()]


def analyze_quiz_attempt_mapping(cur, source_rows: dict[str, TableRows]) -> dict[str, Any]:
    counts = old_quiz_attempt_counts(cur)
    source_quiz_ids = {str(row["quiz_id"]) for row in source_rows["grammar_quizzes"].rows}
    mapped: dict[str, str] = {}
    unmapped: list[str] = []
    missing_source: list[str] = []
    for old_id, _count in counts:
        new_id = old_to_new_quiz_id(old_id)
        if new_id is None:
            unmapped.append(old_id)
            continue
        mapped[old_id] = new_id
        if new_id not in source_quiz_ids:
            missing_source.append(new_id)

    collision_count = 0
    if mapped:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM child_grammar_quiz_attempts
            WHERE quiz_id = ANY(%s)
            """,
            (sorted(set(mapped.values())),),
        )
        collision_count = int(cur.fetchone()[0] or 0)

    return {
        "counts": counts,
        "mapped": mapped,
        "unmapped": sorted(set(unmapped)),
        "missing_source": sorted(set(missing_source)),
        "collision_count": collision_count,
        "row_count": sum(count for _old_id, count in counts),
    }


def print_old_quiz_attempt_mapping_preview(cur, source_rows: dict[str, TableRows]) -> dict[str, Any]:
    print("\nOld quiz attempt mapping preview:")
    if not table_exists_postgres(cur, "child_grammar_quiz_attempts"):
        print("  table missing: child_grammar_quiz_attempts")
        return {
            "counts": [],
            "mapped": {},
            "unmapped": [],
            "missing_source": [],
            "collision_count": 0,
            "row_count": 0,
        }
    analysis = analyze_quiz_attempt_mapping(cur, source_rows)
    if not analysis["counts"]:
        print("  (no old quiz_id attempt rows)")
    for old_id, count in analysis["counts"]:
        new_id = analysis["mapped"].get(old_id)
        if new_id:
            print(f"  {old_id} -> {new_id}, count={count}")
        else:
            print(f"  unmapped old quiz_id: {old_id}, count={count}")
    print("\nchild_grammar_quiz_attempts mapping check:")
    print(f"  old quiz attempt rows count: {analysis['row_count']}")
    print(f"  old quiz attempt distinct quiz_id count: {len(analysis['counts'])}")
    print(f"  mapped quiz ids count: {len(analysis['mapped'])}")
    print(f"  unmapped quiz ids: {analysis['unmapped'] or 'none'}")
    print(f"  mapped quiz ids missing from SQLite source: {analysis['missing_source'] or 'none'}")
    print(f"  mapping collisions count: {analysis['collision_count']}")
    return analysis


def old_lesson_reference_count(cur, table: str, column: str = "lesson_id") -> int | None:
    if not table_exists_postgres(cur, table):
        return None
    return fetch_count(
        cur,
        f"""
        SELECT COUNT(*)
        FROM {qname(table)}
        WHERE {qname(column)} LIKE 'G-PREP2-%'
           OR {qname(column)} LIKE 'G3-GRAMMAR-%'
        """,
    )


def old_quiz_reference_count(cur, table: str, column: str = "quiz_id") -> int | None:
    if not table_exists_postgres(cur, table):
        return None
    return fetch_count(
        cur,
        f"""
        SELECT COUNT(*)
        FROM {qname(table)}
        WHERE {qname(column)} LIKE 'Q-PREP2-%'
           OR {qname(column)} LIKE 'Q-G3-%'
        """,
    )


def old_reward_lesson_counts(cur) -> list[tuple[str, int]]:
    if not table_exists_postgres(cur, "grammar_lesson_rewards"):
        return []
    cur.execute(
        """
        SELECT lesson_id, COUNT(*)
        FROM grammar_lesson_rewards
        WHERE lesson_id LIKE 'G-PREP2-%'
           OR lesson_id LIKE 'G3-GRAMMAR-%'
        GROUP BY lesson_id
        ORDER BY lesson_id
        """
    )
    return [(str(row[0]), int(row[1] or 0)) for row in cur.fetchall()]


def analyze_reward_mapping(cur) -> dict[str, Any]:
    counts = old_reward_lesson_counts(cur)
    mapped: dict[str, str] = {}
    unmapped: list[str] = []
    for old_id, _count in counts:
        new_id = old_to_new_lesson_id(old_id)
        if new_id is None:
            unmapped.append(old_id)
        else:
            mapped[old_id] = new_id

    collision_count = 0
    if mapped:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM grammar_lesson_rewards
            WHERE lesson_id = ANY(%s)
            """,
            (sorted(set(mapped.values())),),
        )
        collision_count = int(cur.fetchone()[0] or 0)

    return {
        "counts": counts,
        "mapped": mapped,
        "unmapped": sorted(set(unmapped)),
        "collision_count": collision_count,
        "row_count": sum(count for _old_id, count in counts),
    }


def print_old_reward_mapping_preview(cur) -> dict[str, Any]:
    print("\nOld grammar_lesson_rewards mapping preview:")
    if not table_exists_postgres(cur, "grammar_lesson_rewards"):
        print("  table missing: grammar_lesson_rewards")
        return {
            "counts": [],
            "mapped": {},
            "unmapped": [],
            "collision_count": 0,
            "row_count": 0,
        }
    analysis = analyze_reward_mapping(cur)
    if not analysis["counts"]:
        print("  (no old grammar_lesson_rewards lesson_id rows)")
    for old_id, count in analysis["counts"]:
        new_id = analysis["mapped"].get(old_id)
        if new_id:
            print(f"  {old_id} -> {new_id}, count={count}")
        else:
            print(f"  unmapped old reward lesson_id: {old_id}, count={count}")
    print("\ngrammar_lesson_rewards mapping check:")
    print(f"  old reward rows count: {analysis['row_count']}")
    print(f"  old reward distinct lesson_id count: {len(analysis['counts'])}")
    print(f"  mapped reward lesson ids count: {len(analysis['mapped'])}")
    print(f"  unmapped reward lesson ids: {analysis['unmapped'] or 'none'}")
    print(f"  mapping collisions count: {analysis['collision_count']}")
    return analysis


def fk_references_to(cur, foreign_table: str, foreign_column: str) -> list[tuple[str, str, str, str]]:
    cur.execute(
        """
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = %s
          AND ccu.column_name = %s
        ORDER BY tc.table_name, kcu.column_name
        """,
        (foreign_table, foreign_column),
    )
    return [(str(row[0]), str(row[1]), str(row[2]), str(row[3])) for row in cur.fetchall()]


def print_fk_reference_check(cur) -> dict[str, Any]:
    print("\nFK references to grammar_lessons.lesson_id:")
    lesson_refs = fk_references_to(cur, "grammar_lessons", "lesson_id")
    if not lesson_refs:
        print("  (no FK references found)")
    else:
        for table, column, foreign_table, foreign_column in lesson_refs:
            print(f"  {table}.{column} -> {foreign_table}.{foreign_column}")

    print("\nFK references to grammar_quizzes.quiz_id:")
    quiz_refs = fk_references_to(cur, "grammar_quizzes", "quiz_id")
    if not quiz_refs:
        print("  (no FK references found)")
    else:
        for table, column, foreign_table, foreign_column in quiz_refs:
            print(f"  {table}.{column} -> {foreign_table}.{foreign_column}")

    handled_lesson_refs = {
        ("child_grammar_progress", "lesson_id"),
        ("grammar_lesson_rewards", "lesson_id"),
        ("grammar_quizzes", "lesson_id"),
        ("grammar_form_test_items", "lesson_id"),
    }
    handled_quiz_refs = {
        ("child_grammar_quiz_attempts", "quiz_id"),
    }
    issues: list[str] = []

    print("\nFK old lesson_id reference check:")
    for table, column, _foreign_table, _foreign_column in lesson_refs:
        count = old_lesson_reference_count(cur, table, column)
        print(f"  {table}.{column}: old lesson_id rows={count}")
        if count and (table, column) not in handled_lesson_refs:
            issues.append(f"{table}.{column} has {count} old lesson_id rows")

    print("\nFK old quiz_id reference check:")
    for table, column, _foreign_table, _foreign_column in quiz_refs:
        count = old_quiz_reference_count(cur, table, column)
        print(f"  {table}.{column}: old quiz_id rows={count}")
        if count and (table, column) not in handled_quiz_refs:
            issues.append(f"{table}.{column} has {count} old quiz_id rows")

    if issues:
        print("  FK reference issues:")
        for issue in issues:
            print(f"    {issue}")
    else:
        print("  FK reference issues: none")
    return {
        "lesson_refs": lesson_refs,
        "quiz_refs": quiz_refs,
        "issues": issues,
    }


def print_preflight_result(
    *,
    old_progress_mapping_ok: bool,
    old_rewards_mapping_ok: bool,
    required_tables_ok: bool,
    source_ok: bool,
    old_quiz_attempts_ok: bool,
    fk_references_ok: bool,
) -> bool:
    safe_to_apply = (
        old_progress_mapping_ok
        and old_rewards_mapping_ok
        and required_tables_ok
        and source_ok
        and old_quiz_attempts_ok
        and fk_references_ok
    )
    print("\nPreflight result:")
    print(f"- old progress mapping: {'OK' if old_progress_mapping_ok else 'NG'}")
    print(f"- old rewards mapping: {'OK' if old_rewards_mapping_ok else 'NG'}")
    print(f"- required tables: {'OK' if required_tables_ok else 'NG'}")
    print(f"- source SQLite data: {'OK' if source_ok else 'NG'}")
    print(f"- old quiz attempts: {'OK' if old_quiz_attempts_ok else 'NG'}")
    print(f"- FK references: {'OK' if fk_references_ok else 'NG'}")
    print(f"- safe_to_apply: {'YES' if safe_to_apply else 'NO'}")
    return safe_to_apply


def apply_progress_mapping(cur) -> int:
    mapping, unmapped, collisions = analyze_progress_mapping(cur)
    if unmapped:
        raise RuntimeError(f"Unmapped child_grammar_progress lesson_id values: {', '.join(unmapped)}")
    if collisions:
        raise RuntimeError(
            "Mapping child_grammar_progress would collide with existing new lesson_id rows. "
            f"Collision count: {collisions}"
        )
    updated = 0
    for old_id, new_id in mapping.items():
        grammar_id = grammar_id_for_new_lesson(new_id)
        if grammar_id is None:
            raise RuntimeError(f"No grammar_id mapping for {new_id}")
        cur.execute(
            """
            UPDATE child_grammar_progress
            SET lesson_id = %s,
                grammar_id = %s
            WHERE lesson_id = %s
            """,
            (new_id, grammar_id, old_id),
        )
        updated += cur.rowcount
    return updated


def apply_reward_mapping(cur) -> int:
    if not table_exists_postgres(cur, "grammar_lesson_rewards"):
        print("grammar_lesson_rewards missing; lesson_id mapping skipped.")
        return 0
    analysis = analyze_reward_mapping(cur)
    if analysis["unmapped"]:
        raise RuntimeError(f"Unmapped grammar_lesson_rewards lesson_id values: {', '.join(analysis['unmapped'])}")
    if analysis["collision_count"]:
        raise RuntimeError(
            "Mapping grammar_lesson_rewards would collide with existing new lesson_id rows. "
            f"Collision count: {analysis['collision_count']}"
        )
    updated = 0
    for old_id, new_id in analysis["mapped"].items():
        cur.execute(
            """
            UPDATE grammar_lesson_rewards
            SET lesson_id = %s
            WHERE lesson_id = %s
            """,
            (new_id, old_id),
        )
        updated += cur.rowcount
    return updated


def apply_quiz_attempt_mapping(cur, source_rows: dict[str, TableRows]) -> int:
    if not table_exists_postgres(cur, "child_grammar_quiz_attempts"):
        print("child_grammar_quiz_attempts missing; quiz_id mapping skipped.")
        return 0
    analysis = analyze_quiz_attempt_mapping(cur, source_rows)
    if analysis["unmapped"]:
        raise RuntimeError(f"Unmapped child_grammar_quiz_attempts quiz_id values: {', '.join(analysis['unmapped'])}")
    if analysis["missing_source"]:
        raise RuntimeError(
            "Mapped child_grammar_quiz_attempts quiz_id values are missing from SQLite source: "
            + ", ".join(analysis["missing_source"])
        )
    if analysis["collision_count"]:
        raise RuntimeError(
            "Mapping child_grammar_quiz_attempts would collide with existing new quiz_id rows. "
            f"Collision count: {analysis['collision_count']}"
        )
    updated = 0
    for old_id, new_id in analysis["mapped"].items():
        cur.execute(
            """
            UPDATE child_grammar_quiz_attempts
            SET quiz_id = %s
            WHERE quiz_id = %s
            """,
            (new_id, old_id),
        )
        updated += cur.rowcount
    return updated


def delete_old_content(cur, source_rows: dict[str, TableRows]) -> None:
    remaining_old_attempts = old_quiz_attempt_count(cur)
    if remaining_old_attempts not in (None, 0):
        raise RuntimeError(
            "Old child_grammar_quiz_attempts still reference old quiz_id values; refusing to delete old grammar_quizzes. "
            f"Remaining rows: {remaining_old_attempts}"
        )
    remaining_old_rewards = old_lesson_reference_count(cur, "grammar_lesson_rewards")
    if remaining_old_rewards not in (None, 0):
        raise RuntimeError(
            "Old grammar_lesson_rewards still reference old lesson_id values; refusing to delete old grammar_lessons. "
            f"Remaining rows: {remaining_old_rewards}"
        )
    delete_statements = []
    if table_exists_postgres(cur, "grammar_form_test_items"):
        delete_statements.append(
            """
            DELETE FROM grammar_form_test_items
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """
        )
    else:
        print("Delete skipped, table missing: grammar_form_test_items")

    delete_statements.extend(
        [
        """
        DELETE FROM grammar_quizzes
        WHERE lesson_id LIKE 'G-PREP2-%'
           OR lesson_id LIKE 'G3-GRAMMAR-%'
           OR quiz_id LIKE 'Q-PREP2-%'
           OR quiz_id LIKE 'Q-G3-%'
        """,
        """
        DELETE FROM grammar_lessons
        WHERE lesson_id LIKE 'G-PREP2-%'
           OR lesson_id LIKE 'G3-GRAMMAR-%'
        """,
        ]
    )
    for sql in delete_statements:
        cur.execute(sql)
        print(f"Deleted rows: {cur.rowcount}")

    source_point_ids = sorted(
        int(row["id"])
        for row in source_rows["grammar_points"].rows
        if row.get("id") is not None
    )
    if not source_point_ids:
        raise RuntimeError("No source grammar_points ids available; refusing to delete old grammar_points.")
    cur.execute(
        """
        DELETE FROM grammar_points
        WHERE level IN ('eiken3', 'eiken_pre2')
          AND NOT (id = ANY(%s))
        """,
        (source_point_ids,),
    )
    print(f"Deleted old grammar_points rows outside source ids: {cur.rowcount}")


def upsert_rows(cur, table_rows: TableRows, columns: list[str]) -> int:
    if not table_rows.rows:
        return 0
    if not columns:
        print(f"Upsert skipped, table missing or no common columns: {table_rows.table}")
        return 0
    if execute_values is None:
        raise RuntimeError("psycopg2.extras.execute_values is unavailable.")

    table = table_rows.table
    pk = PRIMARY_KEYS[table]
    missing_pk = [column for column in pk if column not in columns]
    if missing_pk:
        raise RuntimeError(f"{table}: missing primary key columns for upsert: {', '.join(missing_pk)}")

    values = [tuple(row.get(column) for column in columns) for row in table_rows.rows]
    column_sql = ", ".join(qname(column) for column in columns)
    conflict_sql = ", ".join(qname(column) for column in pk)
    update_columns = [column for column in columns if column not in pk]
    if update_columns:
        update_sql = ", ".join(f"{qname(column)} = EXCLUDED.{qname(column)}" for column in update_columns)
        suffix = f"ON CONFLICT ({conflict_sql}) DO UPDATE SET {update_sql}"
    else:
        suffix = f"ON CONFLICT ({conflict_sql}) DO NOTHING"
    sql = f"INSERT INTO {qname(table)} ({column_sql}) VALUES %s {suffix}"
    execute_values(cur, sql, values, page_size=500)
    return len(values)


def apply_table(cur, table: str, source_rows: dict[str, TableRows], common_columns: dict[str, list[str]]) -> int:
    count = upsert_rows(cur, source_rows[table], common_columns[table])
    print(f"Upserted {table}: {count}")
    return count


def final_validations(cur) -> dict[str, int]:
    print("\nFinal validation queries:")
    table_existence = ensure_required_target_tables(cur)
    print_query_rows(
        cur,
        "grammar_lessons by level",
        """
        SELECT level, COUNT(*)
        FROM grammar_lessons
        GROUP BY level
        ORDER BY level
        """,
    )
    print_query_rows(
        cur,
        "grammar_quizzes by lesson level",
        """
        SELECT l.level, COUNT(q.quiz_id)
        FROM grammar_quizzes q
        JOIN grammar_lessons l ON l.lesson_id = q.lesson_id
        GROUP BY l.level
        ORDER BY l.level
        """,
    )
    checks = {
        "old_lesson_id_count": (
            """
            SELECT COUNT(*)
            FROM grammar_lessons
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("grammar_lessons",),
        ),
        "old_quiz_id_count": (
            """
            SELECT COUNT(*)
            FROM grammar_quizzes
            WHERE quiz_id LIKE 'Q-PREP2-%'
               OR quiz_id LIKE 'Q-G3-%'
            """,
            ("grammar_quizzes",),
        ),
        "old_reward_count": (
            """
            SELECT COUNT(*)
            FROM grammar_lesson_rewards
            WHERE lesson_id LIKE 'G-PREP2-%'
               OR lesson_id LIKE 'G3-GRAMMAR-%'
            """,
            ("grammar_lesson_rewards",),
        ),
        "orphan_quiz_count": (
            """
            SELECT COUNT(*)
            FROM grammar_quizzes q
            LEFT JOIN grammar_lessons l ON l.lesson_id = q.lesson_id
            WHERE l.lesson_id IS NULL
            """,
            ("grammar_quizzes", "grammar_lessons"),
        ),
        "orphan_progress_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_progress p
            LEFT JOIN grammar_lessons l ON l.lesson_id = p.lesson_id
            WHERE l.lesson_id IS NULL
            """,
            ("child_grammar_progress", "grammar_lessons"),
        ),
        "grammar_points_join_missing_count": (
            """
            SELECT COUNT(*)
            FROM grammar_lessons l
            LEFT JOIN grammar_points gp ON gp.id = l.display_order
            WHERE l.level IN ('eiken3', 'eiken_pre2')
              AND gp.id IS NULL
            """,
            ("grammar_lessons", "grammar_points"),
        ),
        "old_quiz_attempt_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_quiz_attempts
            WHERE quiz_id LIKE 'Q-PREP2-%'
               OR quiz_id LIKE 'Q-G3-%'
            """,
            ("child_grammar_quiz_attempts",),
        ),
        "orphan_quiz_attempt_count": (
            """
            SELECT COUNT(*)
            FROM child_grammar_quiz_attempts a
            LEFT JOIN grammar_quizzes q ON q.quiz_id = a.quiz_id
            WHERE q.quiz_id IS NULL
            """,
            ("child_grammar_quiz_attempts", "grammar_quizzes"),
        ),
    }
    results = {}
    for name, (sql, required_tables) in checks.items():
        value = run_count_check(cur, name, sql, required_tables, table_existence)
        if value is not None:
            results[name] = value
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate grammar SQLite rows to Render PostgreSQL.")
    parser.add_argument("--apply", action="store_true", help="Write changes to PostgreSQL. Default is dry-run.")
    parser.add_argument(
        "--source",
        default=os.getenv("SOURCE_SQLITE_PATH", str(DEFAULT_SQLITE_PATH)),
        help="Path to local SQLite source database.",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not source_path.exists():
        print(f"SQLite source not found: {source_path}", file=sys.stderr)
        return 1
    if not database_url:
        print("DATABASE_URL is required. It is read from the environment only.", file=sys.stderr)
        return 1

    mode = "apply" if args.apply else "dry-run"
    print(f"Mode: {mode}")
    print(f"SQLite source: {source_path.resolve()}")
    print_target(database_url)

    sqlite_conn = connect_sqlite(source_path)
    pg_conn = connect_postgres(database_url)
    pg_conn.autocommit = False
    try:
        source_rows = load_source_rows(sqlite_conn)
        source_ok = validate_source(sqlite_conn, source_rows)

        with pg_conn.cursor() as cur:
            required_tables_ok = True
            try:
                current_target_report(cur)
            except Exception as exc:
                required_tables_ok = False
                print(f"\nRequired target table check failed: {exc}")
                raise
            common_columns = validate_target_schema(cur, source_rows)
            preview_mapping, preview_unmapped, preview_total = print_old_progress_mapping_preview(cur)
            mapping, unmapped, collisions = analyze_progress_mapping(cur)
            print("\nchild_grammar_progress mapping check:")
            print(f"  old progress rows to map: {sum(1 for _ in old_progress_rows(cur))}")
            print(f"  old progress rows previewed: {preview_total}")
            print(f"  mapped lesson ids: {len(mapping)}")
            print(f"  unmapped lesson ids: {unmapped or 'none'}")
            print(f"  mapping collisions: {collisions}")
            reward_analysis = print_old_reward_mapping_preview(cur)
            print_content_rows_to_replace(cur)
            quiz_attempt_analysis = print_old_quiz_attempt_mapping_preview(cur, source_rows)
            fk_reference_analysis = print_fk_reference_check(cur)

            print("\nPlanned source row counts:")
            for table in CONTENT_TABLES:
                print(f"  {table}: {len(source_rows[table].rows)}")

            old_progress_mapping_ok = not preview_unmapped and not unmapped and collisions == 0
            old_rewards_mapping_ok = (
                not reward_analysis["unmapped"]
                and reward_analysis["collision_count"] == 0
            )
            old_quiz_attempts_ok = (
                not quiz_attempt_analysis["unmapped"]
                and not quiz_attempt_analysis["missing_source"]
                and quiz_attempt_analysis["collision_count"] == 0
            )
            fk_references_ok = not fk_reference_analysis["issues"]
            safe_to_apply = print_preflight_result(
                old_progress_mapping_ok=old_progress_mapping_ok,
                old_rewards_mapping_ok=old_rewards_mapping_ok,
                required_tables_ok=required_tables_ok,
                source_ok=source_ok,
                old_quiz_attempts_ok=old_quiz_attempts_ok,
                fk_references_ok=fk_references_ok,
            )

            if not args.apply:
                pg_conn.rollback()
                print("\nDry-run complete. No PostgreSQL changes were written.")
                return 0

            if not safe_to_apply:
                raise RuntimeError("Preflight failed; refusing to apply migration.")

            suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
            backups = create_backups(cur, suffix)
            pg_conn.commit()
            print("Backup transaction committed.")

            inserted = {}
            inserted["grammar_points"] = apply_table(cur, "grammar_points", source_rows, common_columns)
            inserted["grammar_lessons"] = apply_table(cur, "grammar_lessons", source_rows, common_columns)
            mapped_progress = apply_progress_mapping(cur)
            print(f"Mapped child_grammar_progress rows: {mapped_progress}")
            mapped_rewards = apply_reward_mapping(cur)
            print(f"grammar_lesson_rewards mapped rows: {mapped_rewards}")
            inserted["grammar_quizzes"] = apply_table(cur, "grammar_quizzes", source_rows, common_columns)
            mapped_attempts = apply_quiz_attempt_mapping(cur, source_rows)
            print(f"child_grammar_quiz_attempts quiz_id mapped rows: {mapped_attempts}")
            inserted["grammar_form_test_items"] = apply_table(cur, "grammar_form_test_items", source_rows, common_columns)
            delete_old_content(cur, source_rows)
            validations = final_validations(cur)
            pg_conn.commit()

            print("\nApply complete.")
            print("Backup tables:")
            for backup in backups:
                print(f"  {backup}")
            print("Migrated rows:")
            for table, count in inserted.items():
                print(f"  {table}: {count}")
            print("Validation summary:")
            for name, value in validations.items():
                print(f"  {name}: {value}")
            return 0
    except Exception as exc:
        pg_conn.rollback()
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1
    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
