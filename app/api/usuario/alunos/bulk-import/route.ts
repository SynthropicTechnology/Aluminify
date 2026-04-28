import { NextResponse } from "next/server";
import {
  createStudentImportService,
  StudentValidationError,
} from "@/app/[tenant]/(modules)/usuario/services";
import {
  getServiceRoleClient,
  getAuthenticatedClient,
} from "@/app/shared/core/database/database-auth";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import Papa from "papaparse";
import type { Database } from "@/app/shared/core/database.types";

const STUDENT_IMPORT_COLUMN_ALIASES = {
  fullName: ["nome completo", "nome"],
  email: ["email", "e-mail"],
  cpf: ["cpf"],
  phone: ["telefone", "celular"],
  enrollmentNumber: [
    "numero de matricula",
    "número de matrícula",
    "matricula",
    "matrícula",
  ],
  courses: ["cursos", "curso", "courses"],
  temporaryPassword: [
    "senha temporaria",
    "senha temporária",
    "senha",
    "password",
  ],
} as const;

type ParsedSpreadsheetRow = Record<string, string>;

const normalizeColumnName = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    // Remove acentos para bater headers tipo "Número" vs "Numero"
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Remove marcadores e pontuação (ex.: "*" do template)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitCourses = (value: string) =>
  value
    .split(/[,;|/]/)
    .map((course) => course.trim())
    .filter(Boolean);

const filterSpreadsheetRows = (rows: Record<string, string>[]) =>
  rows.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim()),
  );

const parseCSVFile = (
  buffer: Buffer<ArrayBufferLike>,
): Promise<ParsedSpreadsheetRow[]> =>
  new Promise((resolve, reject) => {
    const csvContent = buffer.toString("utf-8");
    Papa.parse<ParsedSpreadsheetRow>(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header: string) => header.trim(),
      delimiter: ";", // Padrão Excel PT-BR para evitar quebra por vírgulas em textos
      quoteChar: '"',
      escapeChar: '"',
      complete: (results) => {
        if (results.errors?.length) {
          reject(
            new Error(results.errors[0].message ?? "Erro ao processar CSV."),
          );
          return;
        }
        resolve(filterSpreadsheetRows(results.data ?? []));
      },
      error: (error: { message?: string }) =>
        reject(new Error(error.message || "Erro desconhecido")),
    });
  });

const parseXLSXFile = async (
  buffer: Buffer,
): Promise<ParsedSpreadsheetRow[]> => {
  try {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error - ExcelJS expects Buffer but TypeScript infers Buffer<ArrayBufferLike> from Buffer.from()
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("O arquivo XLSX não contém planilhas.");
    }

    const rows: ParsedSpreadsheetRow[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // First row = headers
        row.eachCell({ includeEmpty: false }, (cell) => {
          headers.push(String(cell.value ?? "").trim());
        });
      } else {
        // Data rows
        const rowData: ParsedSpreadsheetRow = {};
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            rowData[header] = String(cell.value ?? "").trim();
          }
        });
        if (Object.keys(rowData).length > 0) {
          rows.push(rowData);
        }
      }
    });

    return filterSpreadsheetRows(rows);
  } catch (error) {
    throw new Error(
      `Erro ao processar XLSX: ${
        error instanceof Error ? error.message : "Erro desconhecido"
      }`,
    );
  }
};

const normalizeCpfDigits = (cpfRaw: string) => {
  const digits = (cpfRaw ?? "").replace(/\D/g, "");
  // Regra: se vier com 8, 9 ou 10 dígitos, completa com 0 à esquerda até 11.
  // Aceita qualquer quantidade de dígitos, mas completa apenas se estiver entre 8-10.
  if (digits.length >= 8 && digits.length <= 10) {
    return digits.padStart(11, "0");
  }
  return digits;
};

const generateDefaultPassword = (cpfDigits: string) => cpfDigits;

function handleError(error: unknown) {
  if (error instanceof StudentValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error("Student Bulk Import API Error:", error);

  const message =
    error instanceof Error ? error.message : "Erro interno ao importar alunos.";

  return NextResponse.json({ error: message }, { status: 500 });
}

async function postHandler(request: AuthenticatedRequest) {
  if (
    !request.user ||
    request.user.role !== "usuario"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não fornecido." },
        { status: 400 },
      );
    }

    const extension = file.name.toLowerCase();
    if (
      !extension.endsWith(".csv") &&
      !extension.endsWith(".xlsx")
    ) {
      return NextResponse.json(
        { error: "Formato de arquivo não suportado. Use CSV ou XLSX." },
        { status: 400 },
      );
    }

    // Ler arquivo como buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer) as Buffer;

    // Parse do arquivo
    const rawRows =
      extension.endsWith(".xlsx")
        ? await parseXLSXFile(buffer)
        : await parseCSVFile(buffer);

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "Nenhum dado válido encontrado na planilha." },
        { status: 400 },
      );
    }

    // Buscar cursos para validação
    const client = await getAuthenticatedClient(request);
    let coursesQuery = client.from("cursos").select("id, nome");
    if (request.user.empresaId) {
      coursesQuery = coursesQuery.eq("empresa_id", request.user.empresaId);
    }

    const { data: coursesData, error: coursesError } = await coursesQuery;

    // Type assertion: Query result properly typed from Database schema
    type CourseBasic = Pick<
      Database["public"]["Tables"]["cursos"]["Row"],
      "id" | "nome"
    >;
    const typedCoursesData = coursesData as CourseBasic[] | null;

    if (coursesError) {
      throw new Error(`Erro ao carregar cursos: ${coursesError.message}`);
    }

    const courseOptions = (typedCoursesData ?? []).map((course) => ({
      id: course.id,
      name: course.nome,
    }));

    const courseNameLookup = new Map<string, boolean>();
    courseOptions.forEach((course) => {
      courseNameLookup.set(course.name.trim().toLowerCase(), true);
    });

    // Transformar e validar linhas
    const importRows = rawRows.map((row, index) => {
      const normalizedRow = new Map<string, string>();
      Object.entries(row).forEach(([key, value]) => {
        if (!key) return;
        normalizedRow.set(
          normalizeColumnName(key),
          value != null ? String(value).trim() : "",
        );
      });

      const getValue = (aliases: readonly string[]) => {
        for (const alias of aliases) {
          const normalizedKey = normalizeColumnName(alias);
          if (normalizedRow.has(normalizedKey)) {
            return normalizedRow.get(normalizedKey) || "";
          }
        }
        return "";
      };

      const rowNumber = index + 2; // +2 porque index começa em 0 e linha 1 é header

      const fullName = getValue(STUDENT_IMPORT_COLUMN_ALIASES.fullName);
      const email = getValue(STUDENT_IMPORT_COLUMN_ALIASES.email).toLowerCase();
      const cpfDigits = normalizeCpfDigits(getValue(STUDENT_IMPORT_COLUMN_ALIASES.cpf));
      // Telefone: aceita qualquer quantidade de dígitos (com ou sem DDD, com ou sem código 55, 8 ou 9 dígitos)
      // Apenas remove caracteres não numéricos, sem validação de tamanho
      const phoneDigits = getValue(STUDENT_IMPORT_COLUMN_ALIASES.phone).replace(
        /\D/g,
        "",
      );
      const enrollmentNumber = getValue(
        STUDENT_IMPORT_COLUMN_ALIASES.enrollmentNumber,
      );
      const coursesRaw = getValue(STUDENT_IMPORT_COLUMN_ALIASES.courses);
      const temporaryPasswordRaw = getValue(
        STUDENT_IMPORT_COLUMN_ALIASES.temporaryPassword,
      );
      const courses = coursesRaw
        ? Array.from(new Set(splitCourses(coursesRaw)))
        : [];

      // Gerar senha se não fornecida
      let temporaryPassword = temporaryPasswordRaw;
      if (!temporaryPassword && cpfDigits && cpfDigits.length === 11) {
        // Regra: se não vier senha, usar o CPF (11 dígitos)
        temporaryPassword = generateDefaultPassword(cpfDigits);
      }

      const errors: string[] = [];

      if (!fullName) errors.push("Nome completo é obrigatório.");
      if (!email) errors.push("Email é obrigatório.");
      // CPF: aceitar vazio quando houver senha temporária. Se vier preenchido, deve ter 11 dígitos.
      if (cpfDigits && cpfDigits.length !== 11) {
        errors.push("CPF deve ter 11 dígitos.");
      }
      if (!enrollmentNumber) errors.push("Número de matrícula é obrigatório.");
      if (temporaryPassword && temporaryPassword.length < 8) {
        errors.push("Senha temporária deve ter pelo menos 8 caracteres.");
      }
      if (!cpfDigits && !temporaryPassword) {
        errors.push("Informe o CPF ou a senha temporária.");
      }
      if (!coursesRaw) {
        errors.push("Informe pelo menos um curso.");
      } else if (courseNameLookup.size > 0) {
        const invalidCourses = courses.filter(
          (course) => !courseNameLookup.has(course.trim().toLowerCase()),
        );
        if (invalidCourses.length) {
          errors.push(`Cursos não encontrados: ${invalidCourses.join(", ")}`);
        }
      }

      return {
        rowNumber,
        fullName,
        email,
        cpf: cpfDigits,
        phone: phoneDigits,
        enrollmentNumber,
        temporaryPassword,
        coursesRaw,
        courses,
        errors,
      };
    });

    // Separar linhas inválidas vs válidas (não descartar silenciosamente)
    const invalidRows = importRows.filter((row) => row.errors.length > 0);
    const validRows = importRows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      console.warn("[bulk-import] Nenhuma linha válida para importação", {
        totalRows: importRows.length,
        sample: importRows.slice(0, 5).map((row) => ({
          rowNumber: row.rowNumber,
          email: row.email,
          errors: row.errors,
        })),
      });
      return NextResponse.json(
        {
          error: "Nenhuma linha válida para importação.",
          preview: importRows.map((row) => ({
            rowNumber: row.rowNumber,
            email: row.email,
            errors: row.errors,
          })),
        },
        { status: 400 },
      );
    }

    // Preparar dados para importação
    const importData = validRows.map((row) => ({
      rowNumber: row.rowNumber,
      fullName: row.fullName,
      email: row.email,
      cpf: row.cpf,
      phone: row.phone,
      enrollmentNumber: row.enrollmentNumber,
      temporaryPassword: row.temporaryPassword,
      courses: row.courses,
    }));

    // Service role: findByEmail/list veem todos os alunos (inclusive de outras empresas).
    // Assim conseguimos encontrar existentes, vincular aos cursos da empresa e evitar PK duplicada.
    const db = getServiceRoleClient();
    const importService = createStudentImportService(db);
    const result = await importService.import(importData, {
      empresaId: request.user.empresaId,
    });

    const invalidPreview = invalidRows.slice(0, 50).map((row) => ({
      rowNumber: row.rowNumber,
      email: row.email,
      errors: row.errors,
    }));

    if (invalidRows.length > 0) {
      console.warn("[bulk-import] Linhas rejeitadas por validação", {
        rejected: invalidRows.length,
        sample: invalidPreview,
      });
    }

    return NextResponse.json(
      {
        data: result,
        rejected: invalidRows.length,
        rejectedPreview: invalidPreview,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireAuth(postHandler);
