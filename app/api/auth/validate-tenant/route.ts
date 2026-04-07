import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/app/shared/core/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";

type LoginSource = "password" | "magic_link" | "unknown";

function normalizeLoginSource(value: unknown): LoginSource {
  if (value === "password" || value === "magic_link") {
    return value;
  }
  return "unknown";
}

async function trackTenantLoginEvent(params: {
  empresaId: string;
  userId: string;
  source: LoginSource;
}) {
  try {
    const adminClient = getDatabaseClient();
    const { error } = await adminClient
      .from("tenant_login_events" as never)
      .insert({
        empresa_id: params.empresaId,
        usuario_id: params.userId,
        source: params.source,
        metadata: {
          origin: "api/auth/validate-tenant",
        },
      } as never);

    if (error) {
      console.warn("[validate-tenant] falha ao registrar login:", error.message);
    }
  } catch (error) {
    console.warn("[validate-tenant] erro inesperado ao registrar login:", error);
  }
}

/**
 * Valida se o usuário autenticado pertence a uma empresa (tenant).
 * Usado no login por tenant para bloquear acesso indevido.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === "string" ? body.empresaId : "";
    const source = normalizeLoginSource(body?.source);

    if (!empresaId) {
      return NextResponse.json(
        { valid: false, message: "empresaId é obrigatório" },
        { status: 400 }
      );
    }

    const sessionClient = await createClient();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { valid: false, message: "Não autenticado" },
        { status: 401 }
      );
    }

    const adminClient = getDatabaseClient();

    // Usuario (staff) vinculado diretamente à empresa
    const { data: usuarioRow, error: usuarioError } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("id", user.id)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (usuarioError) {
      console.error("[validate-tenant] erro ao verificar usuario:", usuarioError);
    }

    if (usuarioRow?.id) {
      await trackTenantLoginEvent({ empresaId, userId: user.id, source });
      return NextResponse.json({ valid: true, roles: ["usuario"] });
    }

    // Professor vinculado diretamente à empresa (unified usuarios table)
    const { data: professorRow, error: professorError } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (professorError) {
      console.error("[validate-tenant] erro ao verificar professor:", professorError);
    }

    if (professorRow?.id) {
      await trackTenantLoginEvent({ empresaId, userId: user.id, source });
      return NextResponse.json({ valid: true, roles: ["professor"] });
    }

    // Aluno vinculado via matriculas -> empresa (nova estrutura)
    const { data: matriculaRow, error: matriculaError } = await adminClient
      .from("matriculas")
      .select("usuario_id")
      .eq("usuario_id", user.id)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .limit(1);

    if (matriculaError) {
      console.error("[validate-tenant] erro ao verificar matricula:", matriculaError);
    }

    if (Array.isArray(matriculaRow) && matriculaRow.length > 0) {
      await trackTenantLoginEvent({ empresaId, userId: user.id, source });
      return NextResponse.json({ valid: true, roles: ["aluno"] });
    }

    // Aluno vinculado via cursos -> empresa (legacy)
    const { data: alunoCursoRow, error: alunoError } = await adminClient
      .from("alunos_cursos")
      .select("usuario_id, cursos!inner(empresa_id)")
      .eq("usuario_id", user.id)
      .eq("cursos.empresa_id", empresaId)
      .limit(1);

    if (alunoError) {
      console.error("[validate-tenant] erro ao verificar aluno_cursos:", alunoError);
    }

    if (Array.isArray(alunoCursoRow) && alunoCursoRow.length > 0) {
      await trackTenantLoginEvent({ empresaId, userId: user.id, source });
      return NextResponse.json({ valid: true, roles: ["aluno"] });
    }

    // Vínculo unificado: usuarios_empresas (staff multi-tenant, etc.)
    const { data: vinculoRow, error: vinculoError } = await adminClient
      .from("usuarios_empresas")
      .select("empresa_id")
      .eq("usuario_id", user.id)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .is("deleted_at", null)
      .limit(1);

    if (vinculoError) {
      console.error(
        "[validate-tenant] erro ao verificar usuarios_empresas:",
        vinculoError,
      );
    }

    if (Array.isArray(vinculoRow) && vinculoRow.length > 0) {
      await trackTenantLoginEvent({ empresaId, userId: user.id, source });
      return NextResponse.json({ valid: true, roles: ["usuario"] });
    }

    return NextResponse.json(
      { valid: false, message: "Você não tem acesso a esta instituição." },
      { status: 403 }
    );
  } catch (error) {
    console.error("[validate-tenant] erro inesperado:", error);
    return NextResponse.json(
      { valid: false, message: "Erro interno" },
      { status: 500 }
    );
  }
}

