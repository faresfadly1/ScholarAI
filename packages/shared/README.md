# Cross-service contracts

The backend Pydantic models in `apps/api/app/schemas/contracts.py` and generated `docs/api/openapi.json` define request contracts. Frontend response types live in `apps/web/types/index.ts`. The web API client applies consistent error handling and CSRF tokens.

Eligibility statuses: SATISFIED, NOT_SATISFIED, MISSING_EVIDENCE, UNCERTAIN, NOT_APPLICABLE.

Document statuses: Uploaded, Processing, Processed, Failed.

Fit Score is alignment with supplied requirements. Never label it admission probability.

For future API evolution, generate TypeScript from the checked OpenAPI schema in CI to prevent contract drift.
