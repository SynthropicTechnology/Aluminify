import { NextResponse } from "next/server";
import {
  createStudentImportService,
  StudentValidationError,
  StudentImportInputRow,
} from "@/app/[tenant]/(modules)/usuario/services";
import { getAuthenticatedClient } from "@/app/shared/core/database/database-auth";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

function handleError(error: unknown) {
  if (error instanceof StudentValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error("Student Import API Error:", error);

  const message =
    error instanceof Error ? error.message : "Erro interno ao importar alunos.";

  return NextResponse.json({ error: message }, { status: 500 });
}

function normalizeCpf(rawCpf: string): string {
  const digits = (rawCpf ?? "").replace(/\D/g, "");
  // Regra: se vier com 8, 9 ou 10 dígitos, completa com 0 à esquerda até 11.
  // Aceita qualquer quantidade de dígitos, mas completa apenas se estiver entre 8-10.
  if (digits.length >= 8 && digits.length <= 10) {
    return digits.padStart(11, "0");
  }
  return digits;
}

function normalizeRowPayload(rows: unknown[]): StudentImportInputRow[] {
  return rows.map((rawRow, index) => {
    const row = rawRow as Record<string, unknown>;
    const courses = Array.isArray(row?.courses)
      ? (row.courses as unknown[])
          .map((value) => (typeof value === "string" ? value : ""))
          .filter(Boolean)
      : [];

    const cpf = normalizeCpf(String(row?.cpf ?? "").trim());
    const temporaryPasswordRaw = String(row?.temporaryPassword ?? "").trim();

    return {
      rowNumber:
        typeof row?.rowNumber === "number" && Number.isFinite(row.rowNumber)
          ? row.rowNumber
          : index + 1,
      fullName: String(row?.fullName ?? "").trim(),
      email: String(row?.email ?? "")
        .trim()
        .toLowerCase(),
      cpf,
      phone: String(row?.phone ?? "").trim(),
      enrollmentNumber: String(row?.enrollmentNumber ?? "").trim(),
      // Regra: se não vier senha, usar CPF (11 dígitos).
      temporaryPassword:
        temporaryPasswordRaw || (cpf.length === 11 ? cpf : ""),
      courses,
    };
  });
}

async function postHandler(request: AuthenticatedRequest) {
  if (
    !request.user ||
    request.user.role !== "usuario"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!request.user.empresaId) {
    return NextResponse.json(
      { error: "Empresa não encontrada para o usuário autenticado." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    if (!body || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { error: "Envie uma lista de alunos no formato correto." },
        { status: 400 },
      );
    }

    const rows = normalizeRowPayload(body.rows);
    const supabase = await getAuthenticatedClient(request);
    const importService = createStudentImportService(supabase);
    const result = await importService.import(rows, {
      empresaId: request.user.empresaId,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireAuth(postHandler);
