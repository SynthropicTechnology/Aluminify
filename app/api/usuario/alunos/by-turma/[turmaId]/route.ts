import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/app/shared/core/database/database-auth";
import { createStudentTransferService } from "@/app/[tenant]/(modules)/usuario/services";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

interface RouteContext {
  params: Promise<{ turmaId: string }>;
}

async function getHandler(request: AuthenticatedRequest, params: { turmaId: string }) {
  try {
    const supabase = await getAuthenticatedClient(request);
    const { turmaId } = params;

    if (!turmaId) {
      return NextResponse.json(
        { error: "turmaId e obrigatorio" },
        { status: 400 },
      );
    }

    const transferService = createStudentTransferService(supabase);
    const students = await transferService.getStudentsByTurma(turmaId);

    return NextResponse.json({ data: students });
  } catch (error) {
    console.error("Error fetching students by turma:", error);
    return NextResponse.json(
      { error: "Erro ao buscar alunos da turma" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => getHandler(req, params))(request);
}
