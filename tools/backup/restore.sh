#!/usr/bin/env bash
# ============================================================
# Restore a Bind Build ERP backup into a fresh Supabase project.
#
#   export TARGET_DB_URL="postgresql://postgres.[newref]:[password]@..."
#   ./tools/backup/restore.sh backups/2026-07-30_1400.tar.gz
#
# Restore into a NEW project, never over a live one. If the live project is
# damaged you want the broken copy kept for comparison.
# ============================================================
set -euo pipefail

ARCHIVE="${1:?usage: restore.sh <backup.tar.gz>}"
[ -n "${TARGET_DB_URL:-}" ] || { echo "TARGET_DB_URL is not set" >&2; exit 1; }

TMP=$(mktemp -d)
tar -xzf "$ARCHIVE" -C "$TMP"
DIR=$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)

echo "==> Restoring schema + data"
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "$TARGET_DB_URL" "$DIR/full.backup" || {
    echo "    physical restore failed, falling back to SQL"
    psql "$TARGET_DB_URL" -f "$DIR/schema.sql"
    psql "$TARGET_DB_URL" -f "$DIR/data.sql"
  }

echo "==> Restoring auth users"
psql "$TARGET_DB_URL" -f "$DIR/auth.sql" || \
  echo "    auth restore failed — users may need to be recreated and re-invited"

rm -rf "$TMP"
echo
echo "Restored. Now:"
echo "  1. Update src/lib/config.js with the new project URL and publishable key"
echo "  2. Re-upload storage objects from the archive's storage/ folder"
echo "  3. Add the Vercel domain to Auth -> URL Configuration -> Redirect URLs"
echo "  4. Sign in and verify: leads, invoices, payslips, and a signed file URL"
