import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { importacaoService } from "@/app/shared/services/importacao";
import { ImportacaoValidationError } from "@/app/shared/services/importacao/errors";

function handleError(error: unknown) {
  if (error instanceof ImportacaoValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[Importacao API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    const empresaId = request.user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa nao encontrada" },
        { status: 400 },
      );
    }

    const jobs = await importacaoService.list(empresaId);
    return NextResponse.json({ data: jobs });
  } catch (error) {
    return handleError(error);
  }
}

export const GET = requireUserAuth(getHandler);

async function postHandler(request: AuthenticatedRequest) {
  const user = request.user;
  if (user?.role !== "usuario") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const empresaId = user?.empresaId;
  if (!empresaId) {
    return NextResponse.json(
      { error: "Empresa nao encontrada" },
      { status: 400 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo .docx obrigatorio" },
        { status: 400 },
      );
    }

    if (
      !file.name.endsWith(".docx") &&
      file.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return NextResponse.json(
        { error: "Apenas arquivos .docx sao aceitos" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const job = await importacaoService.upload(
      empresaId,
      user?.id ?? null,
      file.name,
      buffer,
    );

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireUserAuth(postHandler);
