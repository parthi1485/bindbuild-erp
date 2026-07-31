#!/usr/bin/env bash
# ============================================================
# Bind Build ERP — push backups to every configured cloud
#
# Uses rclone rather than per-provider APIs. One config covers Google Drive,
# OneDrive, Dropbox, Box, S3, Backblaze B2, pCloud, Mega and ~60 others.
# Building OAuth per provider would be weeks of work and permanent
# maintenance for something this already does.
#
# Setup, once:
#   1. Install:   https://rclone.org/install/
#   2. Configure: rclone config      (repeat per provider)
#         Google Drive -> choose "drive",    name it gdrive
#         OneDrive     -> choose "onedrive", name it onedrive
#         Dropbox      -> choose "dropbox",  name it dropbox
#         S3 / B2      -> choose the matching backend
#   3. List them: rclone listremotes
#
# Then:
#   export BACKUP_REMOTES="gdrive:BindBuild onedrive:BindBuild b2:bindbuild-erp"
#   ./tools/backup/sync.sh ./backups
#
# A backup that lives on one provider is a backup with one point of failure.
# Two providers in different companies is the cheapest real redundancy there is.
# ============================================================
set -euo pipefail

SRC="${1:-./backups}"
REMOTES="${BACKUP_REMOTES:-}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"

if ! command -v rclone >/dev/null 2>&1; then
  cat >&2 <<'MSG'
rclone is not installed.

  macOS    brew install rclone
  Windows  winget install Rclone.Rclone
  Linux    curl https://rclone.org/install.sh | sudo bash

Then run `rclone config` once per cloud provider.
MSG
  exit 1
fi

if [ -z "$REMOTES" ]; then
  echo "BACKUP_REMOTES is not set. Configured remotes on this machine:" >&2
  rclone listremotes 2>/dev/null | sed 's/^/  /' >&2 || echo "  (none)" >&2
  echo >&2
  echo 'Example: export BACKUP_REMOTES="gdrive:BindBuild onedrive:BindBuild"' >&2
  exit 1
fi

[ -d "$SRC" ] || { echo "No such folder: $SRC" >&2; exit 1; }

echo "Source: $SRC"
echo "Size:   $(du -sh "$SRC" | cut -f1)"
echo

FAILED=""
for remote in $REMOTES; do
  echo "==> $remote"
  if rclone copy "$SRC" "$remote" \
        --create-empty-src-dirs \
        --transfers 4 \
        --retries 3 \
        --stats-one-line \
        --stats 10s \
        --progress; then
    echo "    ok"

    # prune old backups on the remote, never on the source
    if [ "$RETENTION_DAYS" -gt 0 ]; then
      rclone delete "$remote" --min-age "${RETENTION_DAYS}d" --rmdirs 2>/dev/null \
        && echo "    pruned older than ${RETENTION_DAYS}d" \
        || true
    fi
  else
    echo "    FAILED" >&2
    FAILED="$FAILED $remote"
  fi
  echo
done

if [ -n "$FAILED" ]; then
  echo "Some destinations failed:$FAILED" >&2
  echo "The backup is still on disk at $SRC" >&2
  exit 1
fi

echo "Synced to every destination."
