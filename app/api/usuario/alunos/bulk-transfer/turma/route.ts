import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/app/shared/core/database/database-auth";
import { createStudentTransferService } from "@/app/[tenant]/(modules)/usuario/services";
import type { BulkTransferTurmaRequest } from "@/app/[tenant]/(modules)/usuario/services/student-transfer.types";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

async function postHandler(request: AuthenticatedRequest) {
  try {
    const supabase = await getAuthenticatedClient(request);

    const body = (await request.json()) as BulkTransferTurmaRequest;

    if (!body.studentIds || !Array.isArray(body.studentIds)) {
      return NextResponse.json(
        { error: "studentIds deve ser um array de IDs" },
        { status: 400 },
      );
    }

    if (!body.sourceTurmaId || !body.targetTurmaId) {
      return NextResponse.json(
        { error: "sourceTurmaId e targetTurmaId sao obrigatorios" },
        { status: 400 },
      );
    }

    const validStatuses = ["concluido", "cancelado", "trancado"];
    if (
      body.sourceStatusOnTransfer &&
      !validStatuses.includes(body.sourceStatusOnTransfer)
    ) {
      return NextResponse.json(
        {
          error: `sourceStatusOnTransfer deve ser um de: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const transferService = createStudentTransferService(supabase);

    const result = await transferService.bulkTransferBetweenTurmas({
      studentIds: body.studentIds,
      sourceTurmaId: body.sourceTurmaId,
      targetTurmaId: body.targetTurmaId,
      sourceStatusOnTransfer: body.sourceStatusOnTransfer,
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
        error.message.includes("mesmo curso") ||
        error.message.includes("nao encontrada")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Error in bulk transfer turma:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar transferencia" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return requireAuth(postHandler)(request);
}
