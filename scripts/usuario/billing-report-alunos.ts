/**
 * Relatório de alunos por empresa para cobrança.
 * Conta alunos cadastrados e ativos no final de cada mês.
 *
 * Dupla verificação: fetchAll (paginado) + count exact (Supabase).
 * Se os valores divergirem, sinaliza erro.
 *
 * Execute com:
 *   npx tsx scripts/usuario/billing-report-alunos.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Variáveis de ambiente não configuradas");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Busca todos os registros paginando de 1000 em 1000 */
async function fetchAll<T>(
  queryFn: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await queryFn(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

interface AlunoRecord {
  usuario_id: string;
  created_at: string;
  ativo: boolean;
  deleted_at: string | null;
}

interface EmpresaResult {
  empresa: string;
  empresaId: string;
  janeiro: { ativos: number };
  fevereiro: { ativos: number };
  marcoAtual: { ativos: number };
  totalAtualVerificado: boolean;
}

const CORTES = [
  { label: "Janeiro/2026", fim: "2026-01-31T23:59:59.999Z" },
  { label: "Fevereiro/2026", fim: "2026-02-28T23:59:59.999Z" },
  { label: "Março/2026 (hoje)", fim: new Date().toISOString() },
];

/**
 * Conta alunos ativos em uma data de corte.
 * Critério: created_at <= corte AND ativo = true AND (deleted_at IS NULL OR deleted_at > corte)
 */
function countAtivosNaData(alunos: AlunoRecord[], corte: string): number {
  const ids = new Set<string>();
  for (const a of alunos) {
    if (a.created_at > corte) continue;
    if (!a.ativo) continue;
    if (a.deleted_at && a.deleted_at <= corte) continue;
    ids.add(a.usuario_id);
  }
  return ids.size;
}

async function main() {
  // 1. Buscar TODAS as empresas
  const empresas = await fetchAll<{ id: string; nome: string; ativo: boolean }>(
    (from, to) =>
      supabase
        .from("empresas")
        .select("id, nome, ativo")
        .order("nome", { ascending: true })
        .range(from, to),
  );

  console.log(`\nEmpresas encontradas: ${empresas.length}\n`);

  const resultados: EmpresaResult[] = [];
  let temErro = false;

  for (const empresa of empresas) {
    // 2. Buscar TODOS os vínculos de aluno da empresa (paginado)
    const alunos = await fetchAll<AlunoRecord>((from, to) =>
      supabase
        .from("usuarios_empresas")
        .select("usuario_id, created_at, ativo, deleted_at")
        .eq("empresa_id", empresa.id)
        .eq("papel_base", "aluno")
        .range(from, to),
    );

    // 3. Verificação cruzada: count exact do Supabase
    const { count: countExact } = await supabase
      .from("usuarios_empresas")
      .select("usuario_id", { count: "exact", head: true })
      .eq("empresa_id", empresa.id)
      .eq("papel_base", "aluno");

    const verificado = alunos.length === (countExact ?? 0);
    if (!verificado) {
      console.error(
        `⚠️  DIVERGÊNCIA em "${empresa.nome}": fetchAll=${alunos.length}, count=${countExact}`,
      );
      temErro = true;
    }

    // 4. Verificar duplicatas de usuario_id
    const idsUnicos = new Set(alunos.map((a) => a.usuario_id));
    if (idsUnicos.size !== alunos.length) {
      console.error(
        `⚠️  DUPLICATA em "${empresa.nome}": ${alunos.length} registros, ${idsUnicos.size} IDs únicos`,
      );
      temErro = true;
    }

    // 5. Contar ativos em cada corte
    const janeiro = countAtivosNaData(alunos, CORTES[0].fim);
    const fevereiro = countAtivosNaData(alunos, CORTES[1].fim);
    const marcoAtual = countAtivosNaData(alunos, CORTES[2].fim);

    resultados.push({
      empresa: empresa.nome,
      empresaId: empresa.id,
      janeiro: { ativos: janeiro },
      fevereiro: { ativos: fevereiro },
      marcoAtual: { ativos: marcoAtual },
      totalAtualVerificado: verificado,
    });
  }

  // 6. Exibir relatório
  console.log("=".repeat(90));
  console.log("  RELATÓRIO DE ALUNOS ATIVOS POR EMPRESA — PARA COBRANÇA");
  console.log(
    `  Data de geração: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  );
  console.log("=".repeat(90));
  console.log();
  console.log(
    padRight("Empresa", 35) +
      padLeft("Jan/2026", 12) +
      padLeft("Fev/2026", 12) +
      padLeft("Mar/2026*", 12) +
      padLeft("Verificado", 12),
  );
  console.log("-".repeat(83));

  let totalJan = 0;
  let totalFev = 0;
  let totalMar = 0;

  for (const r of resultados) {
    totalJan += r.janeiro.ativos;
    totalFev += r.fevereiro.ativos;
    totalMar += r.marcoAtual.ativos;

    console.log(
      padRight(r.empresa, 35) +
        padLeft(String(r.janeiro.ativos), 12) +
        padLeft(String(r.fevereiro.ativos), 12) +
        padLeft(String(r.marcoAtual.ativos), 12) +
        padLeft(r.totalAtualVerificado ? "OK" : "ERRO", 12),
    );
  }

  console.log("-".repeat(83));
  console.log(
    padRight("TOTAL", 35) +
      padLeft(String(totalJan), 12) +
      padLeft(String(totalFev), 12) +
      padLeft(String(totalMar), 12),
  );
  console.log();
  console.log("* Mar/2026 = posição atual (até " + new Date().toISOString().split("T")[0] + ")");
  console.log(
    "Critério: papel_base='aluno', ativo=true, não deletado na data de corte.",
  );
  console.log(
    "Verificado = fetchAll (paginado) bate com count exact do Supabase.",
  );

  if (temErro) {
    console.log(
      "\n⚠️  ATENÇÃO: Houve divergências. Revise os dados antes de usar para cobrança.",
    );
    process.exit(1);
  } else {
    console.log("\n✅ Todos os dados verificados com sucesso. Nenhuma divergência.");
  }
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
