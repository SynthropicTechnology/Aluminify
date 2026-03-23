# Codebase Concerns

**Analysis Date:** 2026-03-23

## Tech Debt

**Legacy RoleTipo System Still Pervasive:**
- Issue: `RoleTipo` is marked `@deprecated` in `app/shared/types/entities/papel.ts:10-15` but remains actively used across 40+ files. The intended replacement is `PapelBase` + `isAdmin` boolean flag, but migration is incomplete.
- Files:
  - `app/shared/types/entities/papel.ts` (definition + legacy `DEFAULT_PERMISSIONS` map at line 182)
  - `app/shared/core/auth.ts:26,105,196` (imports and uses RoleTipo in hydrateUserProfile)
  - `app/shared/core/roles.ts:70-88` (legacy helper functions `isTeachingRoleTipo`, `isAdminRoleTipo`)
  - `app/[tenant]/auth/middleware.ts:8,48,59` (auth middleware maps to RoleTipo)
  - `app/[tenant]/(modules)/usuario/services/permission.service.ts:19,47,49,193,205,218,308,316`
  - `app/[tenant]/(modules)/usuario/services/user-role-identifier.service.ts:3,313,319`
  - `app/[tenant]/(modules)/usuario/services/papel.repository.ts:15,29,40,41,67,85`
  - `app/[tenant]/(modules)/settings/papeis/papeis-list-client.tsx` (42 references)
  - `app/shared/utils/papel-display.ts:5-27`
  - `app/api/usuario/perfil/route.ts:6,34,78`
  - `app/api/empresa/[id]/papeis/route.ts:5,80`
  - `app/shared/components/providers/permission-provider.tsx:4,9,23`
- Impact: Dual permission model creates confusion. New code must support both systems. Risk of inconsistent permission checks.
- Fix approach: Complete migration to `PapelBase` + `isAdmin`. Remove `RoleTipo` type, `DEFAULT_PERMISSIONS` record, `TEACHING_ROLES`, `ADMIN_ROLES` constants. Update all consuming files to use `PapelBase`, `DEFAULT_PERMISSIONS_BY_PAPEL_BASE`, and `ADMIN_PERMISSIONS`.

**Deprecated Service Factory Functions:**
- Issue: Several modules export deprecated factory functions that create service-role clients, bypassing RLS. These are kept for backward compatibility but should be replaced with user-scoped clients.
- Files:
  - `app/[tenant]/(modules)/curso/services/index.ts:23,36,46` (`cursoService`, `courseService`)
  - `app/[tenant]/(modules)/usuario/services/index.ts:36,73` (`studentService`, `teacherService`)
  - `app/[tenant]/(modules)/empresa/services/index.ts:46` (`empresaService`)
  - `app/[tenant]/(modules)/curso/services/material.service.ts:252` (`materialCursoService`)
- Impact: Using service-role clients for user-facing queries undermines tenant isolation.
- Fix approach: Replace deprecated singletons with `createXxxService(userClient)` pattern throughout.

**Deprecated Type Files:**
- Issue: Multiple modules still maintain their own type files marked `@deprecated`, pointing to shared types that should be used instead.
- Files:
  - `app/[tenant]/(modules)/curso/services/curso.types.ts:2`
  - `app/[tenant]/(modules)/curso/services/material.types.ts:2`
  - `app/[tenant]/(modules)/sala-de-estudos/services/atividades/atividade.types.ts:2`
  - `app/[tenant]/(modules)/sala-de-estudos/services/atividades/progresso.types.ts:2`
  - `app/[tenant]/(modules)/usuario/services/teacher.types.ts:2`
  - `app/[tenant]/(modules)/usuario/services/student.types.ts:2`
  - `app/shared/types/enums/index.ts:24` (ModalityEntity)
  - `app/shared/hooks/use-mobile.ts:2` (entire module deprecated)
  - `app/shared/hooks/use-breakpoint.ts:117,128`
- Impact: New code may import from wrong location. Duplicate type definitions can diverge.
- Fix approach: Remove deprecated type files. Update all imports to use `@/app/shared/types`.

**TobIAs Legacy System Pending Removal:**
- Issue: The TobIAs (AI chat) system is marked for removal across multiple files with `TOBIAS-LEGACY` comments.
- Files:
  - `app/tobias/` (entire directory: 14 files including components and services)
  - `app/shared/services/ai-agents/ai-agents.types.ts:12`
  - `app/shared/core/middleware.logic.ts:103`
  - `app/shared/components/layout/dynamic-breadcrumb.tsx:99`
  - `app/api/tobias/` (API routes for conversations and chat)
- Impact: Dead code increases maintenance burden and bundle size.
- Fix approach: Delete `app/tobias/` directory, `app/api/tobias/` routes, and all TOBIAS-LEGACY references.

**Oversized Files Need Decomposition:**
- Issue: Several files exceed 1000 lines, indicating god-object patterns or mixed responsibilities.
- Files:
  - `app/[tenant]/(modules)/cronograma/services/cronograma.service.ts` (3,524 lines) - Contains schedule generation, distribution, statistics, and export logic all in one service
  - `app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service.ts` (3,495 lines) - 82 `.from()` calls, monolithic analytics
  - `app/[tenant]/(modules)/cronograma/components/schedule-calendar-view.tsx` (3,105 lines) - Single UI component
  - `app/[tenant]/(modules)/flashcards/services/flashcards.service.ts` (2,630 lines) - 84 console.log calls
  - `app/[tenant]/(modules)/curso/(gestao)/conteudos/components/structure-client.tsx` (2,496 lines)
  - `app/[tenant]/(modules)/cronograma/components/schedule-wizard.tsx` (2,474 lines)
  - `app/[tenant]/(modules)/curso/components/curso-table.tsx` (1,857 lines)
  - `app/[tenant]/(modules)/usuario/components/aluno-table.tsx` (1,847 lines)
  - `app/[tenant]/(modules)/usuario/services/student.repository.ts` (1,189 lines)
- Impact: Hard to test, review, and maintain. High risk of merge conflicts.
- Fix approach: Extract sub-services (e.g., `cronograma-generation.service.ts`, `cronograma-statistics.service.ts`). Break large components into smaller composable components.

**Inconsistent Database Client Creation Patterns:**
- Issue: Three API route files create their own admin clients with `createSupabaseClient()` and `process.env.*!` non-null assertions instead of using the centralized `getDatabaseClient()`.
- Files:
  - `app/api/empresa/[id]/usuarios/route.ts:14-24` (local `createAdminClient()`)
  - `app/api/empresa/[id]/usuarios/[usuarioId]/route.ts:15-24` (local `createAdminClient()`)
  - `app/api/empresa/[id]/professores/route.ts:12-22` (local `createAdminClient()`)
  - `app/api/webhooks/stripe/route.ts:26-40` (local `getServiceClient()`)
- Impact: Bypasses centralized env validation from `app/shared/core/env.ts`. Non-null assertions (`!`) on env vars can cause runtime crashes without helpful error messages.
- Fix approach: Replace all local `createAdminClient()` / `getServiceClient()` with `getDatabaseClient()` from `app/shared/core/database/database.ts`.

**Excessive Console Logging in Production Code:**
- Issue: 1,421 `console.log/warn/error` occurrences across 306 files in the `app/` directory. Many are debug statements left in production code, especially in services.
- Files (worst offenders):
  - `app/[tenant]/(modules)/cronograma/services/cronograma.service.ts` - extensive diagnostic logging (lines 873-899)
  - `app/[tenant]/(modules)/flashcards/services/flashcards.service.ts` - 84 console statements
  - `app/[tenant]/(modules)/cronograma/components/schedule-calendar-view.tsx` - 102 console statements
  - `app/[tenant]/(modules)/cronograma/components/schedule-wizard.tsx` - 52 console statements
  - `app/[tenant]/(modules)/cronograma/components/schedule-dashboard.tsx` - 44 console statements
  - `app/api/webhooks/stripe/route.ts` - 19 console statements
- Impact: Noise in production logs, potential data leakage, performance overhead.
- Fix approach: Replace with structured logging. Use the middleware log-level pattern (`app/shared/core/middleware.logic.ts:17-48`) as template. Guard debug logs with `NODE_ENV` checks or remove them.

## Security Considerations

**No Zod Validation on Any API Route:**
- Risk: 0 out of 155 API route files use Zod (or any schema validation) on incoming request bodies. All API routes parse JSON without validation (e.g., `await request.json()`).
- Files: All routes in `app/api/` (155 files)
- Current mitigation: TypeScript type assertions (`as { ... }`) provide compile-time type hints but no runtime validation.
- Recommendations: Add Zod schemas for all POST/PUT/PATCH request bodies. The env validation pattern in `app/shared/core/env.ts` is a good model to follow.

**Inconsistent Auth Protection on API Routes:**
- Risk: API routes use three different auth patterns, and some routes may lack protection entirely.
- Files:
  - Pattern 1: `requireUserAuth(handler)` / `requireAuth(handler)` wrapper (used by ~50% of routes)
  - Pattern 2: Inline `supabase.auth.getUser()` check (e.g., `app/api/usuario/perfil/route.ts:17-25`)
  - Pattern 3: Direct export without any auth (e.g., `app/api/superadmin/metricas/route.ts`, `app/api/superadmin/usuarios/route.ts`, `app/api/superadmin/faturas/route.ts` - rely on middleware path-based bypass)
- Current mitigation: Middleware in `app/shared/core/middleware.logic.ts` skips auth for paths like `/api/superadmin` and handles it at the app layer. But this depends on the middleware running.
- Recommendations: Standardize on `requireAuth()` / `requireUserAuth()` for all API routes. For superadmin routes, use `requireSuperadminForAPI()` wrapper consistently.

**Heavy Use of Service-Role Client (getDatabaseClient) in User-Facing Code:**
- Risk: `getDatabaseClient()` is called 181 times across 100 files, including many user-facing API routes and services. This client bypasses all RLS policies. `getDatabaseClientAsUser()` is only used 31 times across 12 files.
- Files: All files listed in the `getDatabaseClient()` grep results. Notable user-facing paths:
  - `app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service.ts` (9 calls)
  - `app/[tenant]/(modules)/cronograma/services/cronograma.service.ts` (5 calls)
  - `app/[tenant]/auth/services/auth.service.ts` (5 calls)
  - `app/[tenant]/(modules)/usuario/services/student.service.ts` (4 calls)
- Current mitigation: Some services manually filter by `empresa_id` after fetching, but this is error-prone.
- Recommendations: Migrate user-facing queries to `getDatabaseClientAsUser(token)` to enforce RLS at the database level. Reserve `getDatabaseClient()` for admin operations, migrations, and webhook handlers only.

**Non-null Assertions on Environment Variables:**
- Risk: Seven instances of `process.env.VARIABLE!` bypass the Zod validation in `app/shared/core/env.ts`.
- Files:
  - `app/api/empresa/[id]/usuarios/route.ts:15-16`
  - `app/api/empresa/[id]/usuarios/[usuarioId]/route.ts:16-17`
  - `app/api/empresa/[id]/professores/route.ts:13-14`
  - `app/api/usuario/avatar/create-bucket/route.ts:29`
- Current mitigation: These env vars are validated elsewhere in the app lifecycle, but these files bypass that.
- Recommendations: Use `env.SUPABASE_URL` and `env.SUPABASE_SECRET_KEY` from `app/shared/core/env.ts` instead of raw `process.env`.

**`as any` Type Assertions in Production Code:**
- Risk: Approximately 30 `as any` assertions in application code (excluding tests) suppress type checking.
- Files (key production code instances):
  - `app/shared/core/auth.ts:218` - user metadata mutation
  - `app/shared/core/cookie-compression.ts:17,26` - Buffer usage
  - `app/shared/core/middleware.logic.ts:544,546,549,551` - globalThis mutations
  - `app/[tenant]/(modules)/usuario/services/student.repository.ts:158,859` - quota_extra field
  - `app/[tenant]/(modules)/agendamentos/lib/appointment-actions.ts:690` - supabase RPC call
  - `app/[tenant]/(modules)/agendamentos/lib/recurrence-actions.ts:388` - RPC function name
  - `app/[tenant]/(modules)/sala-de-estudos/services/sala-estudos.service.ts:141` - runtime type narrowing
  - `app/api/curso/modalidades/route.ts:23` - table name not in generated types
- Impact: Runtime type errors become possible. Masks legitimate type mismatches.
- Fix approach: Update `app/shared/core/database.types.ts` to include missing tables (e.g., `modalidades_curso`). Use proper type guards instead of `as any`.

## Performance Concerns

**Excessive `select("*")` Queries:**
- Problem: 135 occurrences of `.select("*")` across 41 files fetch all columns from database tables, including potentially large text fields and unused data.
- Files: Spread across repositories and API routes. Key examples:
  - `app/shared/services/ai-agents/ai-agents.repository.ts` (6 occurrences)
  - `app/[tenant]/(modules)/sala-de-estudos/services/atividades/` (multiple repositories)
  - `app/[tenant]/(modules)/curso/services/material.repository.ts` (5 occurrences)
  - `app/[tenant]/(modules)/usuario/services/student.repository.ts` (14 occurrences)
- Cause: Default Supabase query pattern is `select("*")` which is convenient but wasteful.
- Improvement path: Specify only needed columns in select statements. Create typed select constants per query use case.

**Dashboard Analytics Service - Monolithic Data Fetching:**
- Problem: `app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service.ts` is 3,495 lines with 82 `.from()` database calls. Each dashboard load likely triggers many sequential queries.
- Files: `app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service.ts`
- Cause: All analytics logic in a single service with no query batching or aggregation at the database level.
- Improvement path: Use PostgreSQL views or functions for complex aggregations. Implement server-side caching for computed analytics. Break into focused sub-services.

**In-Memory Cache Without Eviction Policy:**
- Problem: `app/shared/core/services/cache/cache.service.ts` uses an in-memory `Map` with TTL-based expiry but no size limit. On long-running server processes, this can grow unbounded.
- Files: `app/shared/core/services/cache/cache.service.ts`
- Cause: Simple implementation without LRU or max-size constraints.
- Improvement path: Add a max-size limit with LRU eviction, or migrate to Redis for production caching. The `auth:session:*` keys cached here (line 51 in auth.ts) accumulate with each unique user.

**Rate Limiting Service Exists But Is Not Used:**
- Problem: `app/shared/core/services/rate-limit/rate-limit.service.ts` provides per-tenant rate limiting, but `rateLimitService.checkLimit()` is not called in any API route.
- Files:
  - `app/shared/core/services/rate-limit/rate-limit.service.ts` (174 lines, fully implemented)
  - Zero usages in `app/api/` routes
- Cause: Service was implemented but never integrated.
- Improvement path: Add rate limiting middleware to API routes, especially write operations and auth endpoints. Apply per-tenant limits at the middleware level.

**Static Data Files Imported at Runtime:**
- Problem: `app/shared/components/ui/phone-input/countries.ts` is 12,968 lines of static country data. `app/shared/components/calendar/demo/time-zones.ts` is 2,548 lines.
- Files:
  - `app/shared/components/ui/phone-input/countries.ts` (12,968 lines)
  - `app/shared/components/calendar/demo/time-zones.ts` (2,548 lines)
- Cause: Large static datasets bundled as TypeScript.
- Improvement path: Lazy-load these via dynamic imports. Consider JSON files with tree-shaking. The `calendar/demo/` directory may be removable entirely.

## Scalability Concerns

**Multi-Tenant Isolation Depends on Application Logic, Not Database RLS:**
- Problem: Since `getDatabaseClient()` (service-role, bypasses RLS) is used 181 times vs `getDatabaseClientAsUser()` (respects RLS) only 31 times, tenant isolation primarily depends on application-level `empresa_id` filters rather than database-enforced RLS.
- Files: All services using `getDatabaseClient()`, particularly:
  - `app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service.ts`
  - `app/[tenant]/(modules)/cronograma/services/cronograma.service.ts`
  - `app/[tenant]/(modules)/flashcards/services/flashcards.service.ts`
  - `app/[tenant]/(modules)/usuario/services/student.service.ts`
- Limit: A single missed `empresa_id` filter results in cross-tenant data leakage.
- Scaling path: Systematically migrate to `getDatabaseClientAsUser()` with proper RLS policies. Audit all service-role usages to confirm `empresa_id` filtering.

**In-Memory Rate Limiting and Caching Not Shared Across Instances:**
- Problem: Both `rateLimitService` and `cacheService` use in-memory `Map` storage, which does not replicate across multiple server instances (e.g., Vercel serverless functions, container replicas).
- Files:
  - `app/shared/core/services/rate-limit/rate-limit.service.ts:50` (`Map` storage)
  - `app/shared/core/services/cache/cache.service.ts:11` (`Map` storage)
- Limit: Rate limits are per-instance, not per-tenant. Cache misses on every cold start.
- Scaling path: Migrate to Redis or Upstash for shared state. The cache service claims Redis support in auth.ts comments but actually uses in-memory `Map`.

**Legacy Data Model Dual Structures:**
- Problem: Student-to-organization relationships exist in both new (`usuarios_empresas`, `matriculas`) and legacy (`alunos_cursos -> cursos -> empresas`) structures. Code must query both.
- Files:
  - `app/[tenant]/(modules)/usuario/services/student-organizations.service.ts:136,147,213,216,295`
  - `app/[tenant]/(modules)/flashcards/services/flashcards.service.ts:171-186,948`
  - `app/[tenant]/(modules)/usuario/services/user-role-identifier.service.ts:396,457`
  - `app/api/auth/validate-tenant/route.ts:88`
  - `app/shared/core/effective-empresa.ts:48`
- Limit: Every student lookup doubles the query count. Legacy data can become inconsistent with new model.
- Scaling path: Complete data migration from `alunos_cursos` to `matriculas`. Remove legacy query paths. Mark `alunos_cursos` table as read-only, then drop.

## Missing or Incomplete

**No Error Boundaries:**
- What's missing: Zero `error.tsx` files exist in the `app/` directory. No React Error Boundary components found anywhere in the codebase.
- Files: Expected at `app/error.tsx`, `app/[tenant]/error.tsx`, `app/[tenant]/(modules)/error.tsx` at minimum
- Risk: Any unhandled error in a Server Component crashes the entire page with a generic Next.js error screen. No graceful degradation or error recovery.
- Priority: High

**No Loading States (Next.js loading.tsx):**
- What's missing: Zero `loading.tsx` files in the `app/` directory. While some components use inline loading states via React Suspense, there are no route-level loading indicators.
- Files: Expected at `app/[tenant]/(modules)/loading.tsx` and key module routes
- Risk: Users see blank screens during server-side data fetching. Only 30 files use `Suspense` or `loading` patterns across the entire app.
- Priority: Medium

**No Not-Found Pages for Module Routes:**
- What's missing: Only 2 `not-found.tsx` files exist (`app/not-found.tsx`, `app/[tenant]/not-found.tsx`). Module-level routes lack custom 404 handling.
- Files: Missing from all `app/[tenant]/(modules)/*/` routes
- Risk: Invalid module URLs show generic 404 pages without navigation context.
- Priority: Low

**Deprecated Course Fields Still Present:**
- What's not tested: `disciplineId`, `hotmartProductId` fields in `app/shared/types/entities/course.ts:12,34,48,61,72,85` are marked deprecated but still defined in the type. The `disciplina_id` field in `app/[tenant]/(modules)/curso/(gestao)/conteudos/components/structure-client.tsx:64-65` is similarly deprecated.
- Files: `app/shared/types/entities/course.ts`, `app/shared/types/entities/activity.ts:343,370`
- Risk: New code may use deprecated fields. Data inconsistency between `disciplineId` (deprecated) and `modalityId` (replacement).
- Priority: Medium

**Scripts Directory Contains One-Off Debug Files:**
- What's not tested: The `scripts/` directory contains ~54 files, many of which appear to be one-off debugging/analysis scripts (e.g., `temp-verify-jana-students.ts`, `check-aula-jana-rabelo.ts`, `count_students_jana.mjs`).
- Files: `scripts/` (54+ files, customer-specific debugging scripts)
- Risk: Scripts may contain hardcoded IDs or connection strings. They inflate repository size without providing ongoing value.
- Priority: Low

## Test Coverage Gaps

**API Routes Entirely Untested:**
- What's not tested: 155 API route files in `app/api/` have no corresponding test files. Tests exist only for business logic services and utilities, not for route handlers.
- Files: All `app/api/**/route.ts` files
- Risk: Auth middleware wrappers, request parsing, error responses, and HTTP status codes are not verified. A broken auth wrapper could expose data.
- Priority: High

**Dashboard and Analytics Services Untested:**
- What's not tested: `app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service.ts` (3,495 lines) and `app/[tenant]/(modules)/dashboard/services/institution-analytics.service.ts` (750 lines) have no test files.
- Files: `app/[tenant]/(modules)/dashboard/services/`
- Risk: Complex data aggregation logic with 82 database calls could produce incorrect metrics unnoticed.
- Priority: High

**Permission System Test Coverage:**
- What's not tested: The RBAC system in `app/[tenant]/(modules)/usuario/services/permission.service.ts` (316 lines) and the auth flow in `app/shared/core/auth.ts` (421 lines) are critical security paths with limited test coverage.
- Files:
  - `app/[tenant]/(modules)/usuario/services/permission.service.ts`
  - `app/shared/core/auth.ts`
  - `app/[tenant]/auth/middleware.ts`
- Risk: Permission escalation bugs could go undetected. Role resolution logic is complex with multiple fallback paths.
- Priority: High

---

*Concerns audit: 2026-03-23*
