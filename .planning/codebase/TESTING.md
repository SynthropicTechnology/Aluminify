# Testing Patterns

**Analysis Date:** 2026-03-23

## Test Framework

**Runner:**
- Jest 30 with ts-jest 29 preset
- Config: `jest.config.js`
- Test environment: `node` (default), `jsdom` (per-file via docblock)

**Assertion Library:**
- Jest built-in `expect`
- `@testing-library/jest-dom` for DOM assertions (`.toBeInTheDocument()`, `.toBeChecked()`, etc.)

**Additional libraries:**
- `@testing-library/react` v16 for component rendering
- `@testing-library/dom` v10 for DOM queries
- `fast-check` v4 (available but not widely used yet) for property-based testing
- `cross-fetch` v4 for fetch polyfill in tests

**Run Commands:**
```bash
npm run test                  # Run all Jest tests
npm run test:watch            # Jest watch mode
npx jest tests/path/to.test.ts  # Run a single test file
npm run check                 # Full check: lint + typecheck + color validation + tests
npm run check:ci              # CI mode (zero warnings tolerance)
```

## Test File Organization

**Location:** All tests live in the top-level `tests/` directory (separate from source), NOT co-located with source files.

**Naming:** `*.test.ts` for pure logic tests, `*.test.tsx` for component tests

**Structure:**
```
tests/
├── setup.ts                              # Global test setup
├── tsconfig.json                         # Test-specific TS config
├── agendamentos/                         # Domain-specific tests
│   ├── permission-verification.test.ts
│   ├── recorrencia.test.ts               # Integration (requires Supabase)
│   ├── relatorios.test.ts
│   ├── turma-filter.test.ts              # Unit (pure function)
│   └── turma-restricted-availability.test.ts
├── brand-customization/                  # Feature-specific tests
│   ├── unit/
│   │   └── branding-service.test.ts
│   ├── access-control-middleware.test.ts
│   ├── multi-tenant-isolation.test.ts
│   └── ... (25+ test files)
├── core/
│   └── email.test.ts                     # Core service tests
├── cronograma/
│   └── distribuicao.test.ts              # Algorithm/logic tests
├── flashcards/
│   └── review-scope.test.ts              # Service behavior tests
├── integration/
│   └── tenant-isolation.test.ts          # Integration tests
├── performance/
│   ├── dashboard-analytics.bench.test.ts # Performance benchmarks
│   ├── rls-functions.test.ts
│   └── turma-service.test.ts
├── security/
│   └── tenant-isolation.test.ts          # Security-focused tests
├── termos/
│   ├── termos-service.test.ts
│   └── termos-types.test.ts
├── typescript-type-fixes/                # Type system regression tests
│   ├── backward-compatibility.test.ts
│   ├── compilation-success.test.ts
│   └── ... (6 test files)
└── unit/
    ├── landing-page.test.tsx             # Component test (jsdom)
    ├── permissions-matrix.test.tsx        # Component test (jsdom)
    └── stripe/
        ├── plan-limits.service.test.ts
        └── webhook-handler.test.ts
```

## Test Setup

**Global setup file:** `tests/setup.ts`

```typescript
// Sets NODE_ENV to 'test'
process.env.NODE_ENV = 'test'

// Provides fallback env vars so modules that validate on import don't fail
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'test-service-role-key'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY || 'test-anon-key'
process.env.OAUTH_ENCRYPTION_KEY =
  process.env.OAUTH_ENCRYPTION_KEY || 'test-oauth-encryption-key-minimum-32chars'

jest.setTimeout(30000)
```

**Test tsconfig:** `tests/tsconfig.json` extends root tsconfig, adds `jest` and `@types/node` types.

## Test Structure

**Suite Organization:**
```typescript
describe("ServiceName", () => {
  let service: ServiceType;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceType(mockDependency);
  });

  describe("methodName", () => {
    it("should do expected behavior", async () => {
      // Arrange
      mockDep.method.mockResolvedValue(expected);
      // Act
      const result = await service.method(input);
      // Assert
      expect(result).toEqual(expected);
    });

    it("should throw error when invalid", async () => {
      await expect(service.method(badInput)).rejects.toThrow(CustomError);
    });
  });
});
```

**Component test pattern:**
```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock child components to avoid deep rendering issues
jest.mock('@/app/(landing-page)/components/nav', () => ({
  Nav: () => <nav data-testid="nav">Nav</nav>,
}));

describe('ComponentName', () => {
  it('renders the main heading', () => {
    render(<ComponentName />);
    expect(screen.getByRole('heading', { name: /expected text/i })).toBeInTheDocument();
  });
});
```

**Test names:**
- Mix of Portuguese and English (Portuguese preferred for domain tests)
- Portuguese: `'deve criar um padrao de recorrencia valido'`
- English: `'should validate disciplines using batch query'`

## Mocking

**Framework:** Jest built-in `jest.fn()`, `jest.mock()`, `jest.spyOn()`

**Supabase client mocking (most common pattern):**

Three main approaches are used:

**1. Module-level jest.mock with const mock:**
```typescript
const mockFrom = jest.fn();

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: () => ({
    from: mockFrom,
  }),
}));

// Create chainable mock
function createChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn().mockImplementation((resolve) =>
    Promise.resolve(result).then(resolve)
  );
  return chain;
}
```

**2. FakeQueryBuilder pattern (for complex scenarios):**
```typescript
// tests/flashcards/review-scope.test.ts
let fakeClient: any;

jest.mock('@/app/shared/core/database/database', () => ({
  getDatabaseClient: () => fakeClient,
}));

class FakeQueryBuilder {
  private table: string;
  private state: Record<string, any>;
  private fixtures: Record<string, (state: Record<string, any>) => QueryResult>;

  constructor(table, fixtures, state) { ... }
  select() { return this; }
  eq(column, value) { this.state.eq = { ...this.state.eq, [column]: value }; return this; }
  // ... chainable methods
  then(onfulfilled, onrejected) {
    const result = this.execute();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

function createFakeClient(fixtures, sharedState) {
  return { from: (table) => new FakeQueryBuilder(table, fixtures, sharedState) };
}
```

**3. Constructor injection:**
```typescript
// tests/unit/curso/services/curso.service.test.ts
const mockRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  // ... all repository methods
} as unknown as jest.Mocked<CursoRepository>;

const service = new CursoService(mockRepository);
```

**Cache service mocking:**
```typescript
jest.mock("@/app/shared/core/services/cache/cache.service", () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn().mockImplementation(async (_key, fetcher) => fetcher()),
  },
}));
```

**Component mocking:**
```typescript
jest.mock('@/app/(landing-page)/components/nav', () => ({
  Nav: () => <nav data-testid="nav">Nav</nav>,
}));
```

**What to Mock:**
- Supabase database client (`getDatabaseClient`)
- Cache service (`cacheService`)
- External services (SMTP, Stripe)
- Child components in component tests
- Environment variables via `process.env`

**What NOT to Mock:**
- Business logic (services under test)
- Pure utility functions
- Type definitions and constants

## Conditional Test Execution

**Pattern for DB-dependent tests:**
```typescript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabase = !!SUPABASE_URL && !!SUPABASE_SERVICE_KEY;
const describeIfSupabase = hasSupabase ? describe : describe.skip;

if (!hasSupabase) {
  console.warn('Supabase env vars not found. Skipping integration tests.');
}

describeIfSupabase('Integration Test Suite', () => { ... });
```

This pattern is used in:
- `tests/agendamentos/recorrencia.test.ts`
- `tests/security/tenant-isolation.test.ts`
- `tests/integration/tenant-isolation.test.ts`
- `tests/performance/rls-functions.test.ts`

Tests skip gracefully when real Supabase credentials are not available (CI without DB, local dev without `.env`).

## Fixtures and Factories

**Test Data:**
```typescript
// Inline factory functions (most common pattern)
function mkSemana(numero: number, capacidade_minutos = 1000): SemanaInfo {
  const base = new Date('2026-01-01T00:00:00.000Z');
  // ...
  return { numero, data_inicio: start, data_fim: end, is_ferias: false, capacidade_minutos };
}

function mkAula(id, disciplina, frente, custo): AulaComCusto {
  return { id, disciplina_id: disciplina.id, ... };
}
```

**Test user creation (integration tests):**
```typescript
const emailA = `test_security_a_${Date.now()}@example.com`;
const { data: authA } = await serviceClient.auth.admin.createUser({
  email: emailA,
  password: testPassword,
  email_confirm: true,
});
```

**Location:** No dedicated fixtures directory. Test data is defined inline within each test file.

**Cleanup pattern:**
```typescript
afterAll(async () => {
  if (testProfessorId) {
    await supabase.from('usuarios').delete().eq('id', testProfessorId);
    await supabase.auth.admin.deleteUser(testProfessorId);
  }
  if (testEmpresaId) {
    await supabase.from('empresas').delete().eq('id', testEmpresaId);
  }
});
```

## Coverage

**Requirements:** No explicit coverage thresholds enforced

**Collection configured for:**
```javascript
// jest.config.js
collectCoverageFrom: [
  'lib/**/*.ts',
  'backend/**/*.ts',
  'types/**/*.ts',
  '!**/*.d.ts',
],
```

Note: The `collectCoverageFrom` paths (`lib/`, `backend/`) appear to be legacy paths that may not match the current `app/shared/` structure. Coverage collection may need updating.

**View Coverage:**
```bash
npx jest --coverage
```

## Test Types

**Unit Tests:**
- Located in `tests/unit/`, `tests/core/`, `tests/cronograma/`, `tests/flashcards/`, `tests/agendamentos/turma-filter.test.ts`
- Test individual services, pure functions, and components in isolation
- Mock all external dependencies (database, cache, auth)
- Fast execution, no external service requirements

**Integration Tests (DB-dependent):**
- Located in `tests/integration/`, `tests/security/`, `tests/agendamentos/recorrencia.test.ts`
- Require real Supabase credentials
- Test RLS policies, tenant isolation, database constraints
- Use `describeIfSupabase` pattern to skip when env is unavailable
- Create real database records, clean up in `afterAll`

**Performance Tests:**
- Located in `tests/performance/`
- Benchmark service operations with artificial delays
- Test chunking strategies and parallel query performance

**Type Safety Tests:**
- Located in `tests/typescript-type-fixes/`
- Regression tests for TypeScript type correctness
- Test backward compatibility, insert/update type safety, query result inference

**Component Tests:**
- Located in `tests/unit/` with `.test.tsx` extension
- Use `@jest-environment jsdom` docblock directive
- Use `@testing-library/react` for rendering and querying
- Mock child components to isolate the component under test

**E2E Tests:**
- Framework: Playwright (configured but minimal)
- Config: `playwright.config.ts`
- Test directory: `e2e/`
- Single test file: `e2e/landing.spec.ts`
- Configured for 3 browsers: Chromium, Firefox, WebKit
- Local dev server started automatically (`npm run dev`)
- Minimal coverage - only tests landing page loads

## Common Patterns

**Async Testing:**
```typescript
it("should handle async operation", async () => {
  mockRepository.getExistingDisciplineIds.mockResolvedValue(["disc-1"]);

  await expect(service.create(invalidPayload)).rejects.toThrow(CourseValidationError);
  await expect(service.create(invalidPayload)).rejects.toThrow('Discipline with id "disc-2" does not exist');
});
```

**Error Testing:**
```typescript
it("should throw error for invalid input", async () => {
  await expect(service.create(badInput)).rejects.toThrow(DomainError);
  await expect(service.create(badInput)).rejects.toThrow("specific error message");
});

// For DB constraint violations
it("should validate constraint", async () => {
  const { error } = await supabase.from('table').insert(invalidData);
  expect(error).toBeDefined();
  expect(error?.code).toBe('23514'); // Check constraint violation
});
```

**Environment variable testing:**
```typescript
const originalEnv = { ...process.env };

beforeEach(() => {
  for (const key of envKeys) { delete process.env[key]; }
});

afterAll(() => { process.env = originalEnv; });

it("uses correct config when env is set", () => {
  process.env.SMTP_HOST = "smtp.example.com";
  const config = getEmailConfig();
  expect(config.provider).toBe("custom-smtp");
});
```

**Multi-tenant isolation testing:**
```typescript
it("Tenant A User CANNOT see Tenant B's courses", async () => {
  // Setup: Create data for Tenant B using service client
  const { data: courseB } = await serviceClient.from("cursos").insert({ ... });

  // Attack: User A tries to read Tenant B's data
  const { data: coursesVisibleToA } = await tenantA.client.from("cursos").select("*");

  // Assert: B's data is not visible to A
  expect(coursesVisibleToA?.some(c => c.id === courseB?.id)).toBe(false);
});
```

## CI/CD Pipeline

**CI workflow:** `.github/workflows/deploy-caprover.yml`
- Triggered on push to `main` branch
- Currently only handles Docker build and deploy (no test step in CI)
- Tests are run locally via `npm run check` or `npm run check:ci`

**CI check commands:**
```bash
npm run check:ci    # lint (zero warnings) + typecheck + color validation + tests
```

**Note:** The CI pipeline does not currently run tests automatically on push. Tests are enforced through the local `check:ci` script. This is a gap - tests should be added to the CI workflow.

## What's Tested vs What's Not

**Well-tested areas:**
- Tenant isolation / RLS policies (`tests/security/`, `tests/integration/`)
- Domain services: curso, termos, flashcards, cronograma, agendamentos
- Brand customization (25+ test files)
- TypeScript type safety (regression tests)
- Core infrastructure: email config, plan limits, permissions
- Performance benchmarks for dashboard analytics

**Under-tested areas:**
- API route handlers (tested indirectly through services, not directly)
- Client components (only 2 component test files)
- Custom hooks (no tests for `use-breakpoint.ts`, `use-study-timer.ts`, etc.)
- Server actions (tested indirectly, not as isolated units)
- Authentication flow (`getAuthenticatedUser`, `requireUser`)
- Middleware logic
- TanStack Table configurations
- E2E flows (only landing page tested)

## Jest Configuration Details

```javascript
// jest.config.js
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,  // 30 seconds (long for integration tests)
}
```

---

*Testing analysis: 2026-03-23*
