/**
 * Conta alunos cadastrados e ativos por mês (Jan, Fev, Mar 2026) para múltiplas empresas.
 *
 * Execute com:
 *   npx tsx scripts/usuario/count-alunos-por-empresa.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variáveis de ambiente não configuradas");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchAll<T>(
  queryFn: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
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

const EMPRESAS = ["Jana Rabelo", "CDF"];

const MESES = [
  { nome: "Janeiro/2026", inicio: "2026-01-01T00:00:00Z", fim: "2026-01-31T23:59:59Z" },
  { nome: "Fevereiro/2026", inicio: "2026-02-01T00:00:00Z", fim: "2026-02-28T23:59:59Z" },
  { nome: "Março/2026", inicio: "2026-03-01T00:00:00Z", fim: "2026-03-31T23:59:59Z" },
];

async function analisarEmpresa(nomeEmpresa: string) {
  // Buscar empresa
  const { data: empresa, error: errEmpresa } = await supabase
    .from("empresas")
    .select("id, nome")
    .ilike("nome", `%${nomeEmpresa}%`)
    .single();

  if (errEmpresa || !empresa) {
    console.error(`❌ Empresa '${nomeEmpresa}' não encontrada: ${errEmpresa?.message}`);
    return;
  }

  console.log(`\n${"#".repeat(60)}`);
  console.log(`  EMPRESA: ${empresa.nome} (${empresa.id})`);
  console.log(`${"#".repeat(60)}`);

  // Buscar todos os alunos da empresa
  const todosAlunos = await fetchAll<{
    usuario_id: string;
    created_at: string;
    ativo: boolean;
    deleted_at: string | null;
  }>((from, to) =>
    supabase
      .from("usuarios_empresas")
      .select("usuario_id, created_at, ativo, deleted_at")
      .eq("empresa_id", empresa.id)
      .eq("papel_base", "aluno")
      .range(from, to)
  );

  console.log(`\nTotal de alunos na empresa: ${todosAlunos.length}`);

  // Análise mensal da empresa
  console.log(`\n${"─".repeat(50)}`);
  console.log(` Alunos na EMPRESA por mês`);
  console.log(`${"─".repeat(50)}`);

  for (const mes of MESES) {
    const cadastradosAteMes = todosAlunos.filter((a) => a.created_at <= mes.fim);
    const ativos = cadastradosAteMes.filter((a) => {
      const foiDeletadoAntes = a.deleted_at && a.deleted_at <= mes.fim;
      return a.ativo === true && !foiDeletadoAntes;
    });
    const cadastrados = cadastradosAteMes.filter((a) => {
      const foiDeletadoAntes = a.deleted_at && a.deleted_at <= mes.fim;
      return !foiDeletadoAntes;
    });
    const novos = todosAlunos.filter((a) => a.created_at >= mes.inicio && a.created_at <= mes.fim);

    console.log(`\n📅 ${mes.nome}`);
    console.log(`   Cadastrados (acumulado): ${cadastrados.length}`);
    console.log(`   Ativos no fim do mês:    ${ativos.length}`);
    console.log(`   Novos no mês:            ${novos.length}`);
  }

  // Buscar cursos da empresa
  const { data: cursos } = await supabase
    .from("cursos")
    .select("id, nome, ano_vigencia")
    .eq("empresa_id", empresa.id)
    .order("ano_vigencia", { ascending: false });

  if (!cursos || cursos.length === 0) {
    console.log(`\nNenhum curso encontrado para esta empresa.`);
    return;
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(` Alunos por CURSO`);
  console.log(`${"─".repeat(50)}`);

  for (const curso of cursos) {
    const alunosCurso = await fetchAll<{ usuario_id: string; created_at: string | null }>((from, to) =>
      supabase
        .from("alunos_cursos")
        .select("usuario_id, created_at")
        .eq("curso_id", curso.id)
        .range(from, to)
    );

    const { count } = await supabase
      .from("alunos_cursos")
      .select("usuario_id", { count: "exact", head: true })
      .eq("curso_id", curso.id);

    console.log(`\n📚 ${curso.nome} (vigência: ${curso.ano_vigencia}) — ${count ?? alunosCurso.length} alunos`);

    if (alunosCurso.length === 0) continue;

    // Análise mensal por curso
    for (const mes of MESES) {
      const cadastradosAteMes = alunosCurso.filter((a) => a.created_at && a.created_at <= mes.fim);
      const novos = alunosCurso.filter(
        (a) => a.created_at && a.created_at >= mes.inicio && a.created_at <= mes.fim
      );

      console.log(`   📅 ${mes.nome}: acumulado=${cadastradosAteMes.length}, novos=${novos.length}`);
    }
  }
}

async function main() {
  for (const nome of EMPRESAS) {
    await analisarEmpresa(nome);
  }
  console.log("\n");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
