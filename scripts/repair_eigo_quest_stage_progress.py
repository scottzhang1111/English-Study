"""Audit and optionally repair Eigo Quest stage progress rows.

Default mode is read-only. Use --apply only after reviewing the dry-run output.
This script treats child_world_stage_progress as the stage-clear source of truth.
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='write repair changes')
    parser.add_argument(
        '--delete-invalid',
        action='store_true',
        help='with --apply, delete invalid world/stage rows such as shadow stage 6',
    )
    return parser.parse_args()


def valid_stage_map():
    return {world['id']: set(range(1, world['stage_count'] + 1)) for world in app.EIGO_QUEST_WORLDS}


def audit_rows(conn):
    valid = valid_stage_map()
    rows = conn.execute(
        '''
        SELECT child_id, world_id, stage_number, status
        FROM child_world_stage_progress
        ORDER BY child_id, world_id, stage_number
        '''
    ).fetchall()
    invalid = []
    for row in rows:
        world_id = str(row['world_id'] or '').strip().lower()
        try:
            stage_number = int(row['stage_number'])
        except (TypeError, ValueError):
            stage_number = None
        if world_id not in valid or stage_number not in valid.get(world_id, set()):
            invalid.append(row)
    by_child = {}
    for row in rows:
        if str(row['status'] or '').strip().lower() == 'cleared':
            by_child.setdefault(row['child_id'], set()).add(
                (str(row['world_id'] or '').strip().lower(), int(row['stage_number']))
            )

    non_contiguous = []
    for child_id, cleared in by_child.items():
        gap_seen = False
        for world in app.EIGO_QUEST_WORLDS:
            for stage_number in range(1, world['stage_count'] + 1):
                key = (world['id'], stage_number)
                if key in cleared and gap_seen:
                    non_contiguous.append((child_id, world['id'], stage_number))
                elif key not in cleared:
                    gap_seen = True

    return rows, invalid, non_contiguous


def main():
    args = parse_args()
    conn = app.get_db_connection()
    try:
        rows, invalid, non_contiguous = audit_rows(conn)
        print(f'child_world_stage_progress rows: {len(rows)}')
        print(f'invalid rows: {len(invalid)}')
        for row in invalid:
            print(
                f"invalid child_id={row['child_id']} "
                f"world={row['world_id']} stage={row['stage_number']} status={row['status']}"
            )
        print(f'non-contiguous cleared rows: {len(non_contiguous)}')
        for child_id, world_id, stage_number in non_contiguous:
            print(f'non-contiguous child_id={child_id} world={world_id} stage={stage_number}')

        if args.apply and args.delete_invalid and invalid:
            conn.executemany(
                '''
                DELETE FROM child_world_stage_progress
                WHERE child_id = ? AND world_id = ? AND stage_number = ?
                ''',
                [(row['child_id'], row['world_id'], row['stage_number']) for row in invalid],
            )
            conn.commit()
            print(f'deleted invalid rows: {len(invalid)}')
        elif args.apply:
            print('no write performed; pass --delete-invalid to remove invalid rows')
        else:
            print('dry run only; no database changes written')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
