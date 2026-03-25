---
status: awaiting_human_verify
trigger: "Dashboard institution API retorna 500 com fetchAllRows: TypeError: fetch failed em producao. Causa raiz identificada: queries .in() com arrays grandes de UUIDs ultrapassam limite de URL do PostgREST/Supabase."
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Unbounded .in() arrays cause PostgREST URL overflow
test: Fix implemented and self-verified (typecheck + lint + 17 unit tests)
expecting: User confirms dashboard loads in production with large institution
next_action: Awaiting human verification in production environment

## Symptoms

expected: Dashboard da instituicao carrega normalmente com dados agregados
actual: Erro 500 com mensagem "fetchAllRows: TypeError: fetch failed" - 4 tentativas consecutivas falharam
errors: fetchAllRows: TypeError: fetch failed (originado de app/shared/core/database/fetch-all-rows.ts quando Supabase client faz HTTP request com URL excessivamente longa)
reproduction: Acessar /api/dashboard/institution?period=mensal em producao (instituicao com muitos alunos)
started: Acontece em producao quando numero de alunos cresceu alem do limite de URL

## Eliminated

## Research

### Supabase/PostgREST .in() URL Length Limitation

**Problem confirmed via GitHub issues:**
- Issue #393 (postgrest-js): URI too long error with large filters
- Issue #423 (postgrest-js): .in() maximum filter size receives "URI too long" error (800 items)
- Issue #2125 (PostgREST): Proposes SEARCH/QUERY HTTP method for body parameters

**Root cause:** PostgREST uses GET requests where filters are in the URL query string. HTTP servers typically limit URL length to ~2KB-8KB. A UUID is 36 chars; with URL encoding and the `in.()` PostgREST syntax, ~200 UUIDs can fit safely.

**Official recommended workarounds:**
1. Use RPC calls (POST body instead of GET URL) - requires DB function creation
2. Chunking/batching client-side - split large arrays into smaller chunks

**Decision:** Client-side chunking utility is the best approach because:
- No database migration needed
- Transparent to callers
- Works with existing Supabase JS client patterns
- Can be applied broadly via a composable utility

### Batch Size Calculation

- UUID = 36 chars + comma = 37 chars per ID
- PostgREST `.in()` syntax overhead: `column=in.(...)` ~ 30 chars
- Safe URL limit: ~3KB for query string
- 3000 / 37 = ~81 UUIDs raw, but base URL + other filters take space
- Conservative safe batch: **200 UUIDs per chunk** (well within limits)
- For short IDs or columns, could be higher, but 200 is universally safe

## Evidence

- timestamp: 2026-03-24T00:01:00Z
  checked: fetch-all-rows.ts
  found: Simple pagination utility, no awareness of .in() filter size. Error thrown at line 46 wraps the original fetch failure.
  implication: The error message "fetchAllRows: TypeError: fetch failed" matches - the HTTP request itself fails because URL is too long.

- timestamp: 2026-03-24T00:02:00Z
  checked: institution-analytics.service.ts - all .in() calls
  found: 16 .in() calls total. Key unbounded ones use `alunoIds` (fetched via getUserIdsByRole, which uses fetchAllRows with no limit). In production with many students, alunoIds could be 500+ UUIDs.
  implication: Direct root cause. 500 UUIDs * 37 chars each = 18,500 chars in query string, far exceeding typical ~3-8KB limits.

- timestamp: 2026-03-24T00:03:00Z
  checked: Some .in() calls use bounded arrays (topStudentIds limited to 10, profIds limited by .limit(100), disciplineIds limited to 20)
  found: Only calls using `alunoIds` and `cronogramaIds` (derived from alunoIds) are unbounded and dangerous
  implication: Fix should handle all .in() calls generically but the critical paths are the alunoIds-based queries

## Resolution

root_cause: Queries .in() in institution-analytics.service.ts pass unbounded arrays of UUIDs (alunoIds, cronogramaIds) to PostgREST GET requests. When institution has 200+ students, the resulting URL exceeds HTTP server limits (~3-8KB), causing "TypeError: fetch failed".
fix: Created chunked-query.ts utility with fetchAllRowsChunked, fetchCountChunked, and fetchRowsChunked functions. These accept a query factory function (to handle Supabase mutable query builder) and split large .in() arrays into batches of 200 (matching postgrest-js own warning threshold). Applied to all 10 unbounded .in() calls in institution-analytics.service.ts. Bounded calls (topStudentIds max 10, profIds max 100) left as-is with comments.
verification: TypeScript typecheck passes. ESLint passes. 17 unit tests pass covering empty arrays, single chunk, multi-chunk, exact chunk size, default chunk size of 200, error propagation, and null handling.
files_changed:
  - app/shared/core/database/chunked-query.ts (new)
  - app/[tenant]/(modules)/dashboard/services/institution-analytics.service.ts (modified)
  - tests/core/chunked-query.test.ts (new)
