import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { questaoService } from "@/app/shared/services/questoes";
import { QuestaoValidationError } from "@/app/shared/services/questoes/errors";
import { createQuestaoSchema } from "@/app/shared/services/questoes/questao.validation";
import type { DificuldadeQuestao } from "@/app/shared/types/entities/questao";

function handleError(error: unknown) {
  if (error instanceof QuestaoValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[Questoes API]", error);
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

    const { searchParams } = new URL(request.url);
    const anoParam = searchParams.get("ano");
    const limitParam = searchParams.get("limit");
    const dificuldadeParam = searchParams.get("dificuldade");
    const tagsParam = searchParams.get("tags");

    const result = await questaoService.list({
      empresaId,
      disciplina: searchParams.get("disciplina") ?? undefined,
      instituicao: searchParams.get("instituicao") ?? undefined,
      ano: anoParam ? Number(anoParam) : undefined,
      dificuldade: dificuldadeParam
        ? (dificuldadeParam as DificuldadeQuestao)
        : undefined,
      tags: tagsParam ? tagsParam.split(",").filter(Boolean) : undefined,
      search: searchParams.get("search") ?? undefined,
      limit: limitParam ? Number(limitParam) : undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });

    return NextResponse.json({
      data: result.data,
      nextCursor: result.nextCursor,
    });
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
    const body = await request.json();
    const parsed = createQuestaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const questao = await questaoService.create({
      ...parsed.data,
      empresaId,
      createdBy: user?.id ?? null,
    });

    return NextResponse.json({ data: questao }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireUserAuth(postHandler);
