#!/usr/bin/env bash
# Start a throwaway local PostgreSQL (needs postgres binaries), run all backend tests, tear down.
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d); PORT=${PGPORT:-5433}
cleanup() { "$PGBIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
"$PGBIN/initdb" -D "$DIR/data" -U reservehub --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c max_connections=200" -l "$DIR/log" -w start >/dev/null
"$PGBIN/createdb" -h "$DIR" -p "$PORT" -U reservehub reservehub_test
export TEST_DATABASE_URL="postgresql+psycopg://reservehub@localhost:$PORT/reservehub_test"
cd "$(dirname "$0")/../backend" && python -m pytest "$@"
