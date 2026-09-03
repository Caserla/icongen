#!/bin/sh
set -eu

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${ENCRYPTED_BACKUP_FILE:?ENCRYPTED_BACKUP_FILE is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE_FILE:?BACKUP_ENCRYPTION_PASSPHRASE_FILE is required}"

if [ "${ALLOW_DESTRUCTIVE_RESTORE_TEST:-}" != "yes" ]; then
  echo "Set ALLOW_DESTRUCTIVE_RESTORE_TEST=yes for a disposable restore database" >&2
  exit 2
fi
if [ -n "${PRODUCTION_DATABASE_URL:-}" ] && [ "$RESTORE_DATABASE_URL" = "$PRODUCTION_DATABASE_URL" ]; then
  echo "Refusing to restore into PRODUCTION_DATABASE_URL" >&2
  exit 2
fi

for command_name in pg_restore openssl shasum psql; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required" >&2
    exit 2
  }
done

test -f "$ENCRYPTED_BACKUP_FILE" || { echo "Backup file does not exist" >&2; exit 2; }
test -f "$ENCRYPTED_BACKUP_FILE.sha256" || { echo "Checksum file does not exist" >&2; exit 2; }
test -f "$BACKUP_ENCRYPTION_PASSPHRASE_FILE" || { echo "Passphrase file does not exist" >&2; exit 2; }

(cd "$(dirname "$ENCRYPTED_BACKUP_FILE")" && shasum -a 256 -c "$(basename "$ENCRYPTED_BACKUP_FILE").sha256")

plain_file=$(mktemp "${TMPDIR:-/tmp}/icongen-restore.XXXXXX.dump")
trap 'rm -f "$plain_file"' EXIT HUP INT TERM
openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass "file:$BACKUP_ENCRYPTION_PASSPHRASE_FILE" \
  -in "$ENCRYPTED_BACKUP_FILE" -out "$plain_file"
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$plain_file"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
select count(*) as generation_jobs from public.generation_jobs;
select count(*) as credit_ledger_entries from public.credit_ledger;
select count(*) as generation_assets from public.generation_assets;
SQL

echo "Restore verification completed against the disposable database"
