# Verification record

Executed on 30 September 2026 against the implemented source, using Python 3.12.2, Node.js 24.12.0 and Chromium 153.

## Passed locally

- Backend: **48 passing pytest tests**, covering rules, API workflows, ownership, authentication, uploads, parsing, source quality and security.
- Ruff lint and formatting checks.
- Frontend ESLint, strict TypeScript checking and Prettier formatting.
- Three Vitest display-utility tests.
- Next.js optimized production build, including all application routes and standalone server output.
- Playwright new-user flow: registration, onboarding, three genuine synthetic PDF uploads, scholarship extraction, completed analysis, exact TOEFL 96 >= 90 evidence, simulation, unchanged original evidence, and source-cited local assistant.
- Playwright seeded workspace: dashboard at 1440px, 768px and 390px, no horizontal overflow, evidence expansion, printable report, comparison, settings and document status.
- Fresh SQLite migration upgrade, schema-drift check, downgrade, and re-upgrade: 28 tables including Alembic's version table.
- Compose YAML parsing, referenced Dockerfile paths and Next.js standalone output layout.
- Generated OpenAPI contract with 37 paths.

The frontend production build and browser checks used an identical source copy in a temporary runtime directory because filesystem reads in the workspace intermittently stalled. The API, migrations, fixtures, documentation and all deliverable source remain in this repository. Tests use synthetic data only. The local preview uses SQLite, private local files, thread jobs and the explicitly labeled local evidence provider.

## Reproduce

From the root:

```bash
npm ci
npm run lint
npm run format:check -w apps/web
npm test
npm run build
```

From `apps/api`:

```bash
uv sync --frozen --python 3.12
uv run ruff check app tests
uv run ruff format --check app tests
uv run pytest -q
uv run alembic upgrade head
uv run alembic check
DEMO_PASSWORD='ScholarDemo!2027' uv run python -m app.seed_demo_data
```

With API and web running at the documented localhost origins:

```bash
npx --workspace apps/web playwright install chromium
npm run test:e2e
```

The demo browser test requires the seed account. `SCHOLARAI_SCREENSHOT_DIR` optionally selects a screenshot output directory. Default output is `docs/screenshots`.

## Not verified on this host

Docker is not installed. Full Compose startup, image builds/pulls, PostgreSQL/pgvector execution, Redis/Celery delivery, MinIO integration and container OCR remain unverified. The YAML check is not a substitute for running the stack.

No external AI credentials or SMTP server were supplied. Real structured generation, embedding compatibility and email delivery remain unverified. The local provider and development email outbox were tested; those results do not validate external services.

This verification is not a penetration test, an accessibility certification, an extraction accuracy benchmark, or a production launch approval. The README lists concrete deployment checks and remaining improvements.

PyMuPDF emits upstream SWIG deprecation warnings during tests; they do not affect test outcomes. Vitest reports that a future Vite configuration loader will prefer ESM package configuration; the current locked toolchain passes.
