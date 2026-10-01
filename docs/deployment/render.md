# Production deployment on Render

The Next.js web service serves the complete application (including `/login`, accounts, document uploads, analyses and reports). It proxies `/api/*` to FastAPI on Render's private network at runtime, so sessions and CSRF protection remain same-origin. The blueprint also provisions a Celery worker, PostgreSQL and a persistent Redis-compatible queue. Applicant documents belong in a private S3-compatible bucket.

The original `https://faresfadly1.github.io/ScholarAI/` address becomes an entry point that forwards visitors to the hosted application's login page. Deep links preserve their route, query and fragment. GitHub Pages does not host the application servers.

## Resources and cost

The configuration in `render.yaml` selects these resources in Frankfurt:

| Resource | Plan | Published monthly base cost |
| --- | --- | ---: |
| Next.js web | 0.5c-512mb | $7 |
| Private FastAPI | 0.5c-512mb | $7 |
| Celery worker | 1c-2g | $25 |
| PostgreSQL | 0.1c-256mb | $6 |
| PostgreSQL storage | 5 GB | $1.50 |
| Key Value queue | 256mb | $10 |
| **Total** | | **$56.50** |

These are [Render's published prices](https://render.com/pricing), checked October 1, 2026. AI usage, object storage, email, taxes, bandwidth overages and any workspace upgrade are additional. Review the actual checkout before provisioning. This is a small starting configuration, not a capacity guarantee; load testing may require larger instances. The blueprint does not create the external AI, bucket or email accounts.

## Deploy

1. Connect this repository to Render and create a Blueprint from `render.yaml` on `main`. Approve the resource costs and configure billing before creating paid resources.
2. Enter the prompted S3 endpoint, bucket and bucket-scoped credentials. The bucket must already exist and be private. Supply an OpenAI-compatible provider key, chat model and embedding model with 1536 dimensions, plus SMTP host, username, password and verified sender. Do not put secrets in Git. The worker receives the storage and AI configuration from the API service.
3. Deploy all resources. The API runs `alembic upgrade head` before startup. Render supplies the public web URL to the API for secure cookies, origin checks and email links. Its private address is supplied to the web server at runtime.
4. Confirm the public web `/health` endpoint returns `{"status":"ready","service":"scholarai-web"}`. This checks API/database/queue/bucket readiness. It does not prove SMTP delivery, provider access or Celery processing; verify those with a synthetic account: registration, verification email, login, document processing, analysis, download, deletion and password reset. Restart services and confirm saved data remains available.
5. After those checks pass, set the GitHub Actions repository variable `PUBLIC_APP_URL` to the actual HTTPS web origin (no trailing route). Run the **Deploy GitHub Pages** workflow. Alternatively supply its `app_url` input for one deployment, but set the repository variable for subsequent pushes.
6. Open the original GitHub Pages address and confirm it reaches `/login` on the hosted application. Test a nested route as well. The Pages workflow refuses to switch to an origin that fails its readiness check. Until a verified URL is configured, it retains the existing static project page.

## Runtime safeguards

The API refuses production startup without HTTPS, Redis/Celery, S3, SMTP and a real AI provider. The proxy shares a generated internal secret with the private API, and uses Render's edge-provided `CF-Connecting-IP` for per-client authentication limits. Do not enable `TRUSTED_CLIENT_IP_HEADER` on another host unless that host overwrites client-supplied values. Direct untrusted forwarding headers are not accepted by the API.

Production is not seeded with fictional scholarships, demo users or passwords. Applicants supply official scholarship URLs, guides or requirements and their own documents. ScholarAI helps prepare and evaluate applications; applicants still submit through each scholarship provider's official process.

Review [security controls](../architecture/security.md) and [known limitations](../../README.md#known-limitations). The local automated suite uses the deterministic development provider; a successful suite is not proof of a working live provider or email service. Complete the hosted checks above before inviting applicants.
