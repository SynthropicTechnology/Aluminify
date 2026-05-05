import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";

async function getHandler(request: AuthenticatedRequest) {
  try {
    const empresaId = request.user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa nao encontrada" },
        { status: 400 },
      );
    }

    const client = getDatabaseClient();

    const [instituicoesRes, anosRes, tagsRes] = await Promise.all([
      client
        .from("banco_questoes")
        .select("instituicao")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .not("instituicao", "is", null)
        .order("instituicao", { ascending: true }),
      client
        .from("banco_questoes")
        .select("ano")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .not("ano", "is", null)
        .order("ano", { ascending: false }),
      client
        .from("banco_questoes")
        .select("tags")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null),
    ]);

    const instituicoes = [
      ...new Set(
        (instituicoesRes.data ?? []).map((r) => r.instituicao as string),
      ),
    ];
    const anos = [
      ...new Set((anosRes.data ?? []).map((r) => r.ano as number)),
    ];
    const tagsSet = new Set<string>();
    for (const row of (tagsRes.data ?? []) as Array<{ tags: string[] }>) {
      for (const tag of row.tags ?? []) {
        if (tag) tagsSet.add(tag);
      }
    }
    const tags = Array.from(tagsSet).sort();

    return NextResponse.json({ data: { instituicoes, anos, tags } });
  } catch (error) {
    console.error("[Questoes Filtros API]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
