#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
UV=${UV:-uv}
(cd apps/api && "$UV" sync --python 3.12 && "$UV" run alembic upgrade head)
(cd apps/api && "$UV" run uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM
npm run dev
