#!/usr/bin/env bash
# Apply database/sql/migrations/NNNN_*.sql (not *.down.sql) that are newer than the DB's version.
#   DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' scripts/migrate_sql.sh
# Local Supabase: DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
# Use a direct or session-pooler connection (not the transaction pooler) for migrations.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
URL="${DATABASE_URL/postgresql+psycopg:/postgresql:}"
DIR="$(cd "$(dirname "$0")/../database/sql/migrations" && pwd)"
current=$(psql "$URL" -Atqc "SELECT COALESCE((SELECT version_num FROM alembic_version LIMIT 1),'0000')" 2>/dev/null || echo 0000)
echo "Current schema version: $current"
applied=0
for f in $(ls "$DIR"/*.sql | grep -v '\.down\.sql$' | sort); do
  n=$(basename "$f" | cut -c1-4)
  if [[ "$n" > "$current" ]]; then
    echo "Applying $(basename "$f")"
    psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"
    applied=$((applied+1))
  fi
done
echo "Done ($applied file(s) applied)."
