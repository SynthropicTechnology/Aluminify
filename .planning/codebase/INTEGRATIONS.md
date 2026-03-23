# External Integrations

**Analysis Date:** 2026-03-23

## APIs & External Services

### Supabase (Core Platform)

The entire backend is built on Supabase. It provides database, authentication, storage, and RLS-based tenant isolation.

- **SDK/Client:** `@supabase/supabase-js` `^2.84.0`, `@supabase/ssr` `^0.8.0`
- **Auth:** `SUPABASE_URL`, `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`
- **Client patterns:**
  - Service role (bypasses RLS): `getDatabaseClient()` in `app/shared/core/database/database.ts`
  - User-scoped (respects RLS): `getDatabaseClientAsUser(token)` in `app/shared/core/database/database.ts`
  - Server component client: `createClient()` in `app/shared/core/server.ts`
  - Browser client: `createClient()` in `app/shared/core/client.ts`
- **Public config helper:** `getPublicSupabaseConfig()` in `app/shared/core/supabase-public-env.ts`

### Stripe (Payments & Subscriptions)

Stripe handles subscription billing for multi-tenant SaaS plans (basico, profissional, enterprise).

- **SDK:** `stripe` `^20.4.1`
- **Client:** `getStripeClient()` in `app/shared/core/services/stripe.service.ts` (singleton, cached)
- **Auth:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **API Routes:**
  - `app/api/stripe/checkout/route.ts` - Creates Checkout Sessions for subscription purchases
  - `app/api/stripe/portal/route.ts` - Creates Billing Portal Sessions for subscription management
- **Webhook:** `app/api/webhooks/stripe/route.ts` (POST `/api/webhooks/stripe`)
  - Events handled: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Signature validation via `stripe.webhooks.constructEvent()`
  - Global webhook secret (single Stripe account for all tenants)

### Hotmart (Payment Provider - Per-Tenant)

Hotmart integration for Brazilian education payment processing. Each tenant configures its own Hotmart webhook secret.

- **No SDK** - Uses webhook payload parsing only
- **Auth:** Per-tenant `webhook_secret` stored in `payment_providers` database table
- **Webhook:** `app/api/webhooks/hotmart/route.ts` (POST `/api/webhooks/hotmart?empresaId=<id>`)
  - Events handled: PURCHASE_APPROVED, PURCHASE_COMPLETE, PURCHASE_CANCELED, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK, PURCHASE_PROTEST, PURCHASE_DELAYED, SUBSCRIPTION_CANCELLATION, SWITCH_PLAN, CLUB_FIRST_ACCESS
  - Hottok validation via `X-HOTMART-HOTTOK` header
- **Service:** `app/[tenant]/(modules)/financeiro/services/` - Financial service processes webhook payloads
- **Types:** `app/[tenant]/(modules)/financeiro/services/financial.types.ts`

### N8N (Workflow Automation / AI Chat Backend)

The "Tobias" AI chatbot sends messages to an N8N webhook for processing.

- **No SDK** - Direct `fetch()` to webhook URL
- **Webhook URL:** Hardcoded in `app/tobias/services/chat/chat.service.ts` - `https://webhook.sinesys.app/webhook/9e35cb81-5314-4f09-bbde-0d587a8eb6db`
- **API Routes:**
  - `app/api/tobias/chat/route.ts` - Send chat message (with file attachment support)
  - `app/api/tobias/chat/attachments/[id]/route.ts` - Serve uploaded attachments
  - `app/api/tobias/chat/attachments/[id]/[filename]/route.ts` - Serve attachments by filename
  - `app/api/tobias/conversations/route.ts` - Manage conversations
  - `app/api/tobias/conversations/[id]/route.ts` - Single conversation operations
- **Services:**
  - `app/tobias/services/chat/chat.service.ts` - Chat message dispatch and response parsing
  - `app/tobias/services/chat/attachments.service.ts` - File upload handling for chat attachments
  - `app/tobias/services/conversation/` - Conversation persistence

### OpenAI / Vercel AI SDK

AI SDK is installed and configured but does not appear to be directly imported in application code (AI chat flows go through N8N). The AI agents service manages agent configurations stored in the database.

- **SDK:** `@ai-sdk/openai` `^3.0.21`, `openai` `^6.16.0`, `ai` `^5.0.52` (override)
- **Service:** `app/shared/services/ai-agents/ai-agents.service.ts` - CRUD for AI agent configurations
- **Repository:** `app/shared/services/ai-agents/ai-agents.repository.ts` - Database access for agents
- **API Route:** `app/api/ai-agents/[empresaId]/route.ts` - Fetch agent configs per tenant

## Data Storage

**Database:**
- Supabase PostgreSQL (managed)
  - Connection: `SUPABASE_URL`
  - ORM/Client: `@supabase/supabase-js` (typed via auto-generated `app/shared/core/database.types.ts`)
  - Migrations: `supabase/migrations/`
  - Seed: `supabase/seed.sql`
  - pgcrypto extension used for OAuth credential encryption (`pgp_sym_encrypt`)

**File Storage:**
- Supabase Storage - Used via Supabase client for file uploads
  - Image optimization configured for `*.supabase.co` remote patterns in `next.config.ts`
- Local filesystem - Temporary chat attachment storage (via `app/tobias/services/chat/attachments.service.ts`)

**Caching:**
- In-memory Map (server-side) + LocalStorage (browser-side)
  - Implementation: `app/shared/core/services/cache/cache.service.ts`
  - Singleton via `globalThis` for HMR persistence
  - Prefixed keys: `aluminify:v1:cache:`
  - Can be disabled via `CACHE_DISABLED` env var
  - No Redis or external cache service

**Specialized Cache Services:**
- `app/shared/core/services/cache/activity-cache.service.ts` - Activity caching
- `app/shared/core/services/cache/course-structure-cache.service.ts` - Course structure caching
- `app/shared/core/services/cache/user-profile-cache.service.ts` - User profile caching
- `app/shared/core/services/cache/cache-monitor.service.ts` - Cache monitoring
- `app/shared/core/services/cache/response-store.ts` - Response storage

## Authentication & Identity

**Auth Provider:** Supabase Auth
- **Implementation:** Cookie-based SSO via `@supabase/ssr`
- **Server-side auth:** `getAuthenticatedUser()` in `app/shared/core/auth.ts` (React `cache()` wrapped)
- **Role enforcement:** `requireUser(options?)` in `app/shared/core/auth.ts`
- **Session caching:** In-memory cache with 30-minute TTL, keyed by `auth:session:{userId}`
- **Session invalidation:** `invalidateAuthSessionCache(userId)` - Call on logout, password change, role change
- **Cookie compression:** `app/shared/core/cookie-compression.ts` - Uses `pako` (deflate) to compress large auth cookies

**Roles System:**
- Base roles (`PapelBase`): `aluno` (student), `professor`, `usuario` (staff)
- `isAdmin` and `isOwner` flags from `usuarios_empresas` table
- Permission resolution: `resolvePermissions(role, isAdmin, customPermissions?)` in `app/shared/core/roles.ts`
- Permission checking: `hasPermission(permissions, resource, action)` in `app/shared/core/roles.ts`

**OAuth (Per-Tenant):**
- Providers: Google, Zoom (per-tenant OAuth app credentials)
- Credentials stored encrypted in `empresa_oauth_credentials` table (pgcrypto `pgp_sym_encrypt`)
- Encryption key: `OAUTH_ENCRYPTION_KEY` env var (minimum 32 characters)
- Service: `app/shared/core/services/oauth-credentials/oauth-credentials.service.ts`
- UI: `app/[tenant]/(modules)/settings/integracoes/components/oauth-credentials-form.tsx`
- Actions: `app/[tenant]/(modules)/settings/integracoes/lib/oauth-actions.ts`
- Login buttons: `app/[tenant]/auth/components/oauth-buttons.tsx`

**Impersonation:**
- Admin users can impersonate students
- Implementation: `app/shared/core/auth-impersonate.ts`
- Cache key includes impersonated user ID: `auth:session:{userId}:imp:{impersonatedUserId}`

**API Key Authentication:**
- Service: `app/shared/core/services/api-key/api-key.service.ts`
- Hashed storage, expiration support, per-tenant scoping

## Monitoring & Observability

**Error Tracking:**
- Sentry (`@sentry/nextjs` `^10.38.0`)
  - Org: `sinesystech`, Project: `aluminify`
  - Server config: `sentry.server.config.ts`
  - Edge config: `sentry.edge.config.ts`
  - Wrapped via `withSentryConfig()` in `next.config.ts`
  - Source maps uploaded in CI
  - Optional tunnel route at `/monitoring` (production only, enabled via `SENTRY_TUNNEL_ROUTE=true`)
  - Trace sample rate: 100% (1.0)
  - PII sending enabled

**Analytics:**
- Google Analytics 4 via `react-ga4` `^2.1.0`
  - Initialization: `app/shared/core/ga.ts` (client component)
  - Env var: `NEXT_PUBLIC_GA_MEASUREMENT_ID`

**Observability:**
- OpenTelemetry packages installed (`@opentelemetry/api`, `@opentelemetry/instrumentation`, `@opentelemetry/semantic-conventions`)
  - Pulled in as Sentry dependency; no custom instrumentation file detected in project root

**Logs:**
- `console.log` / `console.error` with structured prefixes (e.g., `[Stripe Webhook]`, `[Chat API]`, `[MW]`)
- Configurable log levels in middleware: `LOG_LEVEL` env var (`debug`, `info`, `warn`, `error`, `none`)
- Development-only debug logging in auth: `[AUTH DEBUG]` prefix

**Health Check:**
- `app/api/health/route.ts` (GET `/api/health`)
- Returns: status, timestamp, uptime, environment, email integration status
- Used by Docker HEALTHCHECK (30s interval, 10s timeout, 3 retries)

## CI/CD & Deployment

**Hosting:**
- Docker (primary) - Multi-stage Dockerfile with standalone output
  - Base: `node:22-alpine`
  - Non-root user (`nextjs:nodejs`)
  - Sharp installed for image optimization
  - Memory: 2GB runtime, 4GB build
- Cloudron - `CloudronManifest.json` with sendmail addon
  - App ID: `io.aluminify.app`
  - Memory limit: 2GB
- Vercel - Supported (default Next.js SSR output, Sentry Vercel Cron Monitors)

**Docker Compose Variants:**
- `docker-compose.yml` - Development (hot-reload volumes, builder target)
- `docker-compose.prod.yml` - Production
- `docker-compose.traefik.yml` - With Traefik reverse proxy
- `docker-compose.portainer.yml` - For Portainer management

**CI Pipeline:**
- Check scripts:
  - `npm run check:quick` - Lint + typecheck + color validation
  - `npm run check` - Quick check + tests
  - `npm run check:ci` - Zero-warnings tolerance lint + typecheck + colors + tests
- Docker build: `npm run docker:push` (runs `scripts/5-geral/infra/docker-build-and-push.sh`)

**API Documentation:**
- Swagger/OpenAPI via `swagger-jsdoc` and `swagger-ui-react`
- Endpoint: `app/api/docs/route.ts` (GET `/api/docs`)
- Spec generation: `app/shared/swagger/`

## Email / Notifications

**Email Provider:** Configurable SMTP (Cloudron sendmail or custom)
- Implementation: `app/shared/core/email.ts`
- Transport: `nodemailer` `^8.0.3`
- Provider priority: Cloudron sendmail > Custom SMTP > None
- Cloudron env vars: `CLOUDRON_MAIL_SMTP_SERVER`, `CLOUDRON_MAIL_SMTP_PORT`, `CLOUDRON_MAIL_SMTP_USERNAME`, `CLOUDRON_MAIL_SMTP_PASSWORD`, `CLOUDRON_MAIL_FROM`
- Custom SMTP env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`
- Functions: `getEmailConfig()`, `createEmailTransport()`, `getEmailRuntimeStatus()`

## Rate Limiting

**Implementation:** In-memory sliding window counter (no external service)
- Service: `app/shared/core/services/rate-limit/rate-limit.service.ts`
- Per-tenant rate limits based on plan:
  - `basico`: 100 req/min
  - `profissional`: 500 req/min
  - `enterprise`: 2000 req/min
- Supports per-tenant quota overrides from database
- Singleton: `rateLimitService`

## Plan/Subscription Limits

**Implementation:** Database-driven plan limits
- Service: `app/shared/core/services/plan-limits.service.ts`
- Limits tracked: `max_active_students`, `max_courses`, `max_storage_mb`, `allowed_modules`
- Grace period: 7 days after subscription goes `past_due`

## Tenant Resolution

**Multi-tenant routing strategies:**
- Subdomain resolution
- Custom domain mapping
- URL slug-based (`/[tenant]/...`)
- Service: `app/shared/core/services/tenant-resolution.service.ts`
- In-memory cache: 1-minute TTL, max 1000 entries
- Primary domain: `NEXT_PUBLIC_PRIMARY_DOMAIN` (default: `alumnify.com.br`)

## Environment Configuration

**Required env vars:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` - Service role key (one required)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` or `SUPABASE_ANON_KEY` - Anon key (one required)
- `OAUTH_ENCRYPTION_KEY` - 32+ char encryption key

**Optional env vars:**
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics
- `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` - Sentry
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe
- `SMTP_*` / `CLOUDRON_MAIL_*` - Email
- `CACHE_DISABLED` / `NEXT_PUBLIC_CACHE_DISABLED` - Disable caching
- `LOG_LEVEL` - Middleware log level
- `NEXT_PUBLIC_PRIMARY_DOMAIN` - Primary domain for tenant resolution
- `NEXT_PUBLIC_API_URL` / `PUBLIC_API_URL` - Public base URL for external callbacks
- `DOCKER_BUILD` - Flag for Docker build context
- `SENTRY_TUNNEL_ROUTE` - Enable Sentry tunnel route

**Secrets location:**
- Environment variables (`.env.local` for development, Docker env vars for production)
- `.env.example` documents all variables
- `.env.docker.example` for Docker-specific configuration
- OAuth credentials encrypted in database (pgcrypto)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/stripe` - Stripe subscription events (signature validated)
- `POST /api/webhooks/hotmart?empresaId=<id>` - Hotmart purchase/subscription events (hottok validated)

**Outgoing:**
- Chat messages dispatched to N8N webhook (`https://webhook.sinesys.app/webhook/...`) from `app/tobias/services/chat/chat.service.ts`
- Attachment download URLs generated for N8N consumption (via `getPublicBaseUrl()`)

---

*Integration audit: 2026-03-23*
