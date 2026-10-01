#!/bin/sh
set -eu

echo "Running database migrations"
if ! alembic upgrade head; then
  echo "Database migration failed; review the Alembic error above" >&2
  exit 1
fi
echo "Database migrations completed"
python -m app.seed_demo_data
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
