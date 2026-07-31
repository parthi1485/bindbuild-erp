#!/usr/bin/env python3
"""
Bind Build ERP — import CSV data back into the database.

Two uses:

  1. Recover from an export when you have no pg_dump (see restore.sh first —
     it is the better path if you have one).
  2. Bulk-load existing records into a fresh system: your current client list,
     material catalogue, opening stock.

Why this is not just "loop and INSERT"
--------------------------------------
Three things break a naive import, all silently:

  Foreign keys      inserting invoices before clients fails. Tables must go in
                    dependency order, computed from the actual constraints.
  Generated columns invoice_items.amount is GENERATED ALWAYS. Supplying it is
                    an error, so those columns are dropped from the insert.
  Triggers          invoices recompute their own GST. Send subtotal and let the
                    database do the rest, or the two disagree.

Usage
-----
    export SUPABASE_DB_URL="postgresql://postgres.[ref]:[pw]@..."

    # always look first
    python3 tools/backup/import.py ./exports/2026-07-30_1900/csv --dry-run

    # then commit
    python3 tools/backup/import.py ./exports/2026-07-30_1900/csv

Options
-------
    --dry-run        report what would happen, change nothing
    --on-conflict    skip (default) | update | error
    --tables a,b,c   restrict to these tables
    --truncate       empty each target table first (destructive, asks first)
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from collections import defaultdict
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 is missing.  pip install psycopg2-binary")

csv.field_size_limit(10_000_000)


def connect():
    url = os.environ.get('SUPABASE_DB_URL')
    if not url:
        sys.exit("SUPABASE_DB_URL is not set. See the docstring at the top of this file.")
    return psycopg2.connect(url)


def generated_columns(cur):
    """Columns the database computes; supplying a value is an error."""
    cur.execute("""
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and (is_generated = 'ALWAYS' or identity_generation = 'ALWAYS')
    """)
    out = defaultdict(set)
    for t, c in cur.fetchall():
        out[t].add(c)
    return out


def real_columns(cur):
    cur.execute("""
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
    """)
    out = defaultdict(set)
    for t, c in cur.fetchall():
        out[t].add(c)
    return out


def dependencies(cur):
    """table -> set of tables it references. Self-references are ignored:
    they order rows within a table, not tables against each other."""
    cur.execute("""
        select
          src.relname  as child,
          tgt.relname  as parent
        from pg_constraint c
        join pg_class src on src.oid = c.conrelid
        join pg_class tgt on tgt.oid = c.confrelid
        join pg_namespace n on n.oid = src.relnamespace
        where c.contype = 'f' and n.nspname = 'public'
    """)
    deps = defaultdict(set)
    for child, parent in cur.fetchall():
        if child != parent:
            deps[child].add(parent)
    return deps


def topo_order(tables, deps):
    """Parents before children.

    Cycles are real here: clients.converted_from_lead_id points at leads, and
    leads.client_id points back. A classic Kahn's algorithm stalls on that and
    dumps every remaining table into an alphabetical tail — which put
    invoice_items ahead of invoices and would fail on insert.

    So when nothing is ready, break the cycle by emitting the table with the
    fewest unresolved dependencies and carry on. Both columns in that cycle are
    nullable, so one side inserting first is fine.
    """
    remaining = set(tables)
    order, forced = [], []

    while remaining:
        ready = sorted(t for t in remaining if not (deps.get(t, set()) & remaining))
        if ready:
            for t in ready:
                order.append(t)
                remaining.discard(t)
        else:
            t = min(sorted(remaining),
                    key=lambda x: len(deps.get(x, set()) & remaining))
            order.append(t)
            remaining.discard(t)
            forced.append(t)

    return order, forced


def primary_key(cur, table):
    cur.execute("""
        select a.attname
        from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = %s::regclass and i.indisprimary
    """, (f'public."{table}"',))
    return [r[0] for r in cur.fetchall()]


def read_csv(path: Path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        reader = csv.reader(fh)
        header = next(reader, None)
        if not header:
            return [], []
        return header, list(reader)


def coerce(v):
    """CSV gives strings. Empty means NULL; everything else Postgres casts."""
    return None if v == '' else v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', help='folder of CSV files (the csv/ dir of an export)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--on-conflict', choices=['skip', 'update', 'error'], default='skip')
    ap.add_argument('--tables', default='')
    ap.add_argument('--truncate', action='store_true')
    args = ap.parse_args()

    src = Path(args.source).expanduser()
    if not src.is_dir():
        sys.exit(f'Not a folder: {src}')

    files = {p.stem: p for p in sorted(src.glob('*.csv'))}
    if args.tables:
        wanted = {t.strip() for t in args.tables.split(',') if t.strip()}
        files = {k: v for k, v in files.items() if k in wanted}
    if not files:
        sys.exit('No CSV files matched.')

    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()

    cols_by_table = real_columns(cur)
    gen_by_table = generated_columns(cur)
    deps = dependencies(cur)

    known = [t for t in files if t in cols_by_table]
    unknown = sorted(set(files) - set(known))
    order, cyclic = topo_order(known, deps)

    print(f'source     {src}')
    print(f'files      {len(files)}   importable {len(known)}')
    if unknown:
        print(f'skipped    no such table: {", ".join(unknown)}')
    if cyclic:
        print(f"note       cycle broken at: {', '.join(cyclic)}")
    print(f'mode       {"DRY RUN" if args.dry_run else "COMMIT"}, on conflict: {args.on_conflict}')
    print()

    if args.truncate and not args.dry_run:
        print('--truncate will DELETE existing rows in every target table.')
        if input('Type "yes" to continue: ').strip().lower() != 'yes':
            sys.exit('Aborted.')

    total_in = total_skipped = 0
    failures = []

    for table in order:
        header, rows = read_csv(files[table])
        if not rows:
            print(f'{table:26s} empty')
            continue

        valid = cols_by_table[table]
        generated = gen_by_table.get(table, set())

        usable = [c for c in header if c in valid and c not in generated]
        dropped = [c for c in header if c not in usable]
        idx = [header.index(c) for c in usable]
        if not usable:
            print(f'{table:26s} no usable columns, skipped')
            continue

        pk = primary_key(cur, table)
        payload = [tuple(coerce(r[i]) if i < len(r) else None for i in idx) for r in rows]

        collist = ', '.join(f'"{c}"' for c in usable)
        if args.on_conflict == 'skip' and pk:
            tail = f' on conflict ({", ".join(chr(34)+k+chr(34) for k in pk)}) do nothing'
        elif args.on_conflict == 'update' and pk:
            sets = ', '.join(f'"{c}" = excluded."{c}"' for c in usable if c not in pk)
            tail = (f' on conflict ({", ".join(chr(34)+k+chr(34) for k in pk)}) do update set {sets}'
                    if sets else ' on conflict do nothing')
        else:
            tail = ''

        sql = f'insert into public."{table}" ({collist}) values %s{tail}'

        note = f'  (dropped: {", ".join(dropped)})' if dropped else ''
        if args.dry_run:
            print(f'{table:26s} {len(payload):6d} rows would import{note}')
            total_in += len(payload)
            continue

        try:
            if args.truncate:
                cur.execute(f'delete from public."{table}"')
            psycopg2.extras.execute_values(cur, sql, payload, page_size=500)
            done = cur.rowcount if cur.rowcount >= 0 else len(payload)
            skipped = len(payload) - done
            total_in += done
            total_skipped += max(skipped, 0)
            print(f'{table:26s} {done:6d} imported'
                  + (f', {skipped} already present' if skipped > 0 else '') + note)
        except Exception as exc:
            conn.rollback()
            msg = str(exc).strip().split('\n')[0]
            failures.append((table, msg))
            print(f'{table:26s} FAILED  {msg}')
            print()
            print('Rolled back. Nothing was written.')
            break

    print()
    if args.dry_run:
        print(f'Dry run: {total_in} rows across {len(order)} tables. Nothing written.')
        print('Re-run without --dry-run to commit.')
    elif failures:
        print('Import aborted; the database is unchanged.')
        sys.exit(1)
    else:
        conn.commit()
        print(f'Committed: {total_in} rows imported'
              + (f', {total_skipped} already present.' if total_skipped else '.'))
        print('Verify before trusting it: row counts, then a signed file URL, then sign in.')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
