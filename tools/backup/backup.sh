#!/usr/bin/env bash
# ============================================================
# Bind Build ERP — off-site backup
#
# The Supabase Free plan keeps ZERO days of backup retention. Nothing is
# being snapshotted for you. This script is your only copy until the
# project is on Pro.
#
# Usage:
#   export SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
#   ./tools/backup/backup.sh
#
# Get that URL from: Dashboard -> Project Settings -> Database -> Connection string -> URI
# ============================================================
set -euo pipefail

STAMP=$(date +%Y-%m-%d_%H%M)
OUT="${BACKUP_DIR:-./backups}/$STAMP"
mkdir -p "$OUT"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. See the header of this script." >&2
  exit 1
fi

echo "==> Roles and schema"
pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges \
  --schema=public --schema=storage > "$OUT/schema.sql"

echo "==> Data"
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
  --schema=public > "$OUT/data.sql"

echo "==> Auth users (needed to restore logins)"
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
  --table=auth.users --table=auth.identities > "$OUT/auth.sql"

echo "==> Full physical dump (fastest restore path)"
pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges > "$OUT/full.backup"

# storage objects are NOT in the database; they must be pulled separately
if command -v supabase >/dev/null 2>&1 && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "==> Storage buckets"
  mkdir -p "$OUT/storage"
  for b in lead-files site-photos receipts documents; do
    supabase storage download --recursive "ss://$b" "$OUT/storage/$b" 2>/dev/null \
      || echo "    (skipped $b)"
  done
else
  echo "==> Storage skipped: install the Supabase CLI and set SUPABASE_PROJECT_REF"
fi

tar -czf "$OUT.tar.gz" -C "$(dirname "$OUT")" "$(basename "$OUT")"
rm -rf "$OUT"

echo
echo "Backup written: $OUT.tar.gz  ($(du -h "$OUT.tar.gz" | cut -f1))"
echo "Copy it somewhere that is NOT Supabase and NOT this machine."
