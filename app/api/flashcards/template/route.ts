import { NextResponse, type NextRequest } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { FlashcardsTemplateService } from "@/app/[tenant]/(modules)/flashcards/services/flashcards-template.service";

export const runtime = "nodejs";

async function getHandler(request: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    if (!request.user) {
      return NextResponse.json(
        { error: "Não autenticado", code: "UNAUTHORIZED", requestId },
        { status: 401 },
      );
    }
    if (request.user.role === "aluno") {
      return NextResponse.json(
        { error: "Apenas professores e admins podem baixar o template.", code: "FORBIDDEN", requestId },
        { status: 403 },
      );
    }

    const templateService = new FlashcardsTemplateService();
    const buffer = await templateService.generateTemplate();

    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    const filename = `modelo-importacao-flashcards-${new Date()
      .toISOString()
      .split("T")[0]}.xlsx`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar template de flashcards:", error);
    return NextResponse.json(
      {
        error: "Erro ao gerar template de flashcards",
        code: "FLASHCARDS_TEMPLATE_ERROR",
        requestId,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return requireUserAuth(getHandler)(request);
}

