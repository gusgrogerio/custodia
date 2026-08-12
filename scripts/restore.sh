#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 backups/AAAAMMDD-HHMMSS" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="$1"
if [[ ! -f "$BACKUP_DIR/mongodb.archive.gz" || ! -f "$BACKUP_DIR/uploads.tar.gz" ]]; then
  echo "Backup inválido: arquivos mongodb.archive.gz/uploads.tar.gz não encontrados." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Arquivo .env não encontrado." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

printf 'Restaurando MongoDB (os dados atuais da base serão substituídos)...\n'
cat "$BACKUP_DIR/mongodb.archive.gz" | docker compose exec -T mongo mongorestore \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "${DB_NAME:-d1_custodia}" \
  --archive --gzip --drop

printf 'Restaurando fotos...\n'
docker compose exec -T backend sh -c 'rm -rf /data/uploads && mkdir -p /data/uploads'
cat "$BACKUP_DIR/uploads.tar.gz" | docker compose exec -T backend tar -xzf - -C /data

printf 'Restauração concluída.\n'
