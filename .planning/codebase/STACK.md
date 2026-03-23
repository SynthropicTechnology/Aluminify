# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- TypeScript 5 (strict mode) - All application code. Target: ES2022. Module resolution: bundler.
  - Config: `tsconfig.json`

**Secondary:**
- SQL - Database migrations and seed files in `supabase/migrations/` and `supabase/seed.sql`
- JavaScript (Node.js) - Build scripts in `scripts/` and config files (`jest.config.js`, `postcss.config.mjs`, `eslint.config.mjs`)

## Runtime

**Environment:**
- Node.js >= 20, < 25 (enforced in `package.json` `engines` field)
- Docker image: `node:22-alpine`

**Package Manager:**
- npm (no yarn/pnpm)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js `16.1.7` - App Router, React Server Components, API routes
  - Config: `next.config.ts`
  - Dev: `npm run dev` uses Webpack; `npm run dev:turbopack` uses Turbopack
  - Build: `npm run build` uses Turbopack (`--turbopack`)
  - Output: `standalone` for Docker, default for Vercel
- React `^19.2.4` - UI framework with Server Components by default
- React DOM `^19.2.4` - DOM rendering

**Testing:**
- Jest `^30.2.0` - Unit/integration test runner
  - Config: `jest.config.js`
  - Preset: `ts-jest`
  - Environment: `node`
  - Test root: `tests/`
  - Timeout: 30000ms
- Playwright `^1.58.1` - E2E testing
  - Config: `playwright.config.ts`
  - Test dir: `e2e/`
  - Browsers: Chromium, Firefox, WebKit
- Testing Library (`@testing-library/react` `^16.3.2`, `@testing-library/dom` `^10.4.1`, `@testing-library/jest-dom` `^6.9.1`) - Component testing
- fast-check `^4.5.3` - Property-based testing

**Build/Dev:**
- Turbopack (Next.js built-in) - Build tool
- PostCSS via `@tailwindcss/postcss` `^4.2.0` - CSS processing
  - Config: `postcss.config.mjs`
- ESLint `9.39.1` - Linting
  - Config: `eslint.config.mjs` (flat config)
  - Extends: `eslint-config-next` (core-web-vitals + TypeScript)

## Key Dependencies

**Critical (application functionality depends on these):**
- `@supabase/supabase-js` `^2.84.0` - Database client, Auth, Storage
- `@supabase/ssr` `^0.8.0` - Server-side Supabase client for Next.js (cookie-based auth)
- `stripe` `^20.4.1` - Payment processing (subscription billing)
- `zod` `^3.25.76` - Schema validation (forms, env vars, API inputs)
- `@tanstack/react-query` `^5.90.10` - Server state management and data fetching
- `react-hook-form` `^7.66.1` + `@hookform/resolvers` `^5.2.2` - Form management with Zod validation

**UI System:**
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

**Rich Text / Content:**
- Tiptap `^3.15.3` (12 packages) - Rich text editor
- `react-markdown` `^10.1.0` + `remark-gfm` + `remark-math` + `remark-breaks` + `rehype-katex` - Markdown rendering
- `marked` `^17.0.1` - Markdown parsing
- `shiki` `^3.15.0` - Syntax highlighting
- `katex` `^0.16.25` - LaTeX math rendering

**Data / Tables:**
- `@tanstack/react-table` `^8.21.3` - Data tables
- `recharts` `^3.6.0` - Charts and data visualization

**Date/Time:**
- `date-fns` `^4.1.0` + `date-fns-tz` `^3.0.0` - Date manipulation and timezone handling
- `react-day-picker` `^9.11.1` - Date picker component
- `ical-generator` `^10.0.0` - iCalendar file generation

**File Handling:**
- `exceljs` `^4.4.0` - Excel file generation
- `papaparse` `^5.5.3` - CSV parsing
- `@react-pdf/renderer` `^4.3.1` - PDF generation

**Drag & Drop:**
- `@dnd-kit/core` `^6.3.1`, `@dnd-kit/sortable` `^10.0.0`, `@dnd-kit/modifiers` `^9.0.0` - Drag and drop

**AI/Chat:**
- `@ai-sdk/openai` `^3.0.21` - Vercel AI SDK OpenAI provider
- `openai` `^6.16.0` - OpenAI API client
- `ai` `^5.0.52` (via overrides) - Vercel AI SDK core

**Monitoring:**
- `@sentry/nextjs` `^10.38.0` - Error tracking and performance monitoring
- `@opentelemetry/api` `^1.9.0` + `@opentelemetry/instrumentation` `^0.211.0` - Distributed tracing
- `react-ga4` `^2.1.0` - Google Analytics

**Email:**
- `nodemailer` `^8.0.3` - SMTP email sending

**Utilities:**
- `pako` `^2.1.0` - Cookie compression (deflate/inflate)
- `libphonenumber-js` `^1.12.31` - Phone number validation
- `use-debounce` `^10.1.0` - Debounce hooks
- `swagger-jsdoc` `^7.0.0-rc.6` + `swagger-ui-react` `^5.31.0` - API documentation

**Infrastructure:**
- `react-resizable-panels` `^4.4.1` - Resizable panel layouts
- `embla-carousel-react` `^8.6.0` - Carousels
- `react-medium-image-zoom` `^5.4.0` - Image zoom
- `input-otp` `^1.4.2` - OTP input component
- `nextjs-toploader` `^3.9.17` - Page transition loader

## Configuration

**Environment:**
- Runtime validation via Zod in `app/shared/core/env.ts`
- `.env.local` for local development (gitignored)
- `.env.example` for reference
- `.env.test` for test environment
- `.env.docker.example` for Docker deployments
- `SKIP_ENV_VALIDATION=true` during Docker build phase

**Required env vars (minimum):**
- `SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` - Public client key
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` - Server-side key
- `OAUTH_ENCRYPTION_KEY` - 32+ char encryption key for OAuth credentials

**Optional env vars:**
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics
- `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` - Sentry
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe
- `SMTP_*` or `CLOUDRON_MAIL_*` - Email sending

**Build:**
- `next.config.ts` - Main build configuration with Sentry wrapping
- `tsconfig.json` - TypeScript configuration (strict, ES2022, bundler resolution)
- `postcss.config.mjs` - PostCSS with Tailwind CSS plugin
- `eslint.config.mjs` - ESLint flat config with Next.js presets
- `jest.config.js` - Jest test runner config

**Path Aliases (in `tsconfig.json`):**
- `@/*` -> `./*` (project root)
- `@/components/*` -> `app/shared/components/*` and `app/shared/components/ui/*`
- `@/hooks/*` -> `app/shared/hooks/*`
- `@/lib/*` -> `app/shared/library/*` and `app/shared/core/*`
- `@/shared/*` -> `app/shared/*`
- `@/lib/database.types` -> `app/shared/core/database.types`

## Platform Requirements

**Development:**
- Node.js >= 20, < 25
- npm
- Supabase project (remote or local via `supabase` CLI)
- Optional: Docker for containerized development (`docker-compose.yml`)

**Production:**
- Docker (multi-stage build, `node:22-alpine`, standalone output)
- Port 3000
- Health check at `/api/health`
- Node.js memory: `--max-old-space-size=2048` (runner), `--max-old-space-size=4096` (builder)
- Runs as non-root user (`nextjs:nodejs`)

**Deployment Targets:**
- Docker / self-hosted (Dockerfile, docker-compose variants)
- Cloudron (CloudronManifest.json, sendmail addon support)
- Vercel (default Next.js deployment, Sentry Vercel Cron Monitors)
- Traefik reverse proxy (`docker-compose.traefik.yml`)
- Portainer (`docker-compose.portainer.yml`)

**Database:**
- Supabase (PostgreSQL) - managed or self-hosted
- Database types auto-generated in `app/shared/core/database.types.ts`
- Migrations in `supabase/migrations/`
- Supabase CLI (`supabase` `^2.72.8`) as dev dependency

---

*Stack analysis: 2026-03-23*
