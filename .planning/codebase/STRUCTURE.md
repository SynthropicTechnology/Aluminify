# Codebase Structure

**Analysis Date:** 2026-03-23

## Directory Layout

```
aluminify/
├── app/                              # Next.js App Router root
│   ├── (landing-page)/               # Public marketing site (route group, no URL segment)
│   │   ├── changelog/                # Changelog page
│   │   ├── components/               # Landing page shared components
│   │   ├── docs/                     # Documentation page
│   │   ├── dpa/                      # Data processing agreement
│   │   ├── features/                 # Features showcase page
│   │   ├── manifesto/                # Manifesto page
│   │   ├── opensource/               # Open source info page
│   │   ├── politica-de-privacidade/  # Privacy policy page
│   │   ├── pricing/                  # Pricing page
│   │   ├── roadmap/                  # Roadmap page
│   │   ├── status/                   # Status page
│   │   └── termos-de-uso/            # Terms of service page
│   ├── [tenant]/                     # Tenant-scoped routes (slug-based)
│   │   ├── (modules)/               # Protected feature modules (route group)
│   │   │   ├── layout.tsx            # DashboardLayout (auth + providers)
│   │   │   ├── agendamentos/         # Scheduling module
│   │   │   ├── agente/               # AI agent module
│   │   │   ├── biblioteca/           # Library module
│   │   │   ├── configuracoes/        # Settings module (plan)
│   │   │   ├── cronograma/           # Study schedule module
│   │   │   ├── curso/                # Course management module
│   │   │   ├── dashboard/            # Dashboard module
│   │   │   ├── empresa/              # Organization management module
│   │   │   ├── financeiro/           # Financial module
│   │   │   ├── flashcards/           # Flashcards module
│   │   │   ├── foco/                 # Focus timer module
│   │   │   ├── perfil/               # User profile module
│   │   │   ├── sala-de-estudos/      # Study room module
│   │   │   ├── settings/             # Tenant settings module
│   │   │   ├── termos/               # Legal terms module
│   │   │   └── usuario/              # User management module
│   │   ├── aceite-termos/            # Terms acceptance flow
│   │   └── auth/                     # Tenant-scoped auth (login, signup, forgot-password)
│   │       ├── middleware.ts          # API route auth middleware (requireAuth, etc.)
│   │       ├── services/             # Auth services
│   │       └── types/                # Auth types (AuthUser, UserRole)
│   ├── api/                          # RESTful API routes
│   │   ├── agendamentos/             # Scheduling API
│   │   ├── ai-agents/                # AI agents API
│   │   ├── aluno/                    # Student API
│   │   ├── auth/                     # Auth API (signin, signup, signout, refresh, impersonate, etc.)
│   │   ├── biblioteca/               # Library API
│   │   ├── cronograma/               # Schedule API
│   │   ├── curso/                    # Course API (CRUD, enrollments, modules, segments, disciplines)
│   │   ├── dashboard/                # Dashboard analytics API
│   │   ├── docs/                     # API docs
│   │   ├── empresa/                  # Organization API (CRUD, team, roles, branding, integrations)
│   │   ├── financeiro/               # Financial API (products, transactions, coupons)
│   │   ├── flashcards/               # Flashcards API
│   │   ├── health/                   # Health check
│   │   ├── plans/                    # Subscription plans API
│   │   ├── sala-de-estudos/          # Study room API (activities, sessions, progress, rules)
│   │   ├── stripe/                   # Stripe checkout/portal API
│   │   ├── superadmin/               # Superadmin API (subscriptions, users, metrics)
│   │   ├── tobias/                   # AI chat API
│   │   ├── usuario/                  # User API (students, teachers, enrollments, profiles, classes)
│   │   └── webhooks/                 # Incoming webhooks (Stripe, Hotmart)
│   ├── auth/                         # Global auth pages (non-tenant: login, signup, forgot-password)
│   ├── primeiro-acesso/              # First access / password change page
│   ├── superadmin/                   # Superadmin management panel
│   │   ├── (auth)/                   # Superadmin login
│   │   ├── (dashboard)/              # Superadmin dashboard
│   │   └── layout.tsx                # Superadmin layout
│   ├── shared/                       # Shared code (not a route)
│   │   ├── components/               # Shared UI components
│   │   │   ├── active-theme/         # Theme activation component
│   │   │   ├── calendar/             # Calendar components
│   │   │   ├── dataviz/              # Data visualization components
│   │   │   ├── feedback/             # Feedback components (error, loading, empty states)
│   │   │   ├── forms/                # Form components (file upload, rich editor, etc.)
│   │   │   ├── layout/               # Layout components (sidebars, headers, navigation)
│   │   │   ├── overlay/              # Overlay components (modals, sheets)
│   │   │   ├── providers/            # React Context providers
│   │   │   └── ui/                   # shadcn/ui primitives (~64 components)
│   │   ├── core/                     # Core infrastructure
│   │   │   ├── actions/              # Server actions (auth-actions.ts)
│   │   │   ├── auth.ts               # Main auth module (getAuthenticatedUser, requireUser)
│   │   │   ├── auth-impersonate.ts   # Impersonation context (cookie-based)
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── cookie-compression.ts # Cookie compression utilities (pako)
│   │   │   ├── database/             # Database client factories
│   │   │   │   └── database.ts       # getDatabaseClient, getDatabaseClientAsUser
│   │   │   ├── database.types.ts     # Auto-generated Supabase types (DO NOT EDIT)
│   │   │   ├── effective-empresa.ts  # Effective tenant resolution for API routes
│   │   │   ├── email.ts              # Email sending (SMTP/Cloudron)
│   │   │   ├── env.ts                # Zod-validated environment variables
│   │   │   ├── fonts.ts              # Font configuration
│   │   │   ├── ga.ts                 # Google Analytics
│   │   │   ├── middleware/            # Middleware utilities (brand access, empresa context, file security)
│   │   │   ├── middleware.logic.ts   # Main middleware logic (tenant resolution, auth, redirects)
│   │   │   ├── repository-factory.ts # Repository Factory pattern for DI
│   │   │   ├── resolve-empresa-from-tenant.ts # Tenant slug resolution helper
│   │   │   ├── roles.ts             # Role/permission helpers
│   │   │   ├── route-guards.ts      # Server Component route guards
│   │   │   ├── server.ts            # Server-side Supabase client (cookie-based)
│   │   │   ├── services/            # Cross-cutting services
│   │   │   │   ├── api-key/         # API key validation service
│   │   │   │   ├── cache/           # In-memory cache service (singleton)
│   │   │   │   ├── oauth-credentials/ # OAuth credentials management
│   │   │   │   ├── rate-limit/      # Per-tenant rate limiting
│   │   │   │   ├── termos/          # Legal terms service
│   │   │   │   ├── plan-limits.service.ts    # Subscription plan limits checking
│   │   │   │   ├── stripe.service.ts         # Stripe service
│   │   │   │   ├── superadmin-auth.service.ts # Superadmin auth
│   │   │   │   └── tenant-resolution.service.ts # Tenant resolution logic
│   │   │   ├── supabase-public-env.ts # Public Supabase config
│   │   │   ├── tenant.ts            # Tenant utilities (resolveTenantId, requireTenantUser)
│   │   │   ├── tenant-validation.ts  # Tenant validation logic
│   │   │   └── themes.ts            # Theme defaults
│   │   ├── hooks/                    # Shared React hooks
│   │   │   ├── use-breakpoint.ts     # Responsive breakpoint hook
│   │   │   ├── use-mobile.ts         # Mobile detection hook
│   │   │   ├── use-module-visibility.ts # Module visibility check
│   │   │   ├── use-plantao-quota.ts  # Scheduling quota hook
│   │   │   ├── use-study-timer.ts    # Study timer hook
│   │   │   ├── use-swipe.ts         # Touch swipe hook
│   │   │   ├── use-tenant-branding.ts # Tenant branding hook
│   │   │   └── use-toast.ts         # Toast hook
│   │   ├── library/                  # Utility libraries
│   │   │   ├── api-client.ts         # Client-side API client (auth token management)
│   │   │   ├── br.ts                # Brazilian locale utilities (CPF, phone formatting)
│   │   │   ├── compose-refs.ts      # Ref composition utility
│   │   │   ├── download-file.ts     # File download utility
│   │   │   ├── slugify.ts           # Slug generation
│   │   │   └── utils.ts             # Tailwind cn() utility
│   │   ├── services/                 # Additional shared services
│   │   ├── swagger/                  # OpenAPI spec files
│   │   ├── types/                    # Shared TypeScript types
│   │   │   ├── entities/             # Entity types (user, curso, papel, activity, etc.)
│   │   │   ├── dtos/                # API response DTOs
│   │   │   ├── enums/               # Shared enums
│   │   │   ├── cache.ts             # Cache key types
│   │   │   └── index.ts             # Barrel exports
│   │   └── utils/                    # Additional utilities
│   ├── globals.css                   # Global Tailwind CSS
│   └── layout.tsx                    # Root layout (HTML, theme, providers)
├── openspec/                         # OpenSpec change management
│   ├── changes/                      # Active change proposals
│   ├── specs/                        # Active specifications
│   └── project.md                    # Project conventions
├── tests/                            # Test files
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   ├── security/                     # Security tests
│   ├── core/                         # Core module tests
│   ├── flashcards/                   # Flashcard tests
│   ├── cronograma/                   # Schedule tests
│   └── brand-customization/          # Branding tests
├── scripts/                          # Build/deploy scripts
├── public/                           # Static assets
├── next.config.ts                    # Next.js configuration (Sentry, Turbopack, Webpack)
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies and scripts
├── eslint.config.mjs                 # ESLint configuration
└── CLAUDE.md                         # AI assistant instructions
```

## Directory Purposes

**`app/(landing-page)/`:**
- Purpose: Public marketing site pages (no authentication required)
- Contains: Static/server-rendered pages with their own components
- Key files: Each subdirectory has a `page.tsx` and optional `components/` folder
- Note: Route group -- does not create a URL segment

**`app/[tenant]/(modules)/`:**
- Purpose: All protected tenant-scoped feature modules
- Contains: Feature modules, each following a convention (see Module Convention below)
- Key files: `layout.tsx` renders the `DashboardLayout` with auth + provider tree
- Note: The `(modules)` route group does not appear in the URL

**`app/[tenant]/auth/`:**
- Purpose: Tenant-scoped authentication pages AND the API route auth middleware
- Contains: Login, sign-up, forgot-password pages; `middleware.ts` with `requireAuth()`, `requireUserAuth()`, `requireRole()`, `requirePermission()`
- Key files: `middleware.ts` (auth middleware for API routes), `types/` (AuthUser, UserRole, ApiKeyAuth)

**`app/api/`:**
- Purpose: RESTful API endpoints consumed by client components
- Contains: `route.ts` files organized by domain, each exporting HTTP method handlers
- Key pattern: Handlers wrapped in auth middleware from `app/[tenant]/auth/middleware.ts`

**`app/auth/`:**
- Purpose: Global (non-tenant) authentication pages
- Contains: Login, sign-up, forgot-password, update-password, confirm, error pages
- Note: Used when no tenant context is available (e.g., direct `/auth` access)

**`app/superadmin/`:**
- Purpose: Multi-tenant management panel (separate from tenant auth)
- Contains: Auth flow `(auth)/` and dashboard `(dashboard)/` route groups
- Key pattern: Uses `requireSuperadmin()` from `superadmin-auth.service.ts`

**`app/shared/`:**
- Purpose: All shared code (NOT a route directory)
- Contains: Components, core infrastructure, hooks, types, libraries, utilities
- Key subdirectories: `core/` (auth, DB, env, middleware), `components/ui/` (shadcn primitives), `types/entities/`

**`app/shared/core/`:**
- Purpose: Core application infrastructure
- Contains: Auth module, database clients, env validation, middleware logic, services
- Key files: `auth.ts`, `database/database.ts`, `env.ts`, `middleware.logic.ts`, `roles.ts`

**`app/shared/core/services/`:**
- Purpose: Cross-cutting backend services shared across all modules
- Contains: Cache, rate-limit, API key validation, tenant resolution, plan limits, Stripe, superadmin auth, termos

**`tests/`:**
- Purpose: All test files (not co-located with source)
- Contains: Unit, integration, security, and feature-specific tests
- Key pattern: `*.test.ts` or `*.test.tsx` files

**`openspec/`:**
- Purpose: Specification and change management documents
- Contains: Active specs in `specs/`, change proposals in `changes/`, project conventions in `project.md`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout (HTML, theme providers, global styles)
- `app/[tenant]/(modules)/layout.tsx`: Dashboard layout (auth + providers, delegates to `app/shared/components/layout/dashboard-layout.tsx`)
- `app/shared/core/middleware.logic.ts`: Main middleware (tenant resolution, auth, redirects)
- `next.config.ts`: Next.js + Sentry + Webpack/Turbopack configuration

**Configuration:**
- `tsconfig.json`: TypeScript config with path aliases
- `app/shared/core/env.ts`: Zod-validated environment variables
- `next.config.ts`: Next.js build config, Sentry integration
- `package.json`: Dependencies, scripts, engine requirements

**Core Auth:**
- `app/shared/core/auth.ts`: `getAuthenticatedUser()`, `requireUser()`, session caching
- `app/[tenant]/auth/middleware.ts`: API route auth middleware (`requireAuth()`, `requireUserAuth()`, `requireRole()`, `requirePermission()`)
- `app/shared/core/auth-impersonate.ts`: Impersonation context management
- `app/shared/core/services/superadmin-auth.service.ts`: Superadmin authentication
- `app/shared/core/route-guards.ts`: Server Component route guards

**Core Database:**
- `app/shared/core/database/database.ts`: `getDatabaseClient()`, `getDatabaseClientAsUser()`
- `app/shared/core/repository-factory.ts`: Repository Factory pattern
- `app/shared/core/database.types.ts`: Auto-generated Supabase types (130K+ lines, DO NOT EDIT)

**Core Tenant:**
- `app/shared/core/services/tenant-resolution.service.ts`: Tenant resolution from host/path
- `app/shared/core/tenant.ts`: `resolveTenantId()`, `requireTenantUser()`
- `app/shared/core/effective-empresa.ts`: `getEffectiveEmpresaId()`, `userBelongsToTenant()`

**Shared UI:**
- `app/shared/components/ui/`: ~64 shadcn/ui primitives (button, dialog, input, table, etc.)
- `app/shared/components/layout/dashboard-layout.tsx`: Main dashboard layout
- `app/shared/components/layout/app-sidebar.tsx`: Role-based sidebar switcher
- `app/shared/components/providers/user-provider.tsx`: User context provider

**Client-Side Data:**
- `app/shared/library/api-client.ts`: Client-side API client with auth token management
- `app/shared/core/client.ts`: Browser Supabase client (singleton with cookie compression)

## Naming Conventions

**Files:**
- kebab-case for all files: `curso.service.ts`, `dashboard-layout.tsx`, `use-study-timer.ts`
- Components: `*.tsx` (PascalCase exports, kebab-case filenames)
- Services: `*.service.ts`
- Repositories: `*.repository.ts`
- Types: `*.types.ts` or `*.ts` in `types/` directories
- Route handlers: `route.ts`
- Page components: `page.tsx`
- Layouts: `layout.tsx`

**Directories:**
- kebab-case for feature modules: `sala-de-estudos/`, `flash-cards/`
- Route groups in parentheses: `(modules)/`, `(gestao)/`, `(aluno)/`, `(landing-page)/`
- Dynamic segments in brackets: `[tenant]/`, `[id]/`

## Module Convention

Each feature module under `app/[tenant]/(modules)/` follows this pattern:

```
modulo/
├── (aluno)/          # Student-facing sub-routes (route group)
├── (gestao)/         # Admin/management sub-routes (route group)
│   ├── admin/        # Admin views
│   └── conteudos/    # Content management
├── components/       # Module-specific client components
├── services/         # Business logic + data access
│   ├── *.service.ts  # Business logic
│   ├── *.repository.ts # Data access (optional)
│   ├── *.types.ts    # Service-specific types
│   ├── errors.ts     # Custom error classes
│   └── index.ts      # Barrel exports
├── types/            # Module-specific types
├── hooks/            # Module-specific hooks (rare)
├── lib/              # Module-specific utilities (rare)
└── page.tsx          # Entry point (Server Component with auth check)
```

**Not all modules have all directories.** The convention is flexible:
- Simpler modules (e.g., `perfil/`, `termos/`) may only have `page.tsx` and `components/`
- Complex modules (e.g., `curso/`, `agendamentos/`) have the full structure with sub-routes, services, repositories

## Path Alias Mapping

Defined in `tsconfig.json`:

| Alias | Resolves To | Usage |
|-------|-------------|-------|
| `@/*` | `./*` (project root) | General imports: `@/app/shared/core/auth` |
| `@/components/*` | `./app/shared/components/*` and `./app/shared/components/ui/*` | UI components: `@/components/ui/button` |
| `@/components/shared/*` | `./app/shared/components/ui/*` | Shadcn primitives: `@/components/shared/dialog` |
| `@/hooks/*` | `./app/shared/hooks/*` | Hooks: `@/hooks/use-mobile` |
| `@/lib/*` | `./app/shared/library/*` and `./app/shared/core/*` | Libraries + core: `@/lib/utils`, `@/lib/database.types` |
| `@/shared/*` | `./app/shared/*` | Shared code: `@/shared/types` |
| `@/lib/database.types` | `./app/shared/core/database.types` | Database types import |

## Where to Add New Code

**New Feature Module:**
1. Create directory: `app/[tenant]/(modules)/nome-modulo/`
2. Add entry point: `page.tsx` with `requireUser()` call
3. Add components: `components/` directory for client components
4. Add services: `services/` directory with `*.service.ts` and optionally `*.repository.ts`
5. Add types: `types/` directory if needed
6. Add API routes: `app/api/nome-modulo/route.ts` with auth middleware wrapping
7. Register in sidebar: Update `app/shared/components/layout/aluno-sidebar.tsx` / `empresa-sidebar.tsx` / `professor-sidebar.tsx`

**New API Route:**
- Location: `app/api/{domain}/route.ts` (or `app/api/{domain}/[id]/route.ts` for dynamic routes)
- Pattern: Export handler functions (GET, POST, etc.) wrapped in `requireAuth()` or `requireUserAuth()` from `app/[tenant]/auth/middleware.ts`
- Use `getDatabaseClientAsUser(token)` for tenant-scoped queries; `getDatabaseClient()` only for system operations

**New Shared Component:**
- shadcn/ui primitive: `app/shared/components/ui/` (use `npx shadcn@latest add`)
- Layout component: `app/shared/components/layout/`
- Form component: `app/shared/components/forms/`
- Feedback component: `app/shared/components/feedback/`

**New Shared Hook:**
- Location: `app/shared/hooks/use-{name}.ts`
- Convention: Export a named function `use{Name}()`

**New Shared Type:**
- Entity type: `app/shared/types/entities/{name}.ts`
- DTO type: `app/shared/types/dtos/`
- Export from barrel: `app/shared/types/index.ts`

**New Core Service:**
- Location: `app/shared/core/services/{name}/` or `app/shared/core/services/{name}.service.ts`
- Pattern: Singleton export or factory function

**New Test:**
- Location: `tests/{category}/{name}.test.ts`
- Categories: `unit/`, `integration/`, `security/`, or feature-specific (e.g., `brand-customization/`)

**New Utility:**
- Shared utilities: `app/shared/library/{name}.ts`
- Module-specific: `app/[tenant]/(modules)/{module}/lib/{name}.ts`

## Special Directories

**`app/shared/`:**
- Purpose: All shared non-route code (components, core, hooks, types, libraries)
- Generated: No
- Committed: Yes
- Note: This is NOT a route directory -- Next.js ignores it for routing

**`app/shared/core/database.types.ts` (also at `app/shared/types/entities/database.types.ts`):**
- Purpose: Auto-generated Supabase TypeScript types
- Generated: Yes (by Supabase CLI `supabase gen types typescript`)
- Committed: Yes
- Note: DO NOT manually edit. Regenerate when database schema changes.

**`openspec/`:**
- Purpose: OpenSpec change management system for tracking feature proposals
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: Codebase analysis documents for AI-assisted development
- Generated: Yes (by AI tools)
- Committed: Optional

**`scripts/`:**
- Purpose: Build, deploy, and utility scripts
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-23*
