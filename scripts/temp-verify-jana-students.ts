/**
 * Verifica TODOS os alunos de TODAS as abas da planilha.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import ExcelJS from "exceljs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Mapeamento de nomes de cursos Excel -> Sistema
const cursoNameMapping: Record<string, string> = {
  "Quero 02 atendimentos mensais - Plantões": "Quero 02 atendimentos individual - Plantões",
  "Quero 04 atendimentos mensais - Plantões": "Quero 04 atendimentos individual - Plantões",
  "Redação 360º VIP [extensivo 2026]": "Redação 360ª VIP",
  "Salinha de redação | Presencial [Extensivo 2026]": "Salinha de redação presencial",
  "Salinha de redação | Ao vivo [Extensivo 2026]": "Salinha de redação ao vivo",
  "Salinha ao vivo + Linguagens": "Salinha ao vivo + Linguagens",
  "Redação 360º [extensivo 2026]": "Redação 360º",
  "Redação 360º + Linguagens": "Redação 360º + Linguagens",
};

type StudentRow = {
  sheetName: string;
  turma: string;
  nome: string;
  cpf: string;
  email: string;
};

type VerificationResult = {
  email: string;
  nome: string;
  cursoExcel: string;
  cursoSistema: string;
  sheetName: string;
  existeUsuario: boolean;
  existeVinculoEmpresa: boolean;
  existeVinculoCurso: boolean;
  problemas: string[];
};

async function main() {
  console.log("=".repeat(70));
  console.log("Verificação completa de alunos - Jana Rabelo");
  console.log("=".repeat(70));

  const allStudents: StudentRow[] = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("Alunos sem acesso à Aluminify.xlsx");

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    const rawData = worksheet
      .getSheetValues()
      .slice(1)
      .map((row) => (Array.isArray(row) ? row.slice(1) : [])) as unknown[][];

    // Skip header, parse students
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[4]) continue; // skip empty rows

      allStudents.push({
        sheetName,
        turma: String(row[0] ?? ""),
        nome: String(row[2] ?? ""),
        cpf: String(row[3] ?? "").replace(/\D/g, ""),
        email: String(row[4] ?? "").trim().toLowerCase(),
      });
    }
  }

  console.log(`\nTotal de alunos na planilha: ${allStudents.length}\n`);

  // Get Jana Rabelo empresa
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nome")
    .ilike("nome", "%jana%")
    .single();

  if (!empresa) throw new Error("Empresa Jana Rabelo não encontrada");
  console.log(`Empresa: ${empresa.nome} (${empresa.id})\n`);

  // Get all courses for Jana Rabelo
  const { data: cursos } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("empresa_id", empresa.id);

  const cursoMap = new Map(cursos?.map((c) => [c.nome, c.id]) ?? []);

  console.log("Cursos no sistema:");
  cursos?.forEach((c) => console.log(`  - ${c.nome}`));
  console.log("");

  // Verify each student
  const results: VerificationResult[] = [];

  for (const student of allStudents) {
    const problemas: string[] = [];

    // Map course name
    const cursoSistema = cursoNameMapping[student.turma] ?? student.turma;
    const cursoId = cursoMap.get(cursoSistema);

    // 1) Check if user exists
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", student.email)
      .is("deleted_at", null)
      .maybeSingle();

    const existeUsuario = !!usuario;
    if (!existeUsuario) {
      problemas.push("Usuário não existe");
    }

    // 2) Check empresa link
    let existeVinculoEmpresa = false;
    if (usuario) {
      const { data: vinculo } = await supabase
        .from("usuarios_empresas")
        .select("id")
        .eq("usuario_id", usuario.id)
        .eq("empresa_id", empresa.id)
        .is("deleted_at", null)
        .maybeSingle();

      existeVinculoEmpresa = !!vinculo;
      if (!existeVinculoEmpresa) {
        problemas.push("Sem vínculo com empresa");
      }
    }

    // 3) Check course enrollment
    let existeVinculoCurso = false;
    if (!cursoId) {
      problemas.push(`Curso não mapeado: "${student.turma}"`);
    } else if (usuario) {
      const { data: matricula } = await supabase
        .from("alunos_cursos")
        .select("curso_id")
        .eq("usuario_id", usuario.id)
        .eq("curso_id", cursoId)
        .maybeSingle();

      existeVinculoCurso = !!matricula;
      if (!existeVinculoCurso) {
        problemas.push(`Não matriculado no curso`);
      }
    }

    results.push({
      email: student.email,
      nome: student.nome,
      cursoExcel: student.turma,
      cursoSistema,
      sheetName: student.sheetName,
      existeUsuario,
      existeVinculoEmpresa,
      existeVinculoCurso,
      problemas,
    });
  }

  // Separate OK and problems
  const ok = results.filter((r) => r.problemas.length === 0);
  const comProblema = results.filter((r) => r.problemas.length > 0);

  // Group problems by type
  const naoExiste = comProblema.filter((r) => !r.existeUsuario);
  const semVinculoEmpresa = comProblema.filter((r) => r.existeUsuario && !r.existeVinculoEmpresa);
  const semVinculoCurso = comProblema.filter(
    (r) => r.existeUsuario && r.existeVinculoEmpresa && !r.existeVinculoCurso
  );

  console.log("=".repeat(70));
  console.log("RESULTADOS");
  console.log("=".repeat(70));

  console.log(`\n✅ Alunos OK: ${ok.length}/${results.length}`);

  if (naoExiste.length > 0) {
    console.log(`\n❌ Usuários que NÃO EXISTEM no sistema (${naoExiste.length}):`);
    for (const r of naoExiste) {
      console.log(`   - ${r.email} | ${r.nome} | ${r.cursoExcel}`);
    }
  }

  if (semVinculoEmpresa.length > 0) {
    console.log(`\n⚠️  Usuários SEM VÍNCULO com a empresa (${semVinculoEmpresa.length}):`);
    for (const r of semVinculoEmpresa) {
      console.log(`   - ${r.email} | ${r.nome}`);
    }
  }

  if (semVinculoCurso.length > 0) {
    console.log(`\n⚠️  Usuários SEM MATRÍCULA no curso indicado (${semVinculoCurso.length}):`);
    for (const r of semVinculoCurso) {
      console.log(`   - ${r.email} | ${r.nome} | Curso: ${r.cursoSistema}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("RESUMO:");
  console.log(`  Total na planilha: ${results.length}`);
  console.log(`  ✅ OK: ${ok.length}`);
  console.log(`  ❌ Não existem: ${naoExiste.length}`);
  console.log(`  ⚠️  Sem vínculo empresa: ${semVinculoEmpresa.length}`);
  console.log(`  ⚠️  Sem matrícula curso: ${semVinculoCurso.length}`);
  console.log("=".repeat(70));
}

main().catch(console.error);
