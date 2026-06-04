#!/usr/bin/env python3
"""
One-time importer from a local Eigo Quest SQLite database to a new Render PostgreSQL database.

Required environment variables:
  SOURCE_SQLITE_PATH      Path to the local SQLite file.
  TARGET_DATABASE_URL    Render PostgreSQL External Database URL.

This script intentionally does not import app.py and does not run Flask startup code.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import psycopg2
from psycopg2.extras import execute_values


CONFIRMATION_TEXT = "IMPORT_TO_NEW_RENDER_DB"
SYSTEM_TABLES = {"sqlite_sequence"}
LEGACY_FK_SKIP_PAIRS = {
    ("child_pets", "pets_catalog"),
    ("child_pokemon_collection", "pokemon_catalog"),
}
LEGACY_PETS_POKEMON_TABLES = {
    "child_pets",
    "pets_catalog",
    "child_pokemon_collection",
    "pokemon_catalog",
}
APP_COMPAT_EXTRA_TABLES = {
    "child_stage_quiz_attempts": """
        CREATE TABLE "child_stage_quiz_attempts" (
          "attempt_id" TEXT PRIMARY KEY,
          "child_id" BIGINT NOT NULL,
          "world_id" TEXT NOT NULL,
          "stage_number" BIGINT NOT NULL,
          "total_questions" BIGINT NOT NULL,
          "correct_count" BIGINT NOT NULL,
          "passed" BIGINT NOT NULL DEFAULT 0,
          "answers_json" TEXT NOT NULL DEFAULT '[]',
          "submitted_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "fk_child_stage_quiz_attempts_child"
            FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE
        )
    """,
}
APP_COMPAT_EXTRA_INDEXES = [
    """
    CREATE INDEX "idx_child_stage_quiz_attempts_child_stage"
    ON "child_stage_quiz_attempts" ("child_id", "world_id", "stage_number", "submitted_at")
    """,
]


@dataclass(frozen=True)
class ForeignKeyStatement:
    from_table: str
    to_table: str
    from_columns: tuple[str, ...]
    to_columns: tuple[str, ...]
    sql: str


def quote_ident(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def qname(name: str) -> str:
    return quote_ident(name)


def sqlite_readonly_uri(path: Path) -> str:
    normalized = str(path.resolve()).replace("\\", "/")
    return "file:" + quote(normalized, safe="/:") + "?mode=ro"


def connect_sqlite_readonly(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(sqlite_readonly_uri(path), uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_sqlite_tables(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()
    return [row["name"] for row in rows if row["name"] not in SYSTEM_TABLES]


def get_sqlite_views(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'view'
        ORDER BY name
        """
    ).fetchall()


def table_columns(conn: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return conn.execute(f"PRAGMA table_info({qname(table)})").fetchall()


def sqlite_type_to_postgres(sqlite_type: str) -> str:
    normalized = (sqlite_type or "").strip().upper()
    if not normalized:
        return "TEXT"
    if "INT" in normalized:
        return "BIGINT"
    if any(token in normalized for token in ["CHAR", "CLOB", "TEXT", "VARCHAR"]):
        return "TEXT"
    if "BLOB" in normalized:
        return "BYTEA"
    if any(token in normalized for token in ["REAL", "FLOA", "DOUB"]):
        return "DOUBLE PRECISION"
    if any(token in normalized for token in ["NUM", "DEC", "BOOL"]):
        return "NUMERIC"
    return "TEXT"


def transform_default(default: Any) -> str | None:
    if default is None:
        return None
    value = str(default).strip()
    if not value:
        return None
    upper = value.upper()
    if upper in {"CURRENT_TIMESTAMP", "CURRENT_DATE", "CURRENT_TIME"}:
        return value
    if value.startswith('"') and value.endswith('"'):
        return "'" + value[1:-1].replace("'", "''") + "'"
    return value


def create_table_sql(conn: sqlite3.Connection, table: str) -> str:
    columns = table_columns(conn, table)
    if not columns:
        raise RuntimeError(f"SQLite table has no columns: {table}")

    pk_columns = [column for column in sorted(columns, key=lambda item: item["pk"] or 0) if column["pk"]]
    single_pk_name = pk_columns[0]["name"] if len(pk_columns) == 1 else None

    definitions: list[str] = []
    for column in columns:
        name = column["name"]
        pg_type = sqlite_type_to_postgres(column["type"])
        parts = [qname(name), pg_type]

        if single_pk_name == name:
            if pg_type == "BIGINT":
                parts = [qname(name), "BIGINT GENERATED BY DEFAULT AS IDENTITY"]
            parts.append("PRIMARY KEY")
        elif column["notnull"]:
            parts.append("NOT NULL")

        default = transform_default(column["dflt_value"])
        if default is not None and single_pk_name != name:
            parts.append(f"DEFAULT {default}")

        definitions.append(" ".join(parts))

    if len(pk_columns) > 1:
        pk_names = ", ".join(qname(column["name"]) for column in pk_columns)
        definitions.append(f"PRIMARY KEY ({pk_names})")

    body = ",\n  ".join(definitions)
    return f"CREATE TABLE {qname(table)} (\n  {body}\n)"


def create_foreign_key_sql(conn: sqlite3.Connection, table: str) -> list[ForeignKeyStatement]:
    rows = conn.execute(f"PRAGMA foreign_key_list({qname(table)})").fetchall()
    groups: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        groups[row["id"]].append(row)

    statements: list[ForeignKeyStatement] = []
    for fk_id, items in sorted(groups.items()):
        items = sorted(items, key=lambda row: row["seq"])
        raw_from_columns = tuple(row["from"] for row in items)
        raw_to_columns = tuple(row["to"] for row in items)
        from_columns = ", ".join(qname(column) for column in raw_from_columns)
        to_table = items[0]["table"]
        to_columns = ", ".join(qname(column) for column in raw_to_columns)
        on_update = items[0]["on_update"]
        on_delete = items[0]["on_delete"]
        constraint = f"fk_{table}_{fk_id}"
        sql = (
            f"ALTER TABLE {qname(table)} ADD CONSTRAINT {qname(constraint)} "
            f"FOREIGN KEY ({from_columns}) REFERENCES {qname(to_table)} ({to_columns})"
        )
        if on_update and on_update.upper() != "NO ACTION":
            sql += f" ON UPDATE {on_update}"
        if on_delete and on_delete.upper() != "NO ACTION":
            sql += f" ON DELETE {on_delete}"
        statements.append(
            ForeignKeyStatement(
                from_table=table,
                to_table=to_table,
                from_columns=raw_from_columns,
                to_columns=raw_to_columns,
                sql=sql,
            )
        )
    return statements


def referenced_columns_have_unique_constraint(pg_cur, table: str, columns: tuple[str, ...]) -> bool:
    pg_cur.execute(
        """
        SELECT array_agg(att.attname ORDER BY key_positions.ordinality) AS constrained_columns
        FROM pg_constraint constraint_row
        JOIN pg_class table_row
          ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace namespace_row
          ON namespace_row.oid = table_row.relnamespace
        JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS key_positions(attnum, ordinality)
          ON TRUE
        JOIN pg_attribute att
          ON att.attrelid = table_row.oid
         AND att.attnum = key_positions.attnum
        WHERE namespace_row.nspname = 'public'
          AND table_row.relname = %s
          AND constraint_row.contype IN ('p', 'u')
        GROUP BY constraint_row.oid
        """,
        (table,),
    )
    expected = list(columns)
    return any(list(row[0] or []) == expected for row in pg_cur.fetchall())


def add_foreign_key_if_safe(pg_cur, statement: ForeignKeyStatement) -> bool:
    if (statement.from_table, statement.to_table) in LEGACY_FK_SKIP_PAIRS:
        print(f"Skipping legacy FK: {statement.from_table} -> {statement.to_table}")
        return False

    if referenced_columns_have_unique_constraint(pg_cur, statement.to_table, statement.to_columns):
        pg_cur.execute(statement.sql)
        return True

    message = (
        "Referenced columns do not have a PRIMARY KEY or UNIQUE constraint: "
        f"{statement.from_table}({', '.join(statement.from_columns)}) -> "
        f"{statement.to_table}({', '.join(statement.to_columns)})"
    )
    if statement.from_table in LEGACY_PETS_POKEMON_TABLES or statement.to_table in LEGACY_PETS_POKEMON_TABLES:
        print(f"Warning: {message}. Skipping legacy pets/pokemon FK.")
        return False
    raise RuntimeError(message)


def create_index_sql(conn: sqlite3.Connection, table: str) -> list[str]:
    rows = conn.execute(f"PRAGMA index_list({qname(table)})").fetchall()
    statements: list[str] = []
    for row in rows:
        if row["origin"] == "pk":
            continue
        index_name = row["name"]
        index_sql_row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
            (index_name,),
        ).fetchone()
        columns = [
            info["name"]
            for info in conn.execute(f"PRAGMA index_info({qname(index_name)})").fetchall()
            if info["name"]
        ]
        if not columns:
            continue
        unique = "UNIQUE " if row["unique"] else ""
        if index_name.startswith("sqlite_autoindex"):
            index_name = f"uq_{table}_{'_'.join(columns)}"
        column_sql = ", ".join(qname(column) for column in columns)
        statement = f"CREATE {unique}INDEX {qname(index_name)} ON {qname(table)} ({column_sql})"
        if index_sql_row and index_sql_row["sql"] and " WHERE " in index_sql_row["sql"].upper():
            where_clause = index_sql_row["sql"].split(" WHERE ", 1)[1]
            statement += f" WHERE {where_clause}"
        statements.append(statement)
    return statements


def assert_target_database_empty(pg_conn) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        existing_tables = [row[0] for row in cur.fetchall()]
    if existing_tables:
        joined = ", ".join(existing_tables[:20])
        raise RuntimeError(
            "Target PostgreSQL database is not empty. Refusing to import. "
            f"Existing public tables: {joined}"
        )


def fetch_all_rows(conn: sqlite3.Connection, table: str) -> tuple[list[str], list[tuple[Any, ...]]]:
    columns = [column["name"] for column in table_columns(conn, table)]
    column_sql = ", ".join(qname(column) for column in columns)
    rows = conn.execute(f"SELECT {column_sql} FROM {qname(table)}").fetchall()
    values = [tuple(row[column] for column in columns) for row in rows]
    return columns, values


def import_table(sqlite_conn: sqlite3.Connection, pg_cur, table: str) -> int:
    columns, values = fetch_all_rows(sqlite_conn, table)
    if not values:
        return 0
    target_columns = ", ".join(qname(column) for column in columns)
    sql = f"INSERT INTO {qname(table)} ({target_columns}) VALUES %s"
    execute_values(pg_cur, sql, values, page_size=1000)
    return len(values)


def sync_sequences(pg_cur) -> None:
    pg_cur.execute(
        """
        SELECT
            table_name,
            column_name,
            pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) IS NOT NULL
        ORDER BY table_name, column_name
        """
    )
    sequence_rows = pg_cur.fetchall()
    for table_name, column_name, sequence_name in sequence_rows:
        if not sequence_name:
            continue
        pg_cur.execute(
            f"""
            SELECT setval(
                %s::regclass,
                COALESCE((SELECT MAX({qname(column_name)}) FROM {qname(table_name)}), 0) + 1,
                false
            )
            """,
            (sequence_name,),
        )
        print(f"Synced sequence: {sequence_name} for {table_name}.{column_name}")


def table_count_sqlite(conn: sqlite3.Connection, table: str) -> int:
    return int(conn.execute(f"SELECT COUNT(*) FROM {qname(table)}").fetchone()[0])


def table_count_postgres(pg_cur, table: str) -> int:
    pg_cur.execute(f"SELECT COUNT(*) FROM {qname(table)}")
    return int(pg_cur.fetchone()[0])


def print_count_comparison(sqlite_conn: sqlite3.Connection, pg_cur, tables: list[str]) -> None:
    print("\nRow count comparison:")
    print("table\tsqlite\tpostgres\tstatus")
    for table in tables:
        sqlite_count = table_count_sqlite(sqlite_conn, table)
        postgres_count = table_count_postgres(pg_cur, table)
        status = "OK" if sqlite_count == postgres_count else "MISMATCH"
        print(f"{table}\t{sqlite_count}\t{postgres_count}\t{status}")


def print_query_result(pg_cur, title: str, sql: str, params: tuple[Any, ...] = ()) -> list[tuple[Any, ...]]:
    pg_cur.execute(sql, params)
    rows = pg_cur.fetchall()
    print(f"\n{title}:")
    if not rows:
        print("OK")
    else:
        for row in rows:
            print(row)
    return rows


def postgres_columns(pg_cur, table: str) -> set[str]:
    pg_cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return {row[0] for row in pg_cur.fetchall()}


def print_schema_compatibility(sqlite_conn: sqlite3.Connection, pg_cur, tables: list[str]) -> None:
    print("\nSchema compatibility check:")
    missing_tables: list[str] = []
    missing_columns: list[tuple[str, list[str]]] = []
    pg_cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """
    )
    pg_tables = {row[0] for row in pg_cur.fetchall()}
    for table in tables:
        if table not in pg_tables:
            missing_tables.append(table)
            continue
        sqlite_columns = {column["name"] for column in table_columns(sqlite_conn, table)}
        absent = sorted(sqlite_columns - postgres_columns(pg_cur, table))
        if absent:
            missing_columns.append((table, absent))

    if not missing_tables and not missing_columns:
        print("OK: no missing imported tables or columns.")
        for table in APP_COMPAT_EXTRA_TABLES:
            if table not in tables:
                print(f"OK: app compatibility table exists without SQLite source table: {table}")
        return

    if missing_tables:
        print("Missing PostgreSQL tables:", ", ".join(missing_tables))
    for table, columns in missing_columns:
        print(f"Missing columns in {table}: {', '.join(columns)}")


def validate_special_expectations(sqlite_conn: sqlite3.Connection, pg_cur) -> None:
    print("\nSpecial validations:")
    checks = [
        ("children = 3", "SELECT COUNT(*) FROM children", 3),
        (
            "children IDs = 28,29,33",
            "SELECT string_agg(id::text, ',' ORDER BY id) FROM children",
            "28,29,33",
        ),
        ("heroes = 98", "SELECT COUNT(*) FROM heroes", 98),
        (
            "heroes grammar = 18",
            "SELECT COUNT(*) FROM heroes WHERE collection_type = 'grammar'",
            18,
        ),
        ("grammar_lesson_rewards = 17", "SELECT COUNT(*) FROM grammar_lesson_rewards", 17),
        ("grammar_completion_rewards = 1", "SELECT COUNT(*) FROM grammar_completion_rewards", 1),
    ]
    for label, sql, expected in checks:
        pg_cur.execute(sql)
        actual = pg_cur.fetchone()[0]
        status = "OK" if actual == expected else "MISMATCH"
        print(f"{label}: {actual} ({status}, expected {expected})")

    for table in ["words", "grammar_lessons", "grammar_form_test_items"]:
        sqlite_count = table_count_sqlite(sqlite_conn, table)
        postgres_count = table_count_postgres(pg_cur, table)
        status = "OK" if sqlite_count == postgres_count else "MISMATCH"
        print(f"{table} count parity: sqlite={sqlite_count}, postgres={postgres_count} ({status})")

    print_query_result(
        pg_cur,
        "Duplicate hero code",
        """
        SELECT code, COUNT(*)
        FROM heroes
        GROUP BY code
        HAVING COUNT(*) > 1
        ORDER BY code
        """,
    )
    print_query_result(
        pg_cur,
        "grammar_lesson_rewards rows with missing hero",
        """
        SELECT glr.lesson_id, glr.hero_id
        FROM grammar_lesson_rewards glr
        LEFT JOIN heroes h ON h.id = glr.hero_id
        WHERE h.id IS NULL
        ORDER BY glr.lesson_id
        """,
    )
    print_query_result(
        pg_cur,
        "child_heroes rows with missing hero",
        """
        SELECT ch.id, ch.child_id, ch.hero_id
        FROM child_heroes ch
        LEFT JOIN heroes h ON h.id = ch.hero_id
        WHERE h.id IS NULL
        ORDER BY ch.id
        """,
    )

    pg_cur.execute(
        """
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'child_id'
          AND table_name <> 'children'
        ORDER BY table_name
        """
    )
    child_tables = [row[0] for row in pg_cur.fetchall()]
    print("\nProgress/child references with missing child:")
    any_missing_child = False
    for table in child_tables:
        pg_cur.execute(
            f"""
            SELECT COUNT(*)
            FROM {qname(table)} t
            LEFT JOIN children c ON c.id = t.child_id
            WHERE c.id IS NULL
            """
        )
        missing = int(pg_cur.fetchone()[0])
        if missing:
            any_missing_child = True
            print(f"{table}: {missing}")
    if not any_missing_child:
        print("OK")


def create_views(sqlite_conn: sqlite3.Connection, pg_cur) -> None:
    for view in get_sqlite_views(sqlite_conn):
        sql = view["sql"]
        if not sql:
            continue
        pg_cur.execute(sql)
        print(f"Created view: {view['name']}")


def print_target_summary(database_url: str) -> None:
    parsed = urlparse(database_url)
    database_name = parsed.path.lstrip("/") or "(unknown)"
    print("Target PostgreSQL:")
    print(f"  host: {parsed.hostname or '(unknown)'}")
    print(f"  database: {database_name}")
    print(f"  user: {parsed.username or '(unknown)'}")
    print("  password: (hidden)")


def main() -> int:
    source_path_raw = os.getenv("SOURCE_SQLITE_PATH", "").strip()
    target_database_url = os.getenv("TARGET_DATABASE_URL", "").strip()
    if not source_path_raw:
        print("SOURCE_SQLITE_PATH is required.", file=sys.stderr)
        return 2
    if not target_database_url:
        print("TARGET_DATABASE_URL is required.", file=sys.stderr)
        return 2

    source_path = Path(source_path_raw)
    if not source_path.exists():
        print(f"SQLite source file does not exist: {source_path}", file=sys.stderr)
        return 2
    if not source_path.is_file():
        print(f"SQLite source path is not a file: {source_path}", file=sys.stderr)
        return 2

    print(f"Source SQLite: {source_path.resolve()}")
    print_target_summary(target_database_url)
    confirmation = input(f"Type {CONFIRMATION_TEXT} to continue: ").strip()
    if confirmation != CONFIRMATION_TEXT:
        print("Confirmation did not match. Exiting without importing.")
        return 1

    sqlite_conn = connect_sqlite_readonly(source_path)
    pg_conn = None
    try:
        tables = get_sqlite_tables(sqlite_conn)
        print("\nSQLite tables to import:")
        for table in tables:
            print(f"  {table}")

        views = get_sqlite_views(sqlite_conn)
        if views:
            print("\nSQLite views to recreate:")
            for view in views:
                print(f"  {view['name']}")

        pg_conn = psycopg2.connect(target_database_url)
        pg_conn.autocommit = False
        assert_target_database_empty(pg_conn)

        try:
            with pg_conn.cursor() as cur:
                cur.execute("SET CONSTRAINTS ALL DEFERRED")
                for table in tables:
                    cur.execute(create_table_sql(sqlite_conn, table))
                    print(f"Created table: {table}")

                for table, statement in APP_COMPAT_EXTRA_TABLES.items():
                    if table not in tables:
                        cur.execute(statement)
                        print(f"Created app compatibility table: {table}")

                for table in tables:
                    imported = import_table(sqlite_conn, cur, table)
                    print(f"Imported {imported} rows into {table}")

                for table in tables:
                    added_fk_count = 0
                    for statement in create_foreign_key_sql(sqlite_conn, table):
                        if add_foreign_key_if_safe(cur, statement):
                            added_fk_count += 1
                    print(f"Added foreign keys for: {table} ({added_fk_count})")

                for table in tables:
                    for statement in create_index_sql(sqlite_conn, table):
                        cur.execute(statement)
                    print(f"Created indexes for: {table}")

                created_extra_tables = [table for table in APP_COMPAT_EXTRA_TABLES if table not in tables]
                if created_extra_tables:
                    for statement in APP_COMPAT_EXTRA_INDEXES:
                        cur.execute(statement)
                    print("Created app compatibility indexes")

                create_views(sqlite_conn, cur)
                sync_sequences(cur)
                print_count_comparison(sqlite_conn, cur, tables)
                validate_special_expectations(sqlite_conn, cur)
                print_schema_compatibility(sqlite_conn, cur, tables)

            pg_conn.commit()
            print("\nImport completed and committed.")
            return 0
        except Exception:
            pg_conn.rollback()
            print("\nImport failed. Transaction rolled back.", file=sys.stderr)
            raise
    finally:
        sqlite_conn.close()
        if pg_conn is not None:
            pg_conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
