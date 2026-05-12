/**
 * Diagnostica divergencias entre alunos_cursos, matriculas, usuarios e usuarios_empresas.
 *
 * Uso:
 *   npx tsx scripts/usuario/diagnose-active-enrollments.ts
 *   npx tsx scripts/usuario/diagnose-active-enrollments.ts jana-rabelo
 *
 * Requisitos: .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

interface DiagnosticRow {
  empresa_id: string;
  empresa_nome: string;
  empresa_slug: string;
  alunos_em_alunos_cursos: number;
  alunos_em_matriculas_ativas: number;
  alunos_em_ambas: number;
  somente_alunos_cursos: number;
  somente_matriculas_ativas: number;
  usuarios_empresas_alunos_ativos: number;
}

function addToMapSet(map: Map<string, Set<string>>, key: string | null, value: string | null) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(value);
}

function intersectSize(left: Set<string>, right: Set<string>): number {
  let total = 0;
  for (const value of left) {
    if (right.has(value)) total += 1;
  }
  return total;
}

function differenceSize(left: Set<string>, right: Set<string>): number {
  let total = 0;
  for (const value of left) {
    if (!right.has(value)) total += 1;
  }
  return total;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local");
    process.exit(1);
  }

  const slug = process.argv[2]?.trim();
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let empresasQuery = supabase
    .from("empresas")
    .select("id, nome, slug")
    .order("nome", { ascending: true });

  if (slug) empresasQuery = empresasQuery.eq("slug", slug);

  const { data: empresas, error: empresasError } = await empresasQuery;
  if (empresasError) {
    console.error("Erro ao carregar empresas:", empresasError.message);
    process.exit(1);
  }

  const empresaIds = (empresas ?? []).map((empresa) => empresa.id);
  if (empresaIds.length === 0) {
    console.log("Nenhuma empresa encontrada.");
    return;
  }

  const [{ data: cursos }, { data: alunosCursos }, { data: matriculas }, { data: usuariosEmpresas }] =
    await Promise.all([
      supabase.from("cursos").select("id, empresa_id").in("empresa_id", empresaIds),
      supabase.from("alunos_cursos").select("usuario_id, curso_id"),
      supabase
        .from("matriculas")
        .select("usuario_id, empresa_id")
        .eq("ativo", true)
        .in("empresa_id", empresaIds),
      supabase
        .from("usuarios_empresas")
        .select("usuario_id, empresa_id")
        .eq("papel_base", "aluno")
        .eq("ativo", true)
        .is("deleted_at", null)
        .in("empresa_id", empresaIds),
    ]);

  const cursoEmpresa = new Map((cursos ?? []).map((curso) => [curso.id, curso.empresa_id]));
  const alunosCursosByEmpresa = new Map<string, Set<string>>();
  const matriculasByEmpresa = new Map<string, Set<string>>();
  const usuariosEmpresasByEmpresa = new Map<string, Set<string>>();

  for (const link of alunosCursos ?? []) {
    addToMapSet(
      alunosCursosByEmpresa,
      cursoEmpresa.get(link.curso_id) ?? null,
      link.usuario_id,
    );
  }

  for (const matricula of matriculas ?? []) {
    addToMapSet(matriculasByEmpresa, matricula.empresa_id, matricula.usuario_id);
  }

  for (const vinculo of usuariosEmpresas ?? []) {
    addToMapSet(usuariosEmpresasByEmpresa, vinculo.empresa_id, vinculo.usuario_id);
  }

  const rows: DiagnosticRow[] = (empresas ?? []).map((empresa) => {
    const ac = alunosCursosByEmpresa.get(empresa.id) ?? new Set<string>();
    const mat = matriculasByEmpresa.get(empresa.id) ?? new Set<string>();
    const ue = usuariosEmpresasByEmpresa.get(empresa.id) ?? new Set<string>();

    return {
      empresa_id: empresa.id,
      empresa_nome: empresa.nome ?? "",
      empresa_slug: empresa.slug ?? "",
      alunos_em_alunos_cursos: ac.size,
      alunos_em_matriculas_ativas: mat.size,
      alunos_em_ambas: intersectSize(ac, mat),
      somente_alunos_cursos: differenceSize(ac, mat),
      somente_matriculas_ativas: differenceSize(mat, ac),
      usuarios_empresas_alunos_ativos: ue.size,
    };
  });

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
