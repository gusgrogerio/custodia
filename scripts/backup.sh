#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Arquivo .env não encontrado em $ROOT_DIR" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="backups/$STAMP"
mkdir -p "$DEST"

printf 'Criando backup do MongoDB...\n'
docker compose exec -T mongo mongodump \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "${DB_NAME:-d1_custodia}" \
  --archive --gzip > "$DEST/mongodb.archive.gz"

printf 'Criando backup das fotos...\n'
docker compose exec -T backend tar -czf - -C /data uploads > "$DEST/uploads.tar.gz"

cp .env.example "$DEST/env.example.snapshot"

printf 'Backup concluído: %s\n' "$DEST"
