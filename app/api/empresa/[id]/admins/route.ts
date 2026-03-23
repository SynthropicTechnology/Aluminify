import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/shared/core/server";
import { fetchAllRows } from "@/app/shared/core/database/fetch-all-rows";
import { getAuthUser } from "@/app/[tenant]/auth/middleware";
import {
  getEmpresaContext,
  validateEmpresaAccess,
} from "@/app/shared/core/middleware/empresa-context";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabase = await createClient();

    const context = await getEmpresaContext(supabase, user.id, request, user);
    if (!validateEmpresaAccess(context, id)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const admins = await fetchAllRows(
      supabase
        .from("usuarios_empresas")
        .select("*, usuarios:usuario_id(*)")
        .eq("empresa_id", id)
        .eq("is_admin", true),
    );

    return NextResponse.json(admins);
  } catch (error) {
    console.error("Error listing admins:", error);
    return NextResponse.json(
      { error: "Erro ao listar admins" },
      { status: 500 },
    );
  }
}

async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const supabase = await createClient();

    const body = await request.json();
    const { professorId } = body;

    if (!professorId) {
      return NextResponse.json(
        { error: "professorId é obrigatório" },
        { status: 400 },
      );
    }

    const context = await getEmpresaContext(supabase, user.id, request, user);

    // Verificar se é owner
    const { data: isOwner } = await supabase
      .from("usuarios_empresas")
      .select("is_owner")
      .eq("empresa_id", id)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (
      !validateEmpresaAccess(context, id) || !isOwner?.is_owner
    ) {
      return NextResponse.json(
        {
          error:
            "Acesso negado. Apenas owner pode adicionar admins.",
        },
        { status: 403 },
      );
    }

    // Verificar se usuario pertence à empresa
    const { data: professor } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("id", professorId)
      .eq("empresa_id", id)
      .maybeSingle();

    if (!professor) {
      return NextResponse.json(
        { error: "Professor não encontrado ou não pertence à empresa" },
        { status: 404 },
      );
    }

    // Adicionar como admin em usuarios_empresas
    const { error: insertError } = await supabase
      .from("usuarios_empresas")
      .upsert({
        empresa_id: id,
        usuario_id: professorId,
        papel_base: "usuario",
        is_owner: false,
        is_admin: true,
        ativo: true,
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error adding admin:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro ao adicionar admin";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET /api/empresa/[id]/admins - Listar admins da empresa
export async function GET(request: NextRequest, context: RouteContext) {
  return getHandler(request, context);
}

// POST /api/empresa/[id]/admins - Adicionar admin
export async function POST(request: NextRequest, context: RouteContext) {
  return postHandler(request, context);
}
