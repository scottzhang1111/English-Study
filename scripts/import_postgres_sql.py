import os
import sys
from pathlib import Path

import psycopg2


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQL_PATH = ROOT_DIR / "eigo_quest_postgresql_from_sqlite_v2_fk_fixed.sql"


def main():
    database_url = os.getenv("DATABASE_URL", "").strip()
    sql_path = Path(os.getenv("SQL_PATH", DEFAULT_SQL_PATH))
    confirm = os.getenv("CONFIRM_IMPORT", "").strip().lower()

    if not database_url:
        print("DATABASE_URL is required.", file=sys.stderr)
        return 1
    if not sql_path.exists():
        print(f"SQL file not found: {sql_path}", file=sys.stderr)
        return 1
    if confirm not in {"1", "true", "yes"}:
        print(
            "Refusing to import because this SQL drops and recreates tables. "
            "Set CONFIRM_IMPORT=yes to continue.",
            file=sys.stderr,
        )
        return 1

    sql = sql_path.read_text(encoding="utf-8")
    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
    except Exception:
        raise
    finally:
        conn.close()

    print(f"Imported {sql_path.name} into PostgreSQL.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
