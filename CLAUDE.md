# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aluminify is an open-source, white-label student portal platform for educational institutions. It provides modules for course management, scheduling, flashcards, study rooms, financial management, and analytics — all within a multi-tenant architecture.

**Stack:** Next.js 16 (App Router, Turbopack) | React 19 | TypeScript 5 (strict) | Tailwind CSS v4 | shadcn/ui (Radix UI) | Supabase (PostgreSQL + Auth + Storage) | TanStack Query v5

## Common Commands

```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint (cached)
npm run lint:fix         # Auto-fix lint issues
npm run typecheck        # TypeScript type checking
npm run test             # Run Jest tests
npm run test:watch       # Jest watch mode
npm run check:quick      # Quick check: lint + typecheck + colors (no tests)
npm run check            # Full check: lint + typecheck + color validation + tests
npm run check:ci         # CI mode (zero warnings tolerance)
npm run check:colors     # Validate design system color palette
```

Tests live in `tests/` with `*.test.ts` pattern. Run a single test with `npx jest tests/path/to/file.test.ts`.

## Architecture

### Multi-Tenant Routing

The `[tenant]` dynamic segment is the core routing primitive. All authenticated module pages live under `app/[tenant]/(modules)/`. Route groups organize concerns:

```
app/
├── (landing-page)/          # Public marketing site
├── [tenant]/
│   ├── (modules)/           # Protected modules (dashboard, curso, flashcards, etc.)
│   └── auth/                # Tenant-scoped auth flows
├── auth/                    # Global auth (non-tenant)
├── superadmin/              # Multi-tenant management panel
└── api/                     # RESTful API routes organized by domain
```

Tenant isolation is enforced through Supabase RLS policies. The `[tenant]` param resolves to an `empresa_id` via middleware.

### Path Aliases

Defined in `tsconfig.json`:

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `./*` (project root) |
| `@/components/*` | `app/shared/components/*` and `app/shared/components/ui/*` |
| `@/components/shared/*` | `app/shared/components/ui/*` |
| `@/hooks/*` | `app/shared/hooks/*` |
| `@/lib/*` | `app/shared/library/*` and `app/shared/core/*` |
| `@/shared/*` | `app/shared/*` |
| `@/lib/database.types` | `app/shared/core/database.types` |

### Data Layer

Two Supabase client patterns:

- **`getDatabaseClient()`** — Service-role client. Bypasses RLS. Use for admin/server-only operations. Located in `app/shared/core/database/database.ts`.
- **`getDatabaseClientAsUser(token)`** — User-scoped client. Respects RLS policies. Use for user-facing queries.

Database types are auto-generated in `app/shared/core/database.types.ts` (do not edit manually).

### Authentication

Core auth functions in `app/shared/core/auth.ts`:

- `getAuthenticatedUser()` — React `cache()`-wrapped. Returns full user context with role, tenant, and impersonation status. Sessions cached in Redis (30 min TTL).
- `requireUser(roles?)` — Enforces authentication, optionally checks role. Redirects to login if unauthorized.
- `invalidateAuthSessionCache(userId)` — Call on logout, password change, or role change.

**Roles (simplified model):** Uses `PapelBase` (`aluno`, `professor`, `usuario`) combined with an `isAdmin` flag. The legacy `RoleTipo` system is deprecated. Permissions are resolved via `resolvePermissions(role, isAdmin, customPermissions?)` and checked with `hasPermission(permissions, resource, action)`. See `app/shared/core/roles.ts` and `app/shared/types/entities/papel.ts`.

### Module Structure Convention

Each feature module under `app/[tenant]/(modules)/` typically follows:

```
modulo/
├── (aluno)/        # Student-facing routes
├── (gestao)/       # Admin/management routes
├── components/     # Module-specific components
├── services/       # Business logic / API calls
├── types/          # Local types
└── page.tsx        # Entry point
```

### Shared Code

All shared code lives under `app/shared/`:

- `components/ui/` — shadcn/ui primitives (Radix-based)
- `core/` — Auth, database clients, env validation, tenant resolution, services (cache, rate-limit, OAuth)
- `core/env.ts` — Zod-validated environment variables
- `hooks/` — Custom React hooks
- `types/` — Shared entities, DTOs, enums
- `library/utils.ts` — Tailwind `cn()` utility

### API Routes

RESTful endpoints under `app/api/`, organized by domain: `curso/`, `agendamentos/`, `usuario/`, `empresa/`, `financeiro/`, `flashcards/`, `sala-de-estudos/`, `cronograma/`, `biblioteca/`, `dashboard/`, `ai-agents/`, `webhooks/`.

## Code Conventions

- File names in **kebab-case**, components in **PascalCase**
- Prefer **Server Components** by default; use `"use client"` only when needed
- Styling via **Tailwind utility classes** (not CSS modules)
- Forms use **React Hook Form + Zod** for validation
- Server state managed with **TanStack Query**
- Unused variables prefixed with `_` (ESLint rule)
- Primary language in code/UI: Portuguese (Brazilian)

## Environment Variables

Validated at runtime via Zod in `app/shared/core/env.ts`. Required:

- `SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` — Public client key
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` — Server-side key
- `OAUTH_ENCRYPTION_KEY` — 32+ char encryption key

See `.env.example` for full list.

## OpenSpec Change Management

Specs live in `openspec/specs/`, active proposals in `openspec/changes/`. Project conventions are in `openspec/project.md`. Skip proposals for bug fixes, typos, dependency updates, and config changes.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Aluminify — SaaS Billing & Admin Completo**

Portal educacional white-label multi-tenant (Aluminify) que precisa de uma infraestrutura completa de gestão SaaS: área de superadmin para administração da plataforma e gestão financeira de recorrência, e área do tenant para gestão de faturas, pagamentos e assinatura. A integração com Stripe já foi iniciada (~70%) mas não foi testada.

**Core Value:** Gestão financeira de recorrência end-to-end funcionando — superadmin consegue administrar tenants e cobranças, tenant consegue pagar e gerenciar sua assinatura.

### Constraints

- **Tech stack**: Next.js 16 App Router + Supabase + Stripe — stack já definida, não mudar
- **UI**: Tailwind CSS v4 + shadcn/ui — manter consistência com o resto do sistema
- **Idioma**: Interface em português brasileiro
- **Auth**: Superadmin tem auth completamente separada dos tenants
- **RLS**: Dados de tenant isolados via Supabase RLS policies
- **Stripe**: Usar Stripe Checkout (não custom payment forms) — PCI compliance sem esforço
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5 (strict mode) - All application code. Target: ES2022. Module resolution: bundler.
- SQL - Database migrations and seed files in `supabase/migrations/` and `supabase/seed.sql`
- JavaScript (Node.js) - Build scripts in `scripts/` and config files (`jest.config.js`, `postcss.config.mjs`, `eslint.config.mjs`)
## Runtime
- Node.js >= 20, < 25 (enforced in `package.json` `engines` field)
- Docker image: `node:22-alpine`
- npm (no yarn/pnpm)
- Lockfile: `package-lock.json` present
## Frameworks
- Next.js `16.1.7` - App Router, React Server Components, API routes
- React `^19.2.4` - UI framework with Server Components by default
- React DOM `^19.2.4` - DOM rendering
- Jest `^30.2.0` - Unit/integration test runner
- Playwright `^1.58.1` - E2E testing
- Testing Library (`@testing-library/react` `^16.3.2`, `@testing-library/dom` `^10.4.1`, `@testing-library/jest-dom` `^6.9.1`) - Component testing
- fast-check `^4.5.3` - Property-based testing
- Turbopack (Next.js built-in) - Build tool
- PostCSS via `@tailwindcss/postcss` `^4.2.0` - CSS processing
- ESLint `9.39.1` - Linting
## Key Dependencies
- `@supabase/supabase-js` `^2.84.0` - Database client, Auth, Storage
- `@supabase/ssr` `^0.8.0` - Server-side Supabase client for Next.js (cookie-based auth)
- `stripe` `^20.4.1` - Payment processing (subscription billing)
- `zod` `^3.25.76` - Schema validation (forms, env vars, API inputs)
- `@tanstack/react-query` `^5.90.10` - Server state management and data fetching
- `react-hook-form` `^7.66.1` + `@hookform/resolvers` `^5.2.2` - Form management with Zod validation
- `tailwindcss` `^4.2.0` - Utility-first CSS (v4)
- `@tailwindcss/typography` `^0.5.19` - Prose styling
- `tailwind-merge` `^3.4.0` + `clsx` `^2.1.1` - Class name utilities (`cn()` in `app/shared/library/utils.ts`)
- `class-variance-authority` `^0.7.1` - Component variant styling
- `shadcn` `^3.6.3` (dev dependency) - UI component generator
- `tw-animate-css` `^1.4.0` - Animation utilities
- Full Radix UI component suite (20+ packages: dialog, dropdown-menu, select, tabs, tooltip, etc.)
- `lucide-react` `^0.575.0` - Icons
- `cmdk` `^1.1.1` - Command palette
- `sonner` `^2.0.7` - Toast notifications
- `vaul` `^1.1.2` - Drawer component
- `motion` `^12.23.24` - Animations (Framer Motion)
- `next-themes` `^0.4.6` - Dark/light theme switching
- Tiptap `^3.15.3` (12 packages) - Rich text editor
- `react-markdown` `^10.1.0` + `remark-gfm` + `remark-math` + `remark-breaks` + `rehype-katex` - Markdown rendering
- `marked` `^17.0.1` - Markdown parsing
- `shiki` `^3.15.0` - Syntax highlighting
- `katex` `^0.16.25` - LaTeX math rendering
- `@tanstack/react-table` `^8.21.3` - Data tables
- `recharts` `^3.6.0` - Charts and data visualization
- `date-fns` `^4.1.0` + `date-fns-tz` `^3.0.0` - Date manipulation and timezone handling
- `react-day-picker` `^9.11.1` - Date picker component
- `ical-generator` `^10.0.0` - iCalendar file generation
- `exceljs` `^4.4.0` - Excel file generation
- `papaparse` `^5.5.3` - CSV parsing
- `@react-pdf/renderer` `^4.3.1` - PDF generation
- `@dnd-kit/core` `^6.3.1`, `@dnd-kit/sortable` `^10.0.0`, `@dnd-kit/modifiers` `^9.0.0` - Drag and drop
- `@ai-sdk/openai` `^3.0.21` - Vercel AI SDK OpenAI provider
- `openai` `^6.16.0` - OpenAI API client
- `ai` `^5.0.52` (via overrides) - Vercel AI SDK core
- `@sentry/nextjs` `^10.38.0` - Error tracking and performance monitoring
- `@opentelemetry/api` `^1.9.0` + `@opentelemetry/instrumentation` `^0.211.0` - Distributed tracing
- `react-ga4` `^2.1.0` - Google Analytics
- `nodemailer` `^8.0.3` - SMTP email sending
- `pako` `^2.1.0` - Cookie compression (deflate/inflate)
- `libphonenumber-js` `^1.12.31` - Phone number validation
- `use-debounce` `^10.1.0` - Debounce hooks
- `swagger-jsdoc` `^7.0.0-rc.6` + `swagger-ui-react` `^5.31.0` - API documentation
- `react-resizable-panels` `^4.4.1` - Resizable panel layouts
- `embla-carousel-react` `^8.6.0` - Carousels
- `react-medium-image-zoom` `^5.4.0` - Image zoom
- `input-otp` `^1.4.2` - OTP input component
- `nextjs-toploader` `^3.9.17` - Page transition loader
## Configuration
- Runtime validation via Zod in `app/shared/core/env.ts`
- `.env.local` for local development (gitignored)
- `.env.example` for reference
- `.env.test` for test environment
- `.env.docker.example` for Docker deployments
- `SKIP_ENV_VALIDATION=true` during Docker build phase
- `SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` - Public client key
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` - Server-side key
- `OAUTH_ENCRYPTION_KEY` - 32+ char encryption key for OAuth credentials
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics
- `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` - Sentry
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe
- `SMTP_*` or `CLOUDRON_MAIL_*` - Email sending
- `next.config.ts` - Main build configuration with Sentry wrapping
- `tsconfig.json` - TypeScript configuration (strict, ES2022, bundler resolution)
- `postcss.config.mjs` - PostCSS with Tailwind CSS plugin
- `eslint.config.mjs` - ESLint flat config with Next.js presets
- `jest.config.js` - Jest test runner config
- `@/*` -> `./*` (project root)
- `@/components/*` -> `app/shared/components/*` and `app/shared/components/ui/*`
- `@/hooks/*` -> `app/shared/hooks/*`
- `@/lib/*` -> `app/shared/library/*` and `app/shared/core/*`
- `@/shared/*` -> `app/shared/*`
- `@/lib/database.types` -> `app/shared/core/database.types`
## Platform Requirements
- Node.js >= 20, < 25
- npm
- Supabase project (remote or local via `supabase` CLI)
- Optional: Docker for containerized development (`docker-compose.yml`)
- Docker (multi-stage build, `node:22-alpine`, standalone output)
- Port 3000
- Health check at `/api/health`
- Node.js memory: `--max-old-space-size=2048` (runner), `--max-old-space-size=4096` (builder)
- Runs as non-root user (`nextjs:nodejs`)
- Docker / self-hosted (Dockerfile, docker-compose variants)
- Cloudron (CloudronManifest.json, sendmail addon support)
- Vercel (default Next.js deployment, Sentry Vercel Cron Monitors)
- Traefik reverse proxy (`docker-compose.traefik.yml`)
- Portainer (`docker-compose.portainer.yml`)
- Supabase (PostgreSQL) - managed or self-hosted
- Database types auto-generated in `app/shared/core/database.types.ts`
- Migrations in `supabase/migrations/`
- Supabase CLI (`supabase` `^2.72.8`) as dev dependency
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use **kebab-case** for all file names: `curso-table.tsx`, `plan-limits.service.ts`, `use-breakpoint.ts`
- Service files follow the pattern: `{domain}.service.ts`, `{domain}.repository.ts`, `{domain}.types.ts`
- Error classes in dedicated files: `errors.ts`
- Barrel exports in `index.ts`
- Use **PascalCase** for component function names: `CursoTable`, `CreateMemberDialog`, `PapelForm`
- Component files use kebab-case: `curso-table.tsx`, `create-member-dialog.tsx`
- Use **camelCase** for all functions: `getDisponibilidade`, `upsertDisponibilidade`, `filterRecorrenciasByTurma`
- Server actions follow verb-noun pattern: `createAgendamento`, `confirmarAgendamento`, `getAgendamentoById`
- Boolean functions use `is`/`has`/`can` prefix: `isTeachingRole()`, `canImpersonateUser()`, `hasPermission()`
- Use **camelCase** for variables: `testProfessorId`, `mockRepository`, `empresaId`
- Unused variables prefixed with `_`: `_env`, `_data`, `_table` (enforced by ESLint rule)
- Constants in **UPPER_SNAKE_CASE**: `AUTH_SESSION_CACHE_TTL`, `NAME_MIN_LENGTH`, `SCHEDULING_TIMEZONE`
- Use **PascalCase** for interfaces and types: `AppUser`, `CreateStudentInput`, `PaginationMeta`
- Input types: `Create{Entity}Input`, `Update{Entity}Input`
- Suffix with purpose: `PapelFormData`, `PapelFormProps`, `AuthenticatedRequest`
- Database row types derived from generated types: `Database["public"]["Tables"]["disciplinas"]["Row"]`
- Use **snake_case** matching PostgreSQL conventions: `empresa_id`, `nome_completo`, `created_at`
- Service layer maps snake_case DB fields to camelCase domain types via `mapRow()` functions
## Code Style
- No Prettier configured at project level
- Consistent use of double quotes for strings in `.ts`/`.tsx` files
- 2-space indentation
- Trailing commas used
- Semicolons used in most files (some older files omit them)
- ESLint 9 with flat config (`eslint.config.mjs`)
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- `@typescript-eslint/no-unused-vars` set to `"warn"` with `^_` ignore patterns for args, vars, and caught errors
- Test files (`tests/**/*`) have relaxed rules: `no-require-imports: off`, `no-explicit-any: off`, `no-unsafe-function-type: off`, `prefer-const: off`
## Component Patterns
- Page files (`page.tsx`) are Server Components by default
- Use `async` functions for data fetching: `export default async function DashboardPage()`
- Access auth with `await requireUser()`, database with `await createClient()`
- Route params accessed via `props.params: Promise<{ tenant: string }>`
- Mark with `"use client"` directive at top of file
- Used only when needed: forms, interactive UI, hooks, event handlers
- 161 client components across the app (well-controlled)
- UI primitives from shadcn/ui using Radix UI (`@/app/shared/components/ui/`)
- Components use `cva` (class-variance-authority) for variant patterns
- Slot pattern via `@radix-ui/react-slot` for `asChild` prop
- `cn()` utility from `@/app/shared/library/utils` merges Tailwind classes
## Styling Approach
- Configured via `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- Global styles in `app/globals.css` with `@import "tailwindcss"` (v4 syntax)
- Typography plugin: `@plugin "@tailwindcss/typography"`
- Animation via `tw-animate-css`
- Theme colors defined as CSS variables with HSL values: `--primary`, `--background`, `--destructive`, etc.
- Status colors: `--status-warning`, `--status-info`, `--status-success`
- Dark mode via custom variant: `@custom-variant dark (&:where(.dark, .dark *))`
- Theme presets loaded from `app/themes.css`
- Per-tenant branding via dynamic CSS variable overrides
- Use Tailwind utility classes exclusively (no CSS modules)
- Use `cn()` to merge conditional classes
- Reference design tokens via Tailwind: `bg-primary`, `text-destructive`, `border-muted`
- Never use raw color values in components - always use semantic tokens
## Form Handling
- Used with `"use server"` directive in `lib/` directories within modules
- Actions use `formData: FormData` or typed parameters
- State management via `useState` for action results
- `app/shared/components/forms/form.tsx` - Form, FormField, FormItem, FormLabel, FormControl, FormMessage
- `app/shared/components/forms/input.tsx` - Input
- `app/shared/components/forms/select.tsx` - Select, SelectContent, SelectItem, SelectTrigger, SelectValue
- `app/shared/components/forms/checkbox.tsx` - Checkbox
- `app/shared/components/forms/textarea.tsx` - Textarea
- `app/shared/components/forms/switch.tsx` - Switch
- `app/shared/components/forms/calendar.tsx` - Calendar
- `app/shared/components/forms/radio-group.tsx` - RadioGroup
- `app/shared/components/forms/label.tsx` - Label
## Data Fetching
- Server Components fetch data directly using `createClient()` from `@/app/shared/core/server`
- Auth-gated with `requireUser()` from `@/app/shared/core/auth`
- TanStack Table (`@tanstack/react-table` v8) for data tables, NOT TanStack Query
- Server actions called directly from client components
- No `QueryClient`/`QueryClientProvider` pattern - data fetching is server-action-driven
- RESTful pattern under `app/api/`
- Auth middleware via `requireAuth()` wrapper from `app/[tenant]/auth/middleware`
- Return `NextResponse.json({ data: ... })` for success
- Return `NextResponse.json({ error: ... }, { status: 4xx })` for errors
## Error Handling
- Throw errors for auth failures: `throw new Error("Unauthorized")`
- Return empty arrays for query failures after logging: `console.error(...); return []`
- Use `try/catch` blocks wrapping Supabase calls
- Pattern: `{Domain}ValidationError`, `{Domain}ConflictError`, `{Domain}NotFoundError`
- Always extend `Error` with explicit `this.name` assignment
## Import Organization
- `@/*` -> project root
- `@/components/*` -> `app/shared/components/*` and `app/shared/components/ui/*`
- `@/components/shared/*` -> `app/shared/components/ui/*`
- `@/hooks/*` -> `app/shared/hooks/*`
- `@/lib/*` -> `app/shared/library/*` and `app/shared/core/*`
- `@/shared/*` -> `app/shared/*`
- `@/lib/database.types` -> `app/shared/core/database.types`
## TypeScript Usage
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use `type` keyword for imports when possible: `import type { AppUser } from "..."`
- Generated database types at `app/shared/core/database.types.ts` (never edit manually)
- Row types derived from generated types: `Database["public"]["Tables"]["tablename"]["Row"]`
- Zod schemas for runtime validation with inferred types: `type FormData = z.infer<typeof schema>`
## Service Layer Architecture
- Interface-first design: `DisciplineRepository` (interface) -> `DisciplineRepositoryImpl` (class)
- Repositories handle DB operations, map snake_case rows to camelCase domain types
- Services contain business logic, validation, caching
- Factory functions create service instances: `createCursoService(client)`
## Module Structure
## UI Language
- All user-facing strings in Portuguese: "Nome Completo", "Erro ao listar segmentos"
- Variable/type names in English: `fullName`, `empresaId`, `courseService`
- JSDoc comments in mixed Portuguese/English (Portuguese preferred for domain docs)
- Test descriptions in Portuguese: `'deve criar um padrao de recorrencia valido'`
- Error messages for end users in Portuguese: `"Campos obrigatorios: name e slug sao necessarios"`
- Technical error messages and logs in English: `"Internal server error"`, `"Error fetching availability:"`
## Logging
- Prefix with module/context: `[Course API]`, `[Segment POST]`
- Log structured context: `console.log('[Segment POST] Auth check:', { hasUser: !!request.user })`
- Log errors with stack: `console.error('Error stack:', error.stack)`
- Include detail in development only: `process.env.NODE_ENV === 'development' ? error.stack : undefined`
## Comments
- Module-level JSDoc for service files and auth modules
- `@deprecated` annotations for legacy code paths
- Inline comments for non-obvious business logic
- Comments explaining Supabase type assertion needs
## Environment Variables
- Skipped during build (`SKIP_ENV_VALIDATION=true` or `NEXT_PHASE=phase-production-build`)
- Required vars validated with `.superRefine()` for complex constraints
- Access validated env via `import { env } from "@/app/shared/core/env"`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Single Next.js 16 application with App Router serving all concerns (marketing, tenant portal, API, superadmin)
- Multi-tenant architecture using `[tenant]` dynamic route segment mapped to `empresa_id`
- Server Components by default; client components explicitly opted-in with `"use client"`
- Three-tier tenant resolution: subdomain, custom domain, URL slug
- Business logic co-located with feature modules under `app/[tenant]/(modules)/`
- Supabase PostgreSQL as single data store with Row Level Security (RLS) for tenant isolation
## Layers
- Purpose: Render UI, handle user interaction
- Location: `app/[tenant]/(modules)/*/page.tsx`, `app/[tenant]/(modules)/*/components/`
- Contains: Server Components (page.tsx) that call `requireUser()` or `requireTenantUser()`, then render Client Components
- Depends on: Auth layer, Service layer (via API calls from client components)
- Used by: End users via browser
- Purpose: RESTful endpoints consumed by client components via `fetch` / TanStack Query
- Location: `app/api/` organized by domain (e.g., `app/api/curso/`, `app/api/flashcards/`, `app/api/usuario/`)
- Contains: `route.ts` files exporting GET/POST/PUT/DELETE/PATCH handlers wrapped in auth middleware
- Depends on: Auth middleware, Service layer, Database clients
- Used by: Client components via `app/shared/library/api-client.ts`
- Purpose: Authenticate and authorize API requests
- Location: `app/[tenant]/auth/middleware.ts`
- Contains: `requireAuth()`, `requireUserAuth()`, `requireRole()`, `requirePermission()` HOF wrappers
- Pattern: Wraps route handlers, injects `request.user` or `request.apiKey` into `AuthenticatedRequest`
- Depends on: Supabase Auth (JWT / cookie), API Key service, Effective empresa resolution
- Purpose: Business logic, data transformation, validation
- Location: `app/[tenant]/(modules)/*/services/` (module-specific), `app/shared/core/services/` (cross-cutting)
- Contains: Service classes/functions, repository classes, error types
- Pattern: Services use `getDatabaseClient()` (admin) or `getDatabaseClientAsUser()` (RLS-scoped)
- Depends on: Database clients, shared types
- Used by: API route handlers, Server Components
- Purpose: Database interactions via Supabase client
- Location: `app/shared/core/database/database.ts`
- Contains: Two client factories:
- Pattern: Repository Factory at `app/shared/core/repository-factory.ts` wraps clients for DI
- Depends on: Supabase SDK, environment variables
- Purpose: Cross-cutting concerns shared across all modules
- Location: `app/shared/core/` (auth, DB, env, middleware), `app/shared/components/` (UI), `app/shared/types/` (entities)
- Contains: Auth utilities, cache service, rate limiting, tenant resolution, email, roles/permissions
- Used by: All other layers
## Data Flow
- **Server state:** TanStack Query v5 for data fetching, caching, and synchronization
- **Auth state:** React Context via `UserProvider` (hydrated from `requireUser()` in layout)
- **UI state:** React `useState` / `useReducer` in client components
- **Theme state:** `next-themes` for dark/light mode; cookie-persisted theme settings
- **Form state:** React Hook Form with Zod validation schemas
## Authentication Architecture
```
```
- Cookie-based (Supabase SSR cookies for page loads)
- Bearer token (Authorization header for API calls from client components)
- API Key (`x-api-key` header for external integrations, validated via `apiKeyService`)
- `getAuthenticatedUser()` is wrapped in React `cache()` for per-request deduplication
- Auth session data cached in `cacheService` (in-memory Map) with 30-minute TTL (key: `auth:session:{userId}`)
- Cache invalidated via `invalidateAuthSessionCache(userId)` on logout, password change, role change
- Admins can impersonate students within their tenant
- Impersonation context stored in httpOnly cookie (`impersonation_context`, 8h TTL)
- `getImpersonationContext()` reads cookie; `hydrateUserProfile()` loads impersonated user data
- Impersonation state cascades through all auth functions
- Completely separate from tenant auth
- Uses same Supabase Auth but validates against `superadmins` table
- `requireSuperadmin()` and `requireSuperadminForAPI()` in `app/shared/core/services/superadmin-auth.service.ts`
- Routes under `/superadmin/` and `/api/superadmin/`
## Authorization Model
- Three base roles (`PapelBase`): `aluno` (student), `professor` (teacher), `usuario` (staff)
- `isAdmin` flag elevates any role to full permissions (`ADMIN_PERMISSIONS`)
- `isOwner` flag marks the tenant creator
- Custom permissions via `papeis` table (for `usuario` role): `RolePermissions` object per resource
- `resolvePermissions(role, isAdmin, customPermissions?)` in `app/shared/core/roles.ts`
- `hasPermission(permissions, resource, action)` checks view/create/edit/delete per resource
- Convenience: `canView()`, `canCreate()`, `canEdit()`, `canDelete()`
- API-level: `requirePermission(resource, action)` middleware wrapper
- Page-level: `requireUser({ allowedRoles: ['professor', 'usuario'] })`
- `requireUser()` -- Enforces authentication, optionally checks roles, redirects to login
- `requireTenantUser(slug)` -- Ensures user belongs to the URL tenant
- `requireAlunoRoute()` / `requireProfessorRoute()` / `requireUsuarioRoute()` in `app/shared/core/route-guards.ts`
## Multi-Tenant Isolation Strategy
- Middleware sets `x-tenant-id` and `x-tenant-slug` headers on all requests
- Server Components read headers via `headers().get('x-tenant-id')`
- API routes use `getEffectiveEmpresaId(request, user)` to resolve tenant:
- **RLS policies** on Supabase enforce tenant isolation at the database level
- `getDatabaseClientAsUser(token)` respects RLS; used for user-facing queries
- `getDatabaseClient()` bypasses RLS; used only for system-level operations (admin, webhooks, cross-tenant)
- Multi-org students can access multiple tenants (validated via `userBelongsToTenant()` which checks `usuarios`, `matriculas`, `alunos_cursos`, and `usuarios_empresas` tables)
## Caching Strategy
- `getAuthenticatedUser()` is wrapped in React `cache()` so multiple calls within the same request share one result
- `getAuthenticatedSuperadmin()` similarly cached
- Singleton `CacheService` backed by `Map` (server) or `Map` + `localStorage` (browser)
- Auth sessions cached with 30-min TTL (key: `auth:session:{userId}`)
- Terms acceptance cached (key: `empresa:{id}:aceite_termos_vigente`)
- Pattern: `cacheService.getOrSet(key, fetcher, ttl)` for cache-aside
- In-memory `Map<string, CachedTenant>` with 1-minute TTL
- Key: `tenant:{host}:{slug}`
- Max 1000 entries (simple clear-all eviction)
- API responses set `Cache-Control: private, max-age=60, stale-while-revalidate=120` for tenant-scoped data
- Default stale/cache times configured per query
- Manages client-side data synchronization and background refetching
- `app/shared/core/client.ts` caches Supabase browser client to avoid multiple auth refresh races
- Auth token cached in memory with expiry tracking (`app/shared/library/api-client.ts`)
## Key Abstractions
- Purpose: Unified user representation across the application
- Contains: `id`, `email`, `role`, `permissions`, `isAdmin`, `isOwner`, `empresaId`, `empresaSlug`, `empresaNome`, `mustChangePassword`
- Created by: `hydrateUserProfile()` in `app/shared/core/auth.ts`
- Purpose: Lightweight user type for API route auth middleware
- Contains: `id`, `email`, `role`, `roleType?`, `permissions?`, `isAdmin`, `empresaId?`, `name?`
- Created by: `mapSupabaseUserToAuthUser()` in `app/[tenant]/auth/middleware.ts`
- Purpose: Dependency injection for database access with correct RLS context
- Pattern: `factory.create(RepoClass)` instantiates a repository with the user-scoped client
- Three factory creators: `createRepositoryFactory()` (from session), `createRepositoryFactoryFromToken()`, `createServiceRepositoryFactory()` (admin)
- Purpose: Separate business logic from data access
- Example: `app/[tenant]/(modules)/curso/services/curso.service.ts` (logic) + `curso.repository.ts` (queries)
- Some modules use service-only pattern (no separate repository): e.g., `flashcards.service.ts`
- Services instantiated via factory functions: `createFlashcardsService()`, or singleton: `cursoService`
- Purpose: Resolved tenant information flowing through middleware
- Contains: `empresaId?`, `empresaSlug?`, `empresaNome?`, `resolutionType?` (subdomain | custom-domain | slug)
## Entry Points
- Location: Entry via `app/shared/core/middleware.logic.ts`, invoked by Next.js middleware configuration
- Triggers: Every HTTP request (except static assets)
- Responsibilities: Tenant resolution, session refresh, auth redirect, header injection
- Location: `app/layout.tsx`
- Triggers: All page renders
- Responsibilities: HTML shell, theme providers, global CSS, analytics, toast notifications
- Location: `app/[tenant]/(modules)/layout.tsx` (delegates to `app/shared/components/layout/dashboard-layout.tsx`)
- Triggers: All module page renders
- Responsibilities: Auth enforcement, sidebar/header/bottom-nav rendering, provider tree (User, Branding, Organizations, ModuleVisibility)
- Location: `app/api/*/route.ts`
- Triggers: Client-side fetch calls
- Responsibilities: Auth verification, business logic execution, JSON response
## Error Handling
- **API Routes:** Try/catch in handlers; custom error classes (e.g., `CourseValidationError`, `CourseConflictError`) map to appropriate HTTP status codes (400, 409, etc.); generic errors return 500
- **Auth:** Redirect to login on missing/invalid session; return 401 JSON for API routes
- **Services:** Throw custom error classes; callers catch and map to HTTP responses
- **Client Components:** TanStack Query error states; toast notifications via Sonner
- **Middleware:** Auth failures return 401 JSON (API) or 302 redirect (pages)
## Cross-Cutting Concerns
- Environment variables: Zod schema in `app/shared/core/env.ts`
- API request bodies: Manual validation in route handlers; some use Zod
- Form inputs: React Hook Form + Zod schemas (client-side)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
