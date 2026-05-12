import { NextResponse, type NextRequest } from "next/server";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";

function handleError(error: unknown) {
  console.error("Aluno Cursos API Error:", error);
  let errorMessage = "Internal server error";
  if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
    console.error("Error stack:", error.stack);
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object" && "message" in error) {
    errorMessage = String(error.message);
  }

  return NextResponse.json(
    {
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.stack
            : String(error)
          : undefined,
    },
    { status: 500 },
  );
}

interface RouteContext {
  params: Promise<{ alunoId: string }>;
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { alunoId: string },
) {
  try {
    const alunoId = params.alunoId;

    if (!alunoId) {
      return NextResponse.json(
        { error: "alunoId is required" },
        { status: 400 },
      );
    }

    // Permissão: aluno só pode ver seus próprios cursos
    if (
      request.user &&
      request.user.role !== "usuario"
    ) {
      if (request.user.id !== alunoId) {
        return NextResponse.json(
          { error: "Forbidden: You can only access your own courses" },
          { status: 403 },
        );
      }
    }

    // Não usamos RLS aqui; o backend já validou o JWT e faz a checagem de permissão acima.
    const { getDatabaseClient } = await import("@/app/shared/core/database/database");
    const client = getDatabaseClient();

    const cursoIds = await fetchCanonicalCourseIdsForStudent(
      client,
      alunoId,
      request.user?.empresaId,
    );

    const { data: cursos, error } = cursoIds.length > 0
      ? await client
        .from("cursos")
        .select("id, nome")
        .in("id", cursoIds)
        .order("nome", { ascending: true })
      : { data: [], error: null };

    if (error) {
      throw new Error(`Erro ao buscar cursos do aluno: ${error.message}`);
    }

    // Deduplicar por id
    const unique = Array.from(
      new Map((cursos ?? []).map((c) => [c.id, c])).values(),
    ).sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({ data: unique });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => getHandler(req, params))(request);
}
