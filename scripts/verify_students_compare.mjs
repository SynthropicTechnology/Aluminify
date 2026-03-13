import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import ExcelJS from "exceljs";

// Read .env.local for Supabase credentials
const envContent = readFileSync(".env.local", "utf8");
const getEnv = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey =
  getEnv("SUPABASE_SECRET_KEY") ||
  getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

// Product name mapping: Hotmart → DB course name
const productToCourse = {
  "Redação 360º [extensivo 2026]": "Redação 360º",
  "Salinha de redação | Ao vivo [Extensivo 2026]": "Salinha de redação ao vivo",
  "Salinha de redação | Presencial [Extensivo 2026]":
    "Salinha de redação presencial",
  "Quero 02 atendimentos mensais - Plantões":
    "Quero 02 atendimentos individual - Plantões",
  "Quero 04 atendimentos mensais - Plantões":
    "Quero 04 atendimentos individual - Plantões",
  "Redação 360º VIP + Linguagens": "Redação 360º VIP + Linguagens",
  "Redação 360º VIP [extensivo 2026]": "Redação 360ª VIP",
  "Salinha ao vivo + Linguagens": "Salinha ao vivo + Linguagens",
  " Quero mais correções ": "Quero atendimento individual",
};

// Some products from the large sheet also include a "+Linguagens" variant
// "Redação 360º [extensivo 2026]" with additional "Linguagens" → "Redação 360º + Linguagens"
// We'll handle based on what the Excel actually shows

async function main() {
  async function readFirstSheetAsObjects(filename) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      throw new Error(
        `Falha ao ler "${filename}". Este script suporta apenas arquivos .xlsx (ExcelJS). Detalhes: ${message}`,
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values
      .slice(1)
      .map((value) => String(value ?? "").trim());

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowObj = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const key = headers[colNumber - 1];
        if (!key) return;
        const value = cell.text ?? (cell.value != null ? String(cell.value) : "");
        rowObj[key] = String(value ?? "").trim();
      });
      if (Object.values(rowObj).some((v) => String(v ?? "").trim())) {
        rows.push(rowObj);
      }
    });

    return rows;
  }

  // Parse both Excel files
  const data1 = await readFirstSheetAsObjects(
    "sales_history_ salinha presencial 2026.xlsx",
  );

  const data2 = await readFirstSheetAsObjects(
    "sales_history_23-11 a 02-02-26.xlsx",
  );

  // Combine all students by email with their expected courses
  const excelStudents = new Map();

  function addStudent(row, source) {
    const email = (row["Email"] || "").toLowerCase().trim();
    if (!email) return;

    const productName = row["Nome do Produto"];
    const courseName = productToCourse[productName];

    if (!courseName) {
      console.log(`WARNING: Unmapped product: "${productName}"`);
      return;
    }

    if (!excelStudents.has(email)) {
      excelStudents.set(email, {
        nome: row["Nome"],
        email,
        expectedCourses: new Set(),
        sources: new Set(),
      });
    }
    const s = excelStudents.get(email);
    s.expectedCourses.add(courseName);
    s.sources.add(source);
  }

  data1.forEach((r) => addStudent(r, "salinha_presencial"));
  data2.forEach((r) => addStudent(r, "sales_history"));

  console.log(`Total unique students from Excel: ${excelStudents.size}\n`);

  // Get all students from DB linked to jana-rabelo courses
  const empresaId = "c64a0fcc-5990-4b87-9de5-c4dbc6cb8da7";

  // If RPC doesn't exist, use direct query
  let dbMap = new Map();

  // Query via REST API approach
  const { data: courses } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("empresa_id", empresaId);

  const courseMap = new Map(courses.map((c) => [c.id, c.nome]));

  // Get all enrollments
  const courseIds = courses.map((c) => c.id);
  const { data: enrollments } = await supabase
    .from("alunos_cursos")
    .select("usuario_id, curso_id")
    .in("curso_id", courseIds);

  // Get all users involved
  const userIds = [...new Set(enrollments.map((e) => e.usuario_id))];

  // Batch fetch users (Supabase has limits)
  const allUsers = [];
  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const { data: users } = await supabase
      .from("usuarios")
      .select("id, email, nome_completo, ativo")
      .in("id", batch);
    allUsers.push(...users);
  }

  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Build DB student map: email → {courses, nome, ativo}
  for (const enrollment of enrollments) {
    const user = userMap.get(enrollment.usuario_id);
    if (!user) continue;

    const email = user.email.toLowerCase().trim();
    const courseName = courseMap.get(enrollment.curso_id);

    if (!dbMap.has(email)) {
      dbMap.set(email, {
        nome: user.nome_completo,
        email,
        ativo: user.ativo,
        courses: new Set(),
      });
    }
    dbMap.get(email).courses.add(courseName);
  }

  console.log(`Total students with courses in DB: ${dbMap.size}\n`);

  // === ANALYSIS ===
  const notInDb = [];
  const missingCourses = [];
  const correct = [];

  for (const [email, excel] of excelStudents) {
    const db = dbMap.get(email);

    if (!db) {
      notInDb.push({
        email,
        nome: excel.nome,
        expectedCourses: [...excel.expectedCourses],
      });
      continue;
    }

    const expectedSet = excel.expectedCourses;
    const actualSet = db.courses;

    const missing = [...expectedSet].filter((c) => !actualSet.has(c));
    const extra = [...actualSet].filter((c) => !expectedSet.has(c));

    if (missing.length === 0) {
      correct.push({ email, nome: excel.nome, courses: [...expectedSet] });
    } else {
      missingCourses.push({
        email,
        nome: excel.nome,
        expected: [...expectedSet],
        actual: [...actualSet],
        missing,
        extra,
      });
    }
  }

  // === REPORT ===
  console.log("=".repeat(80));
  console.log("VERIFICATION REPORT");
  console.log("=".repeat(80));

  console.log(
    `\n✓ Students correctly registered with all expected courses: ${correct.length}`,
  );
  console.log(`✗ Students NOT found in DB at all: ${notInDb.length}`);
  console.log(
    `⚠ Students in DB but MISSING expected courses: ${missingCourses.length}`,
  );

  if (notInDb.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("STUDENTS NOT IN DATABASE:");
    console.log("=".repeat(80));
    notInDb.forEach((s) => {
      console.log(`  Email: ${s.email}`);
      console.log(`  Nome:  ${s.nome}`);
      console.log(`  Expected courses: ${s.expectedCourses.join(", ")}`);
      console.log("");
    });
  }

  if (missingCourses.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("STUDENTS WITH MISSING COURSES:");
    console.log("=".repeat(80));
    missingCourses.forEach((s) => {
      console.log(`  Email: ${s.email}`);
      console.log(`  Nome:  ${s.nome}`);
      console.log(`  Expected: ${s.expected.join(", ")}`);
      console.log(`  Actual:   ${s.actual.join(", ")}`);
      console.log(`  MISSING:  ${s.missing.join(", ")}`);
      if (s.extra.length) console.log(`  EXTRA:    ${s.extra.join(", ")}`);
      console.log("");
    });
  }

  // Summary per course
  console.log("\n" + "=".repeat(80));
  console.log("COURSE SUMMARY (Excel expected vs DB actual):");
  console.log("=".repeat(80));

  const courseStats = {};
  for (const [email, excel] of excelStudents) {
    const db = dbMap.get(email);
    for (const course of excel.expectedCourses) {
      if (!courseStats[course])
        courseStats[course] = { expected: 0, found: 0, missing: 0 };
      courseStats[course].expected++;
      if (db && db.courses.has(course)) {
        courseStats[course].found++;
      } else {
        courseStats[course].missing++;
      }
    }
  }

  for (const [course, stats] of Object.entries(courseStats).sort(
    (a, b) => b[1].expected - a[1].expected,
  )) {
    const status = stats.missing === 0 ? "✓" : "✗";
    console.log(
      `  ${status} ${course}: ${stats.found}/${stats.expected} (missing: ${stats.missing})`,
    );
  }
}

main().catch(console.error);
