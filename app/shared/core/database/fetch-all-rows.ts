/**
 * Utilitário para buscar todos os registros de uma query Supabase,
 * contornando o limite padrão de 1.000 linhas por requisição.
 *
 * O Supabase JS client retorna no máximo 1.000 linhas por `.select()`.
 * Este helper pagina automaticamente até buscar todos os resultados.
 *
 * @example
 * ```typescript
 * const allStudents = await fetchAllRows<{ usuario_id: string }>(
 *   client.from("usuarios_empresas")
 *     .select("usuario_id")
 *     .eq("empresa_id", empresaId)
 *     .eq("papel_base", "aluno")
 * );
 * ```
 */

const PAGE_SIZE = 1000;

/**
 * Executa uma query Supabase paginando automaticamente para buscar todos os registros.
 *
 * Recebe um query builder (resultado de `.from().select().eq()...`) e retorna
 * todos os resultados, não apenas os primeiros 1.000.
 *
 * @param queryBuilder - Query Supabase antes de `.range()` ou execução
 * @param pageSize - Tamanho de cada página (padrão: 1000)
 * @returns Array com todos os registros
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  queryBuilder: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryBuilder.range(
      offset,
      offset + pageSize - 1,
    );

    if (error) {
      throw new Error(`fetchAllRows: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    all.push(...data);

    if (data.length < pageSize) break;

    offset += pageSize;
  }

  return all;
}
