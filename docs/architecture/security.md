# Security and deployment boundary

## Implemented controls

- Argon2 password hashes; random opaque session tokens hashed in the database; seven-day expiration; revocation on password reset/change.
- HttpOnly, SameSite=Lax cookies; Secure in production. Mutations use session-bound CSRF headers plus origin/fetch-site checks.
- Uniform login errors, generic reset responses, one-hour single-use hashed reset/verification tokens. Development mail is a private filesystem outbox; production requires SMTP with STARTTLS.
- Tenant ownership enforced on documents, facts, scholarships, analyses, roadmaps, chats, simulations, exports and downloads. Admin access explicitly checks role.
- Private S3/MinIO storage with generated object keys. File downloads require an authenticated owner; no public object URLs.
- Content-signature and declared-MIME checks; 15 MB upload cap; DOCX archive size/member limits; no macro documents; PDF page/text limits; bounded OCR calls. Originals are never executed.
- SSRF prevention: public IP validation, blocked credentials/nonstandard ports, all resolved addresses checked, connection pinned to validated IP, TLS hostname verification, redirect revalidation, four-hop cap, 2 MB downloads, network timeouts. No paywall or anti-bot bypass.
- SQLAlchemy parameterized queries, source quotes for extraction, strict Pydantic request contracts, sanitized error responses, no password or document-text request logging.
- Redis rate limits in Compose; per-process development fallback. Public deployment must set a trusted proxy/client-IP strategy. Current login rate limits use peer IP, so a proxy aggregates users rather than trusting spoofable headers.
- Explicit Alembic migration job; schema changes never occur during API startup. Containers run as non-root; DB/Redis/storage API are not exposed to host ports by default.

## Before accepting real users

This repository is a working application, not an independent production-security certification. Complete an infrastructure-specific review, dependency scan, backup/restore drill, SMTP deliverability setup, observability integration, worker restart/failure tests, and OCR resource-abuse/load testing. Use real secrets, TLS, private buckets with encryption and retention rules, restricted DB/S3 service accounts, and managed credential rotation.

The local provider is deliberately disabled by production startup validation. Configure a compatible AI provider and evaluate extraction quality on representative documents. Provider excerpts can contain personal data; assess retention and regional requirements before enabling real student uploads.

The CSP currently allows inline scripts/styles and development eval for Next.js compatibility. Set a nonce-based production CSP and remove unsafe-eval at your TLS gateway once tested with the deployed Next.js build.

ClamAV or equivalent antivirus scanning is not bundled. MIME validation and isolated parsing reduce risk but are not malware detection. Add a quarantine/scan stage before releasing uploads in a public deployment. Workers should run in a restricted network/container with CPU, RAM, and process limits.

Role promotion is an operator-only CLI command; users cannot select admin at registration. The application contains no automatic deployment job.
