/**
 * Utilitario para executar queries Supabase com filtros `.in()` que podem
 * conter arrays grandes de valores, contornando o limite de tamanho de URL
 * do PostgREST.
 *
 * O PostgREST usa requisicoes GET com filtros na query string. Quando um
 * filtro `.in()` recebe muitos valores (ex: 200+ UUIDs), a URL excede o
 * limite do servidor (~3-8KB), causando "TypeError: fetch failed".
 *
 * Este modulo divide arrays grandes em lotes menores, executa as queries
 * em paralelo e combina os resultados.
 *
 * IMPORTANTE: O query builder do Supabase JS e MUTAVEL — cada `.in()`, `.eq()`,
 * etc. modifica o objeto in-place. Por isso, as funcoes deste modulo recebem
 * uma **funcao factory** que cria um novo query builder para cada lote.
 *
 * @see https://github.com/supabase/postgrest-js/issues/423
 * @see https://github.com/supabase/postgrest-js/issues/393
 *
 * @example
 * ```typescript
 * import { fetchAllRowsChunked, fetchCountChunked } from "@/app/shared/core/database/chunked-query";
 *
 * // Buscar todos os registros com .in() seguro
 * const sessoes = await fetchAllRowsChunked(
 *   (ids) => client
 *     .from("sessoes_estudo")
 *     .select("usuario_id, tempo_total_liquido_segundos")
 *     .in("usuario_id", ids)
 *     .gte("created_at", startDate.toISOString()),
 *   alunoIds,
 * );
 *
 * // Contar registros com .in() seguro
 * const total = await fetchCountChunked(
 *   (ids) => client
 *     .from("cronograma_itens")
 *     .select("id", { count: "exact", head: true })
 *     .in("cronograma_id", ids),
 *   cronogramaIds,
 * );
 * ```
 */

import { fetchAllRows } from "./fetch-all-rows";

/**
 * Tamanho maximo de cada lote para filtros `.in()`.
 *
 * Cada UUID tem 36 caracteres + 1 virgula = 37 chars.
 * Com 200 UUIDs: ~7.400 chars na query string, dentro do limite seguro.
 * A propria lib postgrest-js adverte sobre arrays com 200+ IDs.
 */
const DEFAULT_CHUNK_SIZE = 200;

/**
 * Divide um array em lotes (chunks) de tamanho fixo.
 */
function chunk<T>(array: T[], size: number): T[][] {
  if (array.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Tipo para a funcao factory que cria um query builder com o filtro `.in()` aplicado.
 *
 * O Supabase JS client retorna builders encadeados com tipos complexos.
 * Usamos `any` aqui porque o tipo exato depende da tabela, select e filtros
 * anteriores — impossivel de tipar genericamente sem perder a ergonomia.
 *
 * A funcao recebe o subconjunto de valores para o lote atual e deve retornar
 * um query builder completo (com `.from().select().in()` e quaisquer filtros).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryFactory = (chunkValues: string[]) => any;

/**
 * Busca todos os registros usando `fetchAllRows` com chunking automatico
 * para o filtro `.in()`.
 *
 * Quando `values` tem mais elementos que `chunkSize`, divide em lotes,
 * executa queries em paralelo e concatena os resultados.
 * Quando `values` cabe em um unico lote, executa normalmente sem overhead.
 *
 * @param queryFactory - Funcao que recebe um array de IDs e retorna um query builder completo
 * @param values - Array completo de valores para filtrar
 * @param chunkSize - Tamanho maximo de cada lote (padrao: 200)
 * @returns Array com todos os registros de todos os lotes
 *
 * @example
 * ```typescript
 * const sessoes = await fetchAllRowsChunked(
 *   (ids) => client
 *     .from("sessoes_estudo")
 *     .select("usuario_id, tempo_total_liquido_segundos")
 *     .in("usuario_id", ids)
 *     .gte("created_at", startDate),
 *   alunoIds,
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRowsChunked<T = any>(
  queryFactory: QueryFactory,
  values: string[],
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<T[]> {
  if (values.length === 0) return [];

  // Se cabe em um unico lote, executa direto sem overhead
  if (values.length <= chunkSize) {
    return fetchAllRows<T>(queryFactory(values));
  }

  // Divide em lotes e executa em paralelo
  const chunks = chunk(values, chunkSize);
  const results = await Promise.all(
    chunks.map((chunkValues) => fetchAllRows<T>(queryFactory(chunkValues))),
  );

  return results.flat();
}

/**
 * Conta registros com chunking automatico para o filtro `.in()`.
 *
 * Equivalente a `.select("id", { count: "exact", head: true }).in(column, values)`,
 * mas divide arrays grandes em lotes e soma os counts.
 *
 * @param queryFactory - Funcao que recebe um array de IDs e retorna um count query builder
 * @param values - Array completo de valores para filtrar
 * @param chunkSize - Tamanho maximo de cada lote (padrao: 200)
 * @returns Contagem total somada de todos os lotes
 *
 * @example
 * ```typescript
 * const total = await fetchCountChunked(
 *   (ids) => client
 *     .from("cronograma_itens")
 *     .select("id", { count: "exact", head: true })
 *     .in("cronograma_id", ids)
 *     .eq("aula_assistida", true),
 *   cronogramaIds,
 * );
 * ```
 */
export async function fetchCountChunked(
  queryFactory: QueryFactory,
  values: string[],
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<number> {
  if (values.length === 0) return 0;

  // Se cabe em um unico lote, executa direto
  if (values.length <= chunkSize) {
    const { count, error } = await queryFactory(values);
    if (error) {
      throw new Error(`fetchCountChunked: ${error.message}`);
    }
    return count ?? 0;
  }

  // Divide em lotes e soma os counts
  const chunks = chunk(values, chunkSize);
  const counts = await Promise.all(
    chunks.map(async (chunkValues) => {
      const { count, error } = await queryFactory(chunkValues);
      if (error) {
        throw new Error(`fetchCountChunked: ${error.message}`);
      }
      return count ?? 0;
    }),
  );

  return counts.reduce((sum, c) => sum + c, 0);
}

/**
 * Busca registros (sem paginacao fetchAllRows) com chunking automatico
 * para o filtro `.in()`.
 *
 * Util para queries que usam `.limit()` ou nao precisam de paginacao completa.
 * Os resultados de cada lote sao concatenados.
 *
 * @param queryFactory - Funcao que recebe um array de IDs e retorna um query builder completo
 * @param values - Array completo de valores para filtrar
 * @param chunkSize - Tamanho maximo de cada lote (padrao: 200)
 * @returns Array com todos os registros de todos os lotes
 *
 * @example
 * ```typescript
 * const usuarios = await fetchRowsChunked<{ id: string; nome_completo: string | null }>(
 *   (ids) => client
 *     .from("usuarios")
 *     .select("id, nome_completo")
 *     .in("id", ids),
 *   userIds,
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchRowsChunked<T = any>(
  queryFactory: QueryFactory,
  values: string[],
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<T[]> {
  if (values.length === 0) return [];

  // Se cabe em um unico lote, executa direto
  if (values.length <= chunkSize) {
    const { data, error } = await queryFactory(values);
    if (error) {
      throw new Error(`fetchRowsChunked: ${error.message}`);
    }
    return (data as T[]) ?? [];
  }

  // Divide em lotes e executa em paralelo
  const chunks = chunk(values, chunkSize);
  const results = await Promise.all(
    chunks.map(async (chunkValues) => {
      const { data, error } = await queryFactory(chunkValues);
      if (error) {
        throw new Error(`fetchRowsChunked: ${error.message}`);
      }
      return (data as T[]) ?? [];
    }),
  );

  return results.flat();
}
