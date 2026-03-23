# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Modular Monolith (Next.js App Router)

**Key Characteristics:**
- Single Next.js 16 application with App Router serving all concerns (marketing, tenant portal, API, superadmin)
- Multi-tenant architecture using `[tenant]` dynamic route segment mapped to `empresa_id`
- Server Components by default; client components explicitly opted-in with `"use client"`
- Three-tier tenant resolution: subdomain, custom domain, URL slug
- Business logic co-located with feature modules under `app/[tenant]/(modules)/`
- Supabase PostgreSQL as single data store with Row Level Security (RLS) for tenant isolation

## Layers

**Presentation Layer (Pages + Components):**
- Purpose: Render UI, handle user interaction
- Location: `app/[tenant]/(modules)/*/page.tsx`, `app/[tenant]/(modules)/*/components/`
- Contains: Server Components (page.tsx) that call `requireUser()` or `requireTenantUser()`, then render Client Components
- Depends on: Auth layer, Service layer (via API calls from client components)
- Used by: End users via browser

**API Layer (Route Handlers):**
- Purpose: RESTful endpoints consumed by client components via `fetch` / TanStack Query
- Location: `app/api/` organized by domain (e.g., `app/api/curso/`, `app/api/flashcards/`, `app/api/usuario/`)
- Contains: `route.ts` files exporting GET/POST/PUT/DELETE/PATCH handlers wrapped in auth middleware
- Depends on: Auth middleware, Service layer, Database clients
- Used by: Client components via `app/shared/library/api-client.ts`

**Auth Middleware Layer (API-level):**
- Purpose: Authenticate and authorize API requests
- Location: `app/[tenant]/auth/middleware.ts`
- Contains: `requireAuth()`, `requireUserAuth()`, `requireRole()`, `requirePermission()` HOF wrappers
- Pattern: Wraps route handlers, injects `request.user` or `request.apiKey` into `AuthenticatedRequest`
- Depends on: Supabase Auth (JWT / cookie), API Key service, Effective empresa resolution

**Service Layer:**
- Purpose: Business logic, data transformation, validation
- Location: `app/[tenant]/(modules)/*/services/` (module-specific), `app/shared/core/services/` (cross-cutting)
- Contains: Service classes/functions, repository classes, error types
- Pattern: Services use `getDatabaseClient()` (admin) or `getDatabaseClientAsUser()` (RLS-scoped)
- Depends on: Database clients, shared types
- Used by: API route handlers, Server Components

**Data Access Layer:**
- Purpose: Database interactions via Supabase client
- Location: `app/shared/core/database/database.ts`
- Contains: Two client factories:
  - `getDatabaseClient()` -- Service-role, bypasses RLS, cached as singleton
  - `getDatabaseClientAsUser(token)` -- User-scoped, respects RLS, per-request (never cached)
- Pattern: Repository Factory at `app/shared/core/repository-factory.ts` wraps clients for DI
- Depends on: Supabase SDK, environment variables

**Shared/Core Layer:**
- Purpose: Cross-cutting concerns shared across all modules
- Location: `app/shared/core/` (auth, DB, env, middleware), `app/shared/components/` (UI), `app/shared/types/` (entities)
- Contains: Auth utilities, cache service, rate limiting, tenant resolution, email, roles/permissions
- Used by: All other layers

## Data Flow

**Server Component Page Load:**

1. Browser requests `/{tenant}/dashboard`
2. Next.js middleware (`app/shared/core/middleware.logic.ts`) runs:
   - Resolves tenant from URL slug/subdomain/custom-domain via `resolveTenantContext()`
   - Sets `x-tenant-id` and `x-tenant-slug` headers on the request
   - Validates Supabase auth session (cookie or Bearer token)
   - Redirects to login if unauthenticated on protected route
3. `app/[tenant]/(modules)/layout.tsx` renders `DashboardLayout`:
   - Calls `requireUser()` (React `cache()`-wrapped)
   - Wraps children in providers: `UserProvider`, `BrandingProvider`, `StudentOrganizationsProvider`, `ModuleVisibilityProvider`
4. Module `page.tsx` renders, optionally calling `requireUser()` with role restrictions
5. Client components fetch data from `/api/*` endpoints using the API client

**Client-Side API Call (TanStack Query):**

1. Client component calls `apiClient.get('/api/curso')` (from `app/shared/library/api-client.ts`)
2. `apiClient` retrieves auth token from Supabase browser client session (cached in memory)
3. Request hits API route handler wrapped in `requireAuth()` or `requireUserAuth()`
4. Auth middleware:
   - Extracts user from Bearer token or cookie via Supabase `getUser()`
   - Maps Supabase user to `AuthUser` via `mapSupabaseUserToAuthUser()` (queries `usuarios_empresas`)
   - Resolves `effectiveEmpresaId` from `x-tenant-id` header (set by middleware on page load, forwarded by browser)
5. Handler executes business logic, returns JSON response
6. TanStack Query caches response client-side

**Webhook Processing (Stripe/Hotmart):**

1. External service POSTs to `/api/webhooks/stripe` or `/api/webhooks/hotmart`
2. Route handler verifies webhook signature
3. Uses `getDatabaseClient()` (service-role, bypasses RLS) for cross-tenant operations
4. Updates database records (subscriptions, enrollments, etc.)

**State Management:**

- **Server state:** TanStack Query v5 for data fetching, caching, and synchronization
- **Auth state:** React Context via `UserProvider` (hydrated from `requireUser()` in layout)
- **UI state:** React `useState` / `useReducer` in client components
- **Theme state:** `next-themes` for dark/light mode; cookie-persisted theme settings
- **Form state:** React Hook Form with Zod validation schemas

## Authentication Architecture

**Authentication Flow:**

```
Browser Cookie (sb-*-auth-token)
        |
        v
Next.js Middleware (middleware.logic.ts)
  - createServerClient with cookie getAll/setAll
  - supabase.auth.getUser() to validate JWT
  - Redirect to login if unauthenticated on protected route
        |
        v
Server Component Layout (requireUser)
  - fetchUserFromSupabase() (validates JWT)
  - Redis cache check (auth:session:{userId}, 30 min TTL)
  - On miss: hydrateUserProfile() queries usuarios, usuarios_empresas, papeis, empresas
  - Caches EssentialAuthSessionData to Redis
  - Returns AppUser with role, permissions, tenant context
        |
        v
API Route Middleware (requireAuth/requireUserAuth)
  - Extracts user from Bearer token or cookie
  - mapSupabaseUserToAuthUser() queries usuarios_empresas
  - Resolves effectiveEmpresaId from x-tenant-id header
  - Injects user into AuthenticatedRequest
```

**Authentication Methods:**
- Cookie-based (Supabase SSR cookies for page loads)
- Bearer token (Authorization header for API calls from client components)
- API Key (`x-api-key` header for external integrations, validated via `apiKeyService`)

**Session Caching:**
- `getAuthenticatedUser()` is wrapped in React `cache()` for per-request deduplication
- Auth session data cached in `cacheService` (in-memory Map) with 30-minute TTL (key: `auth:session:{userId}`)
- Cache invalidated via `invalidateAuthSessionCache(userId)` on logout, password change, role change

**Impersonation:**
- Admins can impersonate students within their tenant
- Impersonation context stored in httpOnly cookie (`impersonation_context`, 8h TTL)
- `getImpersonationContext()` reads cookie; `hydrateUserProfile()` loads impersonated user data
- Impersonation state cascades through all auth functions

**Superadmin Authentication:**
- Completely separate from tenant auth
- Uses same Supabase Auth but validates against `superadmins` table
- `requireSuperadmin()` and `requireSuperadminForAPI()` in `app/shared/core/services/superadmin-auth.service.ts`
- Routes under `/superadmin/` and `/api/superadmin/`

## Authorization Model

**Role System:**
- Three base roles (`PapelBase`): `aluno` (student), `professor` (teacher), `usuario` (staff)
- `isAdmin` flag elevates any role to full permissions (`ADMIN_PERMISSIONS`)
- `isOwner` flag marks the tenant creator
- Custom permissions via `papeis` table (for `usuario` role): `RolePermissions` object per resource

**Permission Checking:**
- `resolvePermissions(role, isAdmin, customPermissions?)` in `app/shared/core/roles.ts`
- `hasPermission(permissions, resource, action)` checks view/create/edit/delete per resource
- Convenience: `canView()`, `canCreate()`, `canEdit()`, `canDelete()`
- API-level: `requirePermission(resource, action)` middleware wrapper
- Page-level: `requireUser({ allowedRoles: ['professor', 'usuario'] })`

**Route Guards (Server Components):**
- `requireUser()` -- Enforces authentication, optionally checks roles, redirects to login
- `requireTenantUser(slug)` -- Ensures user belongs to the URL tenant
- `requireAlunoRoute()` / `requireProfessorRoute()` / `requireUsuarioRoute()` in `app/shared/core/route-guards.ts`

## Multi-Tenant Isolation Strategy

**Tenant Resolution (3 strategies in priority order):**
1. **Custom domain:** `empresas.dominio_customizado` lookup (e.g., `portal.escola.com.br`)
2. **Subdomain:** Extract from `{slug}.alumnify.com.br` host, lookup by `slug` or `subdomain`
3. **URL slug:** First path segment (e.g., `/escola-abc/dashboard`), lookup by `slug`

Resolution happens in middleware (`app/shared/core/services/tenant-resolution.service.ts`) and is cached in-memory (1 min TTL, max 1000 entries).

**Tenant Propagation:**
- Middleware sets `x-tenant-id` and `x-tenant-slug` headers on all requests
- Server Components read headers via `headers().get('x-tenant-id')`
- API routes use `getEffectiveEmpresaId(request, user)` to resolve tenant:
  - Checks `x-tenant-id` header + validates user belongs to that tenant
  - Falls back to `user.empresaId`

**Data Isolation:**
- **RLS policies** on Supabase enforce tenant isolation at the database level
- `getDatabaseClientAsUser(token)` respects RLS; used for user-facing queries
- `getDatabaseClient()` bypasses RLS; used only for system-level operations (admin, webhooks, cross-tenant)
- Multi-org students can access multiple tenants (validated via `userBelongsToTenant()` which checks `usuarios`, `matriculas`, `alunos_cursos`, and `usuarios_empresas` tables)

## Caching Strategy

**Layer 1: React `cache()` (Per-Request Deduplication):**
- `getAuthenticatedUser()` is wrapped in React `cache()` so multiple calls within the same request share one result
- `getAuthenticatedSuperadmin()` similarly cached

**Layer 2: In-Memory Cache Service (`app/shared/core/services/cache/cache.service.ts`):**
- Singleton `CacheService` backed by `Map` (server) or `Map` + `localStorage` (browser)
- Auth sessions cached with 30-min TTL (key: `auth:session:{userId}`)
- Terms acceptance cached (key: `empresa:{id}:aceite_termos_vigente`)
- Pattern: `cacheService.getOrSet(key, fetcher, ttl)` for cache-aside

**Layer 3: Tenant Resolution Cache (`app/shared/core/services/tenant-resolution.service.ts`):**
- In-memory `Map<string, CachedTenant>` with 1-minute TTL
- Key: `tenant:{host}:{slug}`
- Max 1000 entries (simple clear-all eviction)

**Layer 4: HTTP Cache Headers:**
- API responses set `Cache-Control: private, max-age=60, stale-while-revalidate=120` for tenant-scoped data

**Layer 5: TanStack Query (Client-Side):**
- Default stale/cache times configured per query
- Manages client-side data synchronization and background refetching

**Layer 6: Browser Client Singleton:**
- `app/shared/core/client.ts` caches Supabase browser client to avoid multiple auth refresh races
- Auth token cached in memory with expiry tracking (`app/shared/library/api-client.ts`)

## Key Abstractions

**AppUser (`app/shared/types/entities/user.ts`):**
- Purpose: Unified user representation across the application
- Contains: `id`, `email`, `role`, `permissions`, `isAdmin`, `isOwner`, `empresaId`, `empresaSlug`, `empresaNome`, `mustChangePassword`
- Created by: `hydrateUserProfile()` in `app/shared/core/auth.ts`

**AuthUser (`app/[tenant]/auth/types.ts`):**
- Purpose: Lightweight user type for API route auth middleware
- Contains: `id`, `email`, `role`, `roleType?`, `permissions?`, `isAdmin`, `empresaId?`, `name?`
- Created by: `mapSupabaseUserToAuthUser()` in `app/[tenant]/auth/middleware.ts`

**RepositoryFactory (`app/shared/core/repository-factory.ts`):**
- Purpose: Dependency injection for database access with correct RLS context
- Pattern: `factory.create(RepoClass)` instantiates a repository with the user-scoped client
- Three factory creators: `createRepositoryFactory()` (from session), `createRepositoryFactoryFromToken()`, `createServiceRepositoryFactory()` (admin)

**Service/Repository Pattern (Module Services):**
- Purpose: Separate business logic from data access
- Example: `app/[tenant]/(modules)/curso/services/curso.service.ts` (logic) + `curso.repository.ts` (queries)
- Some modules use service-only pattern (no separate repository): e.g., `flashcards.service.ts`
- Services instantiated via factory functions: `createFlashcardsService()`, or singleton: `cursoService`

**TenantContext (`app/shared/core/services/tenant-resolution.service.ts`):**
- Purpose: Resolved tenant information flowing through middleware
- Contains: `empresaId?`, `empresaSlug?`, `empresaNome?`, `resolutionType?` (subdomain | custom-domain | slug)

## Entry Points

**Next.js Middleware:**
- Location: Entry via `app/shared/core/middleware.logic.ts`, invoked by Next.js middleware configuration
- Triggers: Every HTTP request (except static assets)
- Responsibilities: Tenant resolution, session refresh, auth redirect, header injection

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: All page renders
- Responsibilities: HTML shell, theme providers, global CSS, analytics, toast notifications

**Dashboard Layout:**
- Location: `app/[tenant]/(modules)/layout.tsx` (delegates to `app/shared/components/layout/dashboard-layout.tsx`)
- Triggers: All module page renders
- Responsibilities: Auth enforcement, sidebar/header/bottom-nav rendering, provider tree (User, Branding, Organizations, ModuleVisibility)

**API Route Handlers:**
- Location: `app/api/*/route.ts`
- Triggers: Client-side fetch calls
- Responsibilities: Auth verification, business logic execution, JSON response

## Error Handling

**Strategy:** Layer-specific error handling with custom error classes

**Patterns:**
- **API Routes:** Try/catch in handlers; custom error classes (e.g., `CourseValidationError`, `CourseConflictError`) map to appropriate HTTP status codes (400, 409, etc.); generic errors return 500
- **Auth:** Redirect to login on missing/invalid session; return 401 JSON for API routes
- **Services:** Throw custom error classes; callers catch and map to HTTP responses
- **Client Components:** TanStack Query error states; toast notifications via Sonner
- **Middleware:** Auth failures return 401 JSON (API) or 302 redirect (pages)

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` / `console.warn` with tagged prefixes (e.g., `[MW]`, `[AUTH DEBUG]`, `[flashcards API]`). Middleware has configurable log levels (`LOG_LEVEL` env var).

**Validation:**
- Environment variables: Zod schema in `app/shared/core/env.ts`
- API request bodies: Manual validation in route handlers; some use Zod
- Form inputs: React Hook Form + Zod schemas (client-side)

**Rate Limiting:** In-memory sliding window counter per tenant in `app/shared/core/services/rate-limit/rate-limit.service.ts`. Configurable per plan (basico: 100/min, profissional: 500/min, enterprise: 2000/min). Optional per-tenant quota overrides.

**Plan Limits:** `app/shared/core/services/plan-limits.service.ts` checks subscription-based feature limits (e.g., course count) before creating resources.

**Cookie Compression:** `app/shared/core/cookie-compression.ts` uses pako (zlib) to compress/decompress auth cookies (currently disabled for new cookies; reads old compressed cookies for backward compatibility).

**OpenAPI Documentation:** Swagger specs in `app/shared/swagger/*.spec.ts` for API documentation.

---

*Architecture analysis: 2026-03-23*
