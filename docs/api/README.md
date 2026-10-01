# API guide

Interactive documentation is available on the API service at `/docs`; JSON OpenAPI schema is at `/openapi.json`. In Compose, inspect from inside the private API container or temporarily bind a loopback port for local development. The web application proxies `/api/*` to FastAPI on the same origin.

## Sessions

`POST /api/auth/register` accepts `{name,email,password}`. Login accepts `{email,password}`. Both set an HttpOnly session cookie and return `{user,csrf_token}`. Read `GET /api/auth/me` to recover the CSRF token on refresh. Send it as `X-CSRF-Token` on every authenticated mutation. Passwords require 12–128 characters.

Forgot/reset and verification: `POST /api/auth/forgot-password`, `/reset-password`, `/verify-email`. Logout: `POST /api/auth/logout`.

## Workflow

1. `PUT /api/profile` with validated profile fields; `GET /api/profile` returns `{data,version}`.
2. `POST /api/documents`, multipart `file` and `document_type`; receive 202. Poll `GET /api/documents/{id}`. Allowed categories are listed in `app/parsers/documents.py`. Inspect `facts`, source snippets, confidence and status.
3. Correct a fact with `PATCH /api/documents/{id}/facts/{fact_id}` and `{value}`. Download through `GET /api/documents/{id}/download`; delete or reprocess with the corresponding DELETE/POST routes.
4. Add a scholarship with `POST /api/scholarships/manual` (`name,text` plus optional metadata), `/from-url` (`url,name`), or `/from-document?document_id=...&name=...`. Poll until Ready. Source retrieval/AI parsing run in workers.
5. `POST /api/analyses` with `{scholarship_id}`. Poll `/api/analyses/{id}` until Completed or Failed. The result contains eligibility, category/overall scores, evaluations, evidence, strengths, gaps, recommendations and scoring coverage.
6. `POST /api/analyses/{id}/simulate`, for example `{toefl:100,recommendation_letters:2}`. Results are labeled SIMULATION ONLY.
7. `GET /api/analyses/{id}/roadmap`, `PATCH /api/roadmap/tasks/{id}` with `{status:"In Progress"}`.
8. `POST /api/analyses/{id}/chat` with `{message}` returns 202. Poll GET on the same route for cited answers and job status.
9. `POST /api/compare` with an array of 1–4 analysis IDs. `POST /api/analyses/{id}/rerun` creates a NEW snapshot/version.

## Privacy/admin

- `GET /api/account/export`: complete tenant-owned JSON data export; secrets/session tokens excluded.
- `DELETE /api/analyses/{id}`: remove a snapshot and dependent roadmap/chat/simulations.
- `DELETE /api/account`: delete original files and all tenant-owned records.
- `PUT /api/settings`: update name or change password (requires current password).
- Admin: `GET /api/admin/scholarships`, `PATCH /api/admin/requirements/{id}`, `PATCH /api/admin/scholarships/{id}`. Criteria must retain an exact source quote; verification and changes increment versions.

Error responses use `{detail}` and appropriate HTTP status codes. Unowned IDs return 404. Rate limits return 429 and Retry-After. Request IDs are provided in `X-Request-ID`.
