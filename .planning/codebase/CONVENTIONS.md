# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- Use **kebab-case** for all file names: `curso-table.tsx`, `plan-limits.service.ts`, `use-breakpoint.ts`
- Service files follow the pattern: `{domain}.service.ts`, `{domain}.repository.ts`, `{domain}.types.ts`
- Error classes in dedicated files: `errors.ts`
- Barrel exports in `index.ts`

**Components:**
- Use **PascalCase** for component function names: `CursoTable`, `CreateMemberDialog`, `PapelForm`
- Component files use kebab-case: `curso-table.tsx`, `create-member-dialog.tsx`

**Functions:**
- Use **camelCase** for all functions: `getDisponibilidade`, `upsertDisponibilidade`, `filterRecorrenciasByTurma`
- Server actions follow verb-noun pattern: `createAgendamento`, `confirmarAgendamento`, `getAgendamentoById`
- Boolean functions use `is`/`has`/`can` prefix: `isTeachingRole()`, `canImpersonateUser()`, `hasPermission()`

**Variables:**
- Use **camelCase** for variables: `testProfessorId`, `mockRepository`, `empresaId`
- Unused variables prefixed with `_`: `_env`, `_data`, `_table` (enforced by ESLint rule)
- Constants in **UPPER_SNAKE_CASE**: `AUTH_SESSION_CACHE_TTL`, `NAME_MIN_LENGTH`, `SCHEDULING_TIMEZONE`

**Types:**
- Use **PascalCase** for interfaces and types: `AppUser`, `CreateStudentInput`, `PaginationMeta`
- Input types: `Create{Entity}Input`, `Update{Entity}Input`
- Suffix with purpose: `PapelFormData`, `PapelFormProps`, `AuthenticatedRequest`
- Database row types derived from generated types: `Database["public"]["Tables"]["disciplinas"]["Row"]`

**Database columns:**
- Use **snake_case** matching PostgreSQL conventions: `empresa_id`, `nome_completo`, `created_at`
- Service layer maps snake_case DB fields to camelCase domain types via `mapRow()` functions

## Code Style

**Formatting:**
- No Prettier configured at project level
- Consistent use of double quotes for strings in `.ts`/`.tsx` files
- 2-space indentation
- Trailing commas used
- Semicolons used in most files (some older files omit them)

**Linting:**
- ESLint 9 with flat config (`eslint.config.mjs`)
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- `@typescript-eslint/no-unused-vars` set to `"warn"` with `^_` ignore patterns for args, vars, and caught errors
- Test files (`tests/**/*`) have relaxed rules: `no-require-imports: off`, `no-explicit-any: off`, `no-unsafe-function-type: off`, `prefer-const: off`

**Key ESLint rules:**
```typescript
// Unused variables must start with underscore
const _unused = someValue;  // OK
catch (_error) { ... }      // OK
```

## Component Patterns

**Server Components (default):**
- Page files (`page.tsx`) are Server Components by default
- Use `async` functions for data fetching: `export default async function DashboardPage()`
- Access auth with `await requireUser()`, database with `await createClient()`
- Route params accessed via `props.params: Promise<{ tenant: string }>`

```typescript
// Example: app/[tenant]/(modules)/dashboard/page.tsx
export default async function DashboardPage(props: {
  params: Promise<{ tenant: string }>
}) {
  const user = await requireUser()
  const params = await props.params
  // ... render based on role
}
```

**Client Components:**
- Mark with `"use client"` directive at top of file
- Used only when needed: forms, interactive UI, hooks, event handlers
- 161 client components across the app (well-controlled)

```typescript
// Example pattern
"use client"

import { useState } from "react"
import { Button } from "@/app/shared/components/ui/button"

export function CreateMemberDialog() {
  const [open, setOpen] = useState(false)
  // ...
}
```

**Component composition:**
- UI primitives from shadcn/ui using Radix UI (`@/app/shared/components/ui/`)
- Components use `cva` (class-variance-authority) for variant patterns
- Slot pattern via `@radix-ui/react-slot` for `asChild` prop
- `cn()` utility from `@/app/shared/library/utils` merges Tailwind classes

```typescript
// shadcn/ui component pattern (app/shared/components/ui/button.tsx)
const buttonVariants = cva("inline-flex items-center...", {
  variants: { variant: { default: "...", destructive: "..." }, size: { ... } },
  defaultVariants: { variant: "default", size: "default" },
})

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
```

## Styling Approach

**Tailwind CSS v4:**
- Configured via `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- Global styles in `app/globals.css` with `@import "tailwindcss"` (v4 syntax)
- Typography plugin: `@plugin "@tailwindcss/typography"`
- Animation via `tw-animate-css`

**Design Tokens (CSS Custom Properties):**
- Theme colors defined as CSS variables with HSL values: `--primary`, `--background`, `--destructive`, etc.
- Status colors: `--status-warning`, `--status-info`, `--status-success`
- Dark mode via custom variant: `@custom-variant dark (&:where(.dark, .dark *))`
- Theme presets loaded from `app/themes.css`
- Per-tenant branding via dynamic CSS variable overrides

**Usage rules:**
- Use Tailwind utility classes exclusively (no CSS modules)
- Use `cn()` to merge conditional classes
- Reference design tokens via Tailwind: `bg-primary`, `text-destructive`, `border-muted`
- Never use raw color values in components - always use semantic tokens

## Form Handling

**React Hook Form + Zod pattern:**
```typescript
// 1. Define Zod schema
const papelFormSchema = z.object({
  nome: z.string().min(1, 'Nome e obrigatorio'),
  tipo: z.string().min(1, 'Tipo e obrigatorio'),
  permissoes: z.custom<RolePermissions>(),
})

type PapelFormData = z.infer<typeof papelFormSchema>

// 2. Initialize form with zodResolver
const form = useForm<PapelFormData>({
  resolver: zodResolver(papelFormSchema),
  defaultValues: { nome: '', tipo: 'staff', permissoes: DEFAULT_PERMISSIONS.staff },
})

// 3. Render with shadcn Form components
<Form {...form}>
  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
    <FormField
      control={form.control}
      name="nome"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Nome do Papel</FormLabel>
          <FormControl>
            <Input placeholder="Ex: Professor Assistente" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

**Server Actions pattern (alternative):**
- Used with `"use server"` directive in `lib/` directories within modules
- Actions use `formData: FormData` or typed parameters
- State management via `useState` for action results

```typescript
// Server action file: lib/availability-actions.ts
"use server";
import { createClient } from "@/app/shared/core/server";

export async function getDisponibilidade(professorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agendamento_disponibilidade")
    .select("*")
    .eq("professor_id", professorId);
  if (error) { console.error("Error:", error); return []; }
  return data;
}
```

**Form components location:**
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

**Server-side (preferred):**
- Server Components fetch data directly using `createClient()` from `@/app/shared/core/server`
- Auth-gated with `requireUser()` from `@/app/shared/core/auth`

**Client-side:**
- TanStack Table (`@tanstack/react-table` v8) for data tables, NOT TanStack Query
- Server actions called directly from client components
- No `QueryClient`/`QueryClientProvider` pattern - data fetching is server-action-driven

**API routes:**
- RESTful pattern under `app/api/`
- Auth middleware via `requireAuth()` wrapper from `app/[tenant]/auth/middleware`
- Return `NextResponse.json({ data: ... })` for success
- Return `NextResponse.json({ error: ... }, { status: 4xx })` for errors

## Error Handling

**Custom domain error classes:**
```typescript
// Per-domain error files: services/errors.ts
export class DisciplineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisciplineValidationError';
  }
}
export class DisciplineConflictError extends Error { ... }
export class DisciplineNotFoundError extends Error { ... }
```

**API route error handling pattern:**
```typescript
function handleError(error: unknown) {
  if (error instanceof CourseValidationError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof CourseConflictError)
    return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof CourseNotFoundError)
    return NextResponse.json({ error: error.message }, { status: 404 });
  console.error('[Course API] Unexpected error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**Server action error handling:**
- Throw errors for auth failures: `throw new Error("Unauthorized")`
- Return empty arrays for query failures after logging: `console.error(...); return []`
- Use `try/catch` blocks wrapping Supabase calls

**Naming conventions for errors:**
- Pattern: `{Domain}ValidationError`, `{Domain}ConflictError`, `{Domain}NotFoundError`
- Always extend `Error` with explicit `this.name` assignment

## Import Organization

**Order:**
1. React/Next.js framework imports (`react`, `next/navigation`, `next/server`)
2. External library imports (`@supabase/supabase-js`, `zod`, `lucide-react`)
3. Shared imports using path aliases (`@/app/shared/...`, `@/components/...`)
4. Relative module imports (`./services`, `../types`, `./components`)

**Path Aliases (from `tsconfig.json`):**
- `@/*` -> project root
- `@/components/*` -> `app/shared/components/*` and `app/shared/components/ui/*`
- `@/components/shared/*` -> `app/shared/components/ui/*`
- `@/hooks/*` -> `app/shared/hooks/*`
- `@/lib/*` -> `app/shared/library/*` and `app/shared/core/*`
- `@/shared/*` -> `app/shared/*`
- `@/lib/database.types` -> `app/shared/core/database.types`

**Common import examples:**
```typescript
import { cn } from "@/app/shared/library/utils"
import { Button } from "@/app/shared/components/ui/button"
import { requireUser } from "@/app/shared/core/auth"
import { getDatabaseClient } from "@/app/shared/core/database/database"
import type { AppUser, PapelBase } from "@/app/shared/types"
```

## TypeScript Usage

**Strict mode:** Enabled in `tsconfig.json` (`"strict": true`)

**Target:** ES2022 with `"module": "esnext"`, `"moduleResolution": "bundler"`

**Key patterns:**
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use `type` keyword for imports when possible: `import type { AppUser } from "..."`
- Generated database types at `app/shared/core/database.types.ts` (never edit manually)
- Row types derived from generated types: `Database["public"]["Tables"]["tablename"]["Row"]`
- Zod schemas for runtime validation with inferred types: `type FormData = z.infer<typeof schema>`

**Type assertion patterns:**
```typescript
// Cast Supabase join results
const vinculos = data as unknown as VinculoType[];
// Nullish coalescing for optional fields
const name = user.fullName ?? "Unknown";
// Type narrowing with instanceof
if (error instanceof CourseValidationError) { ... }
```

## Service Layer Architecture

**Repository pattern:**
- Interface-first design: `DisciplineRepository` (interface) -> `DisciplineRepositoryImpl` (class)
- Repositories handle DB operations, map snake_case rows to camelCase domain types
- Services contain business logic, validation, caching
- Factory functions create service instances: `createCursoService(client)`

```typescript
// Service with dependency injection
export class DisciplineService {
  constructor(private readonly repository: DisciplineRepository) {}
  async create(payload: CreateDisciplineInput): Promise<Discipline> { ... }
}

// Barrel export with factory (services/index.ts)
export function createCursoService(client: SupabaseClient): CursoService {
  const repository = new CursoRepositoryImpl(client);
  return new CursoService(repository);
}
```

## Module Structure

Each feature module under `app/[tenant]/(modules)/` follows this convention:

```
modulo/
├── (aluno)/        # Student-facing routes (route group)
├── (gestao)/       # Admin/management routes (route group)
├── components/     # Module-specific components
├── services/       # Business logic (service.ts, repository.ts, types.ts, errors.ts)
├── types/          # Local type definitions
├── lib/            # Server actions and helpers
├── hooks/          # Module-specific React hooks
└── page.tsx        # Entry point
```

## UI Language

**Primary language: Portuguese (Brazilian)**
- All user-facing strings in Portuguese: "Nome Completo", "Erro ao listar segmentos"
- Variable/type names in English: `fullName`, `empresaId`, `courseService`
- JSDoc comments in mixed Portuguese/English (Portuguese preferred for domain docs)
- Test descriptions in Portuguese: `'deve criar um padrao de recorrencia valido'`
- Error messages for end users in Portuguese: `"Campos obrigatorios: name e slug sao necessarios"`
- Technical error messages and logs in English: `"Internal server error"`, `"Error fetching availability:"`

## Logging

**Framework:** `console` (console.log, console.error, console.warn)

**Patterns:**
- Prefix with module/context: `[Course API]`, `[Segment POST]`
- Log structured context: `console.log('[Segment POST] Auth check:', { hasUser: !!request.user })`
- Log errors with stack: `console.error('Error stack:', error.stack)`
- Include detail in development only: `process.env.NODE_ENV === 'development' ? error.stack : undefined`

## Comments

**When to Comment:**
- Module-level JSDoc for service files and auth modules
- `@deprecated` annotations for legacy code paths
- Inline comments for non-obvious business logic
- Comments explaining Supabase type assertion needs

**Deprecation pattern:**
```typescript
/**
 * @deprecated Use createCursoService(client) com cliente do usuario para respeitar RLS.
 * Este service usa admin client e BYPASSA todas as RLS policies.
 */
```

## Environment Variables

**Validation:** Zod schema in `app/shared/core/env.ts` validates all env vars at runtime
- Skipped during build (`SKIP_ENV_VALIDATION=true` or `NEXT_PHASE=phase-production-build`)
- Required vars validated with `.superRefine()` for complex constraints
- Access validated env via `import { env } from "@/app/shared/core/env"`

---

*Convention analysis: 2026-03-23*
