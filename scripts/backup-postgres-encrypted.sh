#!/bin/sh
set -eu

: "${PRODUCTION_DATABASE_URL:?PRODUCTION_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE_FILE:?BACKUP_ENCRYPTION_PASSPHRASE_FILE is required}"
: "${BACKUP_DIRECTORY:?BACKUP_DIRECTORY is required}"

case "$BACKUP_DIRECTORY" in
  /|"$HOME"|"") echo "Refusing unsafe BACKUP_DIRECTORY" >&2; exit 2 ;;
esac

for command_name in pg_dump openssl shasum; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required" >&2
    exit 2
  }
done

test -f "$BACKUP_ENCRYPTION_PASSPHRASE_FILE" || {
  echo "Passphrase file does not exist" >&2
  exit 2
}

umask 077
mkdir -p "$BACKUP_DIRECTORY"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
plain_file=$(mktemp "${TMPDIR:-/tmp}/icongen-backup.XXXXXX.dump")
encrypted_file="$BACKUP_DIRECTORY/icongen-postgres-$timestamp.dump.enc"
trap 'rm -f "$plain_file"' EXIT HUP INT TERM

pg_dump --dbname="$PRODUCTION_DATABASE_URL" --format=custom --no-owner --no-privileges --file="$plain_file"
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -pass "file:$BACKUP_ENCRYPTION_PASSPHRASE_FILE" \
  -in "$plain_file" -out "$encrypted_file"
shasum -a 256 "$encrypted_file" > "$encrypted_file.sha256"

echo "Encrypted backup created: $encrypted_file"
