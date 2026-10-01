# Zero-Cost Live Deployment

This is the supported free deployment for the complete ScholarAI application. The target recurring infrastructure cost is **$0.00/month** and it uses provider-generated URLs only:

| Service | Free plan | Role |
| --- | --- | --- |
| Vercel | Hobby | Complete Next.js application: register, login, onboarding, dashboard, documents, scholarships, analyses, evidence, fit, roadmap, simulations and assistant |
| Render | Free web service | FastAPI API and short in-process jobs |
| Supabase | Free | PostgreSQL, `vector` extension and private Storage bucket |
| Google AI Studio | Gemini API free tier | Optional, user-opt-in structured AI and embeddings |
| Resend | Free | Optional verification and reset emails |
| GitHub Pages | Free for public repositories | Marketing page linking into Vercel |

The Render Blueprint in `render.yaml` creates one **Free** Python web service. It does not create a paid service, database, disk, worker, Redis, or billing add-on. Do not upgrade a plan, add a payment method, enable pay-as-you-go billing, or attach paid add-ons. Provider quotas can still temporarily block service. Vercel Hobby is restricted to personal/non-commercial use; this setup is for a personal, educational project, not a commercial service.

## Free-tier limits

Render Free services sleep after 15 minutes without traffic, take about a minute to wake, and lose local file changes on restart or sleep. The frontend displays a cold-start message. The live app keeps all records in Supabase and files in its private bucket. Render includes 750 instance-hours per workspace each calendar month; over quota without a payment method, its free services are suspended until reset. See [Render's free service limits](https://render.com/docs/free).

Supabase Free currently includes 500 MB of database size and 1 GB of file storage; free projects with low activity can pause after seven days. Keep uploaded files small and remove accounts/files no longer needed. See [Supabase pricing](https://supabase.com/pricing) and [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

Vercel Hobby is free for personal, non-commercial projects; features stop accepting usage when their included limits are reached. Its functions limit request and response bodies to 4.5 MB, so the app caps live document uploads at 4 MB. See [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [function limits](https://vercel.com/docs/functions/limitations).

Gemini is off by default because Google's Gemini free tier may use submitted content to improve its products. The app uses local deterministic extraction, embeddings and scoring until a student explicitly opts in. See [Gemini pricing and data use](https://ai.google.dev/gemini-api/docs/pricing). Resend is optional; accounts remain usable without email delivery, but verification and password reset emails are not delivered until configured.

## 1. Create Supabase resources

1. Create a Supabase project on the Free plan. Leave spend caps and paid upgrades disabled.
2. In Database → Extensions, enable `vector`. Use the project PostgreSQL connection string in transaction-pooler mode if available; append `?sslmode=require` when not already present. The API changes `postgresql://` to `postgresql+psycopg://` for SQLAlchemy.
3. In Storage, enable S3 protocol access. Create a bucket named `scholarai-private` and keep it private. Create S3 credentials with access only to this project’s Storage API.
4. Record the Postgres URI, project storage S3 endpoint (`https://<project-ref>.supabase.co/storage/v1/s3`), S3 access key and S3 secret key. Never publish them in Git, browser JavaScript, or issue comments.

The migration runs `CREATE EXTENSION vector` and creates the schema when the Render service starts. If Supabase denies the extension migration, enable `vector` in its dashboard and redeploy.

Supabase's S3 API uses AWS Signature Version 4 and supports presigned downloads. ScholarAI streams uploads through Vercel to FastAPI (4 MB maximum) and uses short-lived private signed download links. Browser uploads do not require cross-origin S3 access. See [Supabase S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility) and [signed downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## 2. Deploy FastAPI on Render Free

1. In Render, create a Blueprint from this public GitHub repository and select the `main` branch. Confirm the service plan shown is **Free** before creating it. Do not add a credit card or paid add-ons.
2. Set `APP_URL` to the Vercel project’s exact HTTPS origin. Keep the generated `INTERNAL_PROXY_SECRET` private.
3. Enter the Supabase database URL, S3 endpoint, access key and secret when prompted. The private bucket name is already set to `scholarai-private`.
4. The service runs Alembic migrations, seeds the fictional demo workspace, and starts one FastAPI process with `TASK_MODE=local` and no Redis. Task records and statuses are stored in PostgreSQL; the UI polls them. These jobs are real parsing and rule analysis work executed by the API process, not fabricated results.
5. Once the service is created, copy its HTTPS `onrender.com` URL for the Vercel setting in the next step. Wait for `https://<service>.onrender.com/ready` to return `{"status":"ready",...}`.

The demo seed creates a fictional CV, transcript, TOEFL sample marked invalid, a recommendation placeholder, fictional scholarship sources, and completed evidence analyses. No personal information is included. The shared demo account is writable; tell demo users not to upload personal files or store private information. Each registered user gets a separate account.

## 3. Deploy the complete app to Vercel Hobby

1. Import the same GitHub repository into Vercel. Set the project **Root Directory** to `apps/web` and framework to Next.js. Override **Install Command** to `npm ci --prefix ../..`; the Next.js package script builds from `apps/web` and the root lockfile installs its dependencies.
2. Choose the **Hobby** plan. Do not upgrade or attach paid products.
3. Set these environment variables for Production:

   ```dotenv
   API_INTERNAL_URL=https://<render-service>.onrender.com
   INTERNAL_PROXY_SECRET=<same generated value as Render>
   TRUSTED_CLIENT_IP_HEADER=x-vercel-forwarded-for
   NEXT_PUBLIC_FREE_DEPLOYMENT_MODE=true
   ```

   The trusted client-IP header is used only for rate limits; Vercel documents that it overwrites its forwarded IP headers. Never set that variable when the app is hosted behind a proxy that does not overwrite client-provided values. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).

4. Set Render `APP_URL` to the Vercel production origin, then redeploy Render. Set Vercel's `INTERNAL_PROXY_SECRET` to the exact generated Render value.
5. Open the deployed Vercel origin and confirm `/health` returns the web health response and `/api/health` reaches FastAPI. The `/ready` API route checks PostgreSQL, the private bucket and the current task mode.

## 4. Optional Gemini and Resend

Gemini is not required for signup, uploads, document parsing, evidence, eligibility, fit score, roadmap or simulations. To offer AI assistant and AI extraction, create a Google AI Studio API key without linking a paid billing account. In Render environment variables set `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `LLM_CHAT_MODEL=gemini-3.5-flash-lite`, and `LLM_EMBEDDING_MODEL=gemini-embedding-2`; keep `EMBEDDING_DIMENSIONS=1536`. Restart the API and check Settings shows Gemini is available. Each user must opt in before excerpts/profile data are sent.

Resend can optionally send verification and reset messages. Add `RESEND_API_KEY` and `SMTP_FROM` (a sender Resend accepts) to Render. Keep both unset if the free app should operate without email.

## 5. Keep GitHub Pages as the marketing page

The `pages.yml` workflow publishes the static marketing page on each push to `main`; it does not redirect Pages to a server. Set the GitHub repository Actions variable `PUBLIC_APP_URL` to the actual Vercel production origin. The Pages CTA opens **Launch ScholarAI** and **Try Demo** in the full application. If the variable is unset, the marketing build uses `https://scholarai.vercel.app` as its fallback.

GitHub Pages cannot run the Next.js server or FastAPI. The complete live app is the Vercel URL, and the free `github.io` address remains the product information and entry page. See [what GitHub Pages hosts](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Public verification checklist

After all external services are configured, verify through the public Vercel URL:

1. Open the app and register a new synthetic user; log out and back in.
2. Complete onboarding, upload a small CV, transcript and TOEFL sample, and confirm each is processed.
3. Inspect the private Supabase bucket to verify original files persist. Download a file while signed in and confirm its short-lived signed URL works.
4. Add a scholarship and run analysis. Confirm eligibility uses the deterministic rules and the result includes a fit score, evidence, strengths, gaps and a roadmap.
5. Run a What-If simulation and verify it does not change the saved evidence or original analysis.
6. Try **Try Demo** from GitHub Pages and inspect the synthetic workspace.
7. Restart or wait for the Render service to sleep; confirm data persists and the wake-up message appears during cold starts.
8. Confirm the API works with no Redis/Celery services. If Gemini is configured, opt in with a synthetic document, run an assistant query and verify citations; opt back out afterward.
9. Check Vercel, Render and Supabase dashboards to confirm all resources are still on free tiers with no payment method or paid add-ons.

Do not describe the site as a verified live service until these checks pass. Build/test success in GitHub Actions is not deployment verification.
