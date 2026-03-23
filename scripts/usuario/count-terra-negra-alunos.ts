/**
 * Conta alunos cadastrados e ativos na empresa "Terra Negra" por mês (Jan, Fev, Mar 2026).
 *
 * Execute com:
 *   npx tsx scripts/usuario/count-terra-negra-alunos.ts
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

/** Busca todos os registros paginando de 1000 em 1000 para evitar truncamento */
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

async function main() {
  // 1. Buscar empresa Terra Negra
  const { data: empresa, error: errEmpresa } = await supabase
    .from("empresas")
    .select("id, nome, slug")
    .ilike("nome", "%Terra Negra%")
    .single();

  if (errEmpresa || !empresa) {
    console.error("❌ Empresa 'Terra Negra' não encontrada:", errEmpresa?.message);
    process.exit(1);
  }

  console.log(`\n✅ Empresa encontrada: ${empresa.nome} (id: ${empresa.id})\n`);

  // 2. Buscar TODOS os alunos da empresa (com paginação)
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

  console.log(`Total de registros encontrados: ${todosAlunos.length}\n`);

  // 3. Definir intervalos dos meses (2026)
  const meses = [
    { nome: "Janeiro/2026", inicio: "2026-01-01T00:00:00Z", fim: "2026-01-31T23:59:59Z" },
    { nome: "Fevereiro/2026", inicio: "2026-02-01T00:00:00Z", fim: "2026-02-28T23:59:59Z" },
    { nome: "Março/2026", inicio: "2026-03-01T00:00:00Z", fim: "2026-03-31T23:59:59Z" },
  ];

  console.log("=".repeat(60));
  console.log(" ALUNOS CADASTRADOS E ATIVOS - TERRA NEGRA");
  console.log("=".repeat(60));

  for (const mes of meses) {
    // Filtrar alunos cadastrados até o final do mês
    const cadastradosAteMes = todosAlunos.filter((a) => a.created_at <= mes.fim);

    // Ativos: cadastrados até o fim do mês, ativo=true, não deletados antes do fim do mês
    const ativos = cadastradosAteMes.filter((a) => {
      const foiDeletadoAntes = a.deleted_at && a.deleted_at <= mes.fim;
      return a.ativo === true && !foiDeletadoAntes;
    });

    // Cadastrados (não deletados até o fim do mês)
    const cadastrados = cadastradosAteMes.filter((a) => {
      const foiDeletadoAntes = a.deleted_at && a.deleted_at <= mes.fim;
      return !foiDeletadoAntes;
    });

    // Novos cadastros DURANTE o mês
    const novosCadastros = todosAlunos.filter((a) => {
      return a.created_at >= mes.inicio && a.created_at <= mes.fim;
    });

    console.log(`\n📅 ${mes.nome}`);
    console.log(`   Cadastrados (acumulado até fim do mês): ${cadastrados.length}`);
    console.log(`   Ativos no fim do mês:                   ${ativos.length}`);
    console.log(`   Novos cadastros no mês:                 ${novosCadastros.length}`);
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
