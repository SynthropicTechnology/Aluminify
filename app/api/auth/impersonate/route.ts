import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import {
  setImpersonationContext,
  canImpersonateUser,
} from "@/app/shared/core/auth-impersonate";
import { invalidateAuthSessionCache } from "@/app/shared/core/auth";
import type { PapelBase } from "@/app/shared/types";

async function postHandler(request: AuthenticatedRequest) {
  try {
    if (!request.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let { targetId } = body;
    const { studentId } = body;

    // Backward compatibility
    if (!targetId && studentId) {
      targetId = studentId;
    }

    if (!targetId) {
      return NextResponse.json(
        { error: "ID do usuário alvo é obrigatório" },
        { status: 400 },
      );
    }

    const client = getDatabaseClient();

    // 1. Buscar usuário alvo
    const { data: targetUser, error: targetError } = await client
      .from("usuarios")
      .select("id, email, empresa_id, papel_id")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: "Usuário alvo não encontrado" },
        { status: 404 },
      );
    }

    // 2. Determinar papel e empresa do alvo
    // Quando a requisição vier com studentId, a intenção explícita é impersonar aluno.
    // Isso evita ambiguidades do modelo unificado (ex.: usuário com papel customizado).
    let targetRole: PapelBase = studentId ? "aluno" : "aluno";
    let targetEmpresaId: string | undefined =
      targetUser.empresa_id || undefined;

    // Se não for fluxo explícito de aluno (studentId ausente), inferimos por papel_id.
    if (!studentId && targetUser.papel_id) {
      targetRole = "usuario";
    } else {
      // Se não tem papel_id, assumimos que é aluno (comportamento padrão)
      // Mas checamos se tem empresa vinculada via cursos (caso não tenha empresa_id direto)
      if (!targetEmpresaId) {
        // 2.1 Primeiro tenta via vínculo formal de aluno em usuarios_empresas
        const { data: alunoVinculo } = await client
          .from("usuarios_empresas")
          .select("empresa_id")
          .eq("usuario_id", targetId)
          .eq("papel_base", "aluno")
          .eq("ativo", true)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();

        if (alunoVinculo?.empresa_id) {
          targetEmpresaId = alunoVinculo.empresa_id;
        }
      }

      if (!targetEmpresaId) {
        // 2.2 Fallback via matrículas (modelo atual)
        const { data: matriculaRow } = await client
          .from("matriculas")
          .select("empresa_id")
          .eq("usuario_id", targetId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();

        if (matriculaRow?.empresa_id) {
          targetEmpresaId = matriculaRow.empresa_id;
        }
      }

      if (!targetEmpresaId) {
        // 2.3 Fallback legado via alunos_cursos -> cursos
        const { data: alunoCurso } = await client
          .from("alunos_cursos")
          .select("curso_id, cursos(empresa_id)")
          .eq("usuario_id", targetId)
          .limit(1)
          .maybeSingle();

        // Type assertion for joined query result
        type AlunoCursoWithEmpresa = {
          curso_id: string;
          cursos: { empresa_id: string } | null;
        };
        const typedAlunoCurso = alunoCurso as AlunoCursoWithEmpresa | null;

        if (typedAlunoCurso?.cursos?.empresa_id) {
          targetEmpresaId = typedAlunoCurso.cursos.empresa_id;
        }
      }
    }

    // 3. Buscar dados do usuário real (requester) para validação
    let realUserEmpresaId: string | undefined;
    if (request.user.role === "usuario") {
      const { data: professor } = await client
        .from("usuarios")
        .select("empresa_id")
        .eq("id", request.user.id)
        .maybeSingle();

      realUserEmpresaId = professor?.empresa_id || undefined;
    }

    // 4. Validar permissão
    const validation = canImpersonateUser(
      request.user.role as PapelBase,
      realUserEmpresaId,
      targetId,
      targetRole,
      targetEmpresaId,
    );

    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.reason || "Não autorizado" },
        { status: 403 },
      );
    }

    // 5. Criar contexto
    const context = {
      realUserId: request.user.id,
      realUserRole: request.user.role as PapelBase,
      impersonatedUserId: targetId,
      impersonatedUserRole: targetRole,
      startedAt: new Date().toISOString(),
    };

    await setImpersonationContext(context);
    await invalidateAuthSessionCache(request.user.id);

    return NextResponse.json({
      success: true,
      context: {
        ...context,
        impersonatedUser: {
          id: targetUser.id,
          email: targetUser.email,
        },
      },
    });
  } catch (error) {
    console.error("Erro ao iniciar impersonação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export const POST = requireUserAuth(postHandler);
