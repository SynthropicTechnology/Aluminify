import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/app/shared/core/database/database-auth";
import { createStudentTransferService } from "@/app/[tenant]/(modules)/usuario/services";
import type { BulkTransferCourseRequest } from "@/app/[tenant]/(modules)/usuario/services/student-transfer.types";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

async function postHandler(request: AuthenticatedRequest) {
  try {
    const supabase = await getAuthenticatedClient(request);

    const body = (await request.json()) as BulkTransferCourseRequest;

    if (!body.studentIds || !Array.isArray(body.studentIds)) {
      return NextResponse.json(
        { error: "studentIds deve ser um array de IDs" },
        { status: 400 },
      );
    }

    if (!body.sourceCourseId || !body.targetCourseId) {
      return NextResponse.json(
        { error: "sourceCourseId e targetCourseId sao obrigatorios" },
        { status: 400 },
      );
    }

    const transferService = createStudentTransferService(supabase);

    const result = await transferService.bulkTransferBetweenCourses({
      studentIds: body.studentIds,
      sourceCourseId: body.sourceCourseId,
      targetCourseId: body.targetCourseId,
      options: body.options,
    });

    // Determine status code based on results
    let statusCode = 200;
    if (result.failed > 0 && result.success > 0) {
      statusCode = 207; // Multi-Status
    } else if (result.failed > 0 && result.success === 0) {
      statusCode = 400;
    }

    return NextResponse.json({ data: result }, { status: statusCode });
  } catch (error) {
    if (error instanceof Error) {
      // Validation errors
      if (
        error.message.includes("Selecione") ||
        error.message.includes("Maximo") ||
        error.message.includes("diferentes") ||
        error.message.includes("nao encontrado")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Error in bulk transfer course:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar transferencia" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return requireAuth(postHandler)(request);
}
