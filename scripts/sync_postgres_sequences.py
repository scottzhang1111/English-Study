import os
import sys

import psycopg2
from psycopg2.extras import DictCursor


def main():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("DATABASE_URL is required.", file=sys.stderr)
        return 1

    conn = psycopg2.connect(database_url, cursor_factory=DictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    table_schema,
                    table_name,
                    column_name,
                    pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) IS NOT NULL
                ORDER BY table_name, column_name
                """
            )
            rows = cur.fetchall()
            for row in rows:
                table_name = row["table_name"]
                column_name = row["column_name"]
                sequence_name = row["sequence_name"]
                cur.execute(
                    f"""
                    SELECT setval(
                        %s::regclass,
                        COALESCE((SELECT MAX("{column_name}") FROM "{table_name}"), 0) + 1,
                        false
                    )
                    """,
                    (sequence_name,),
                )
        conn.commit()
    finally:
        conn.close()

    print(f"Synced {len(rows)} PostgreSQL sequences.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
