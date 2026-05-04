import { NextResponse } from "next/server";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";

async function getHandler(request: AuthenticatedRequest) {
  try {
    const empresaId = request.user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Tenant não identificado" },
        { status: 400 },
      );
    }

    const client = getDatabaseClient();

    const query = client
      .from("modulos")
      .select(
        "id, nome, numero_modulo, frente_id, curso_id, frentes!inner(id, nome, disciplina_id, disciplinas(id, nome))",
      )
      .eq("empresa_id", empresaId)
      .order("numero_modulo", { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao listar módulos: ${error.message}`);
    }

    const mapped = (data || []).map((m) => {
      const frente = m.frentes as unknown as {
        id: string;
        nome: string;
        disciplina_id: string | null;
        disciplinas: { id: string; nome: string } | null;
      };
      return {
        id: m.id,
        nome: m.nome,
        numeroModulo: m.numero_modulo,
        frenteId: m.frente_id,
        frenteNome: frente?.nome ?? null,
        disciplinaId: frente?.disciplina_id ?? null,
        disciplinaNome: frente?.disciplinas?.nome ?? null,
      };
    });

    mapped.sort((a, b) => {
      const fa = a.frenteNome ?? "";
      const fb = b.frenteNome ?? "";
      if (fa !== fb) return fa.localeCompare(fb, "pt-BR");
      return (a.numeroModulo ?? 0) - (b.numeroModulo ?? 0);
    });

    const response = NextResponse.json({ data: mapped });
    response.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=120",
    );
    return response;
  } catch (error) {
    console.error("[Modulos API] Error:", error);
    return NextResponse.json(
      { error: "Erro ao listar módulos" },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getHandler);
