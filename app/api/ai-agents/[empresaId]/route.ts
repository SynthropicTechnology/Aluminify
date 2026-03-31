/**
 * AI Agents API Route
 *
 * GET /api/ai-agents/[empresaId] - Get agent(s) for a tenant
 * Query params:
 *   - slug: Get specific agent by slug
 *   - config: If 'chat', returns chat config; if 'list', returns all agents
 */

import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { requireUserAuth, AuthenticatedRequest } from "@/app/[tenant]/auth/middleware";
import { AIAgentsService } from "@/app/shared/services/ai-agents/ai-agents.service";
import type { CreateAIAgentInput } from "@/app/shared/services/ai-agents/ai-agents.types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ empresaId: string }> | { empresaId: string };
}

/**
 * GET /api/ai-agents/[empresaId]
 *
 * Fetch AI agents for a specific empresa.
 * Supports query params:
 *   - slug: fetch a specific agent by slug
 *   - config: 'list' | 'chat' to get different views
 */
async function getHandler(
  request: AuthenticatedRequest,
  context?: RouteContext | Record<string, unknown>,
) {
  try {
    if (!context || !("params" in context)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Parâmetros de rota ausentes",
        },
        { status: 400 },
      );
    }

    const routeParams =
      context.params instanceof Promise ? await context.params : context.params;
    const empresaId = routeParams?.empresaId;

    if (!empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId é obrigatório",
        },
        { status: 400 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug") || undefined;
    const configType = searchParams.get("config");
    const userEmpresaId = request.user?.empresaId;

    if (!request.user?.id) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Usuário não autenticado",
        },
        { status: 401 },
      );
    }

    // Segurança multi-tenant: a API só pode responder para o tenant efetivo da request.
    if (!userEmpresaId || userEmpresaId !== empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_TENANT",
          error: "Acesso negado para este tenant",
        },
        { status: 403 },
      );
    }

    const supabase = getDatabaseClient();
    const service = new AIAgentsService(supabase);

    // List all active agents
    if (configType === "list") {
      const agents = await service.getActiveForEmpresa(empresaId);
      return NextResponse.json({ success: true, data: agents });
    }

    // Get chat configuration
    if (configType === "chat") {
      const config = await service.getChatConfig(empresaId, slug);

      if (!config) {
        return NextResponse.json(
          {
            success: false,
            code: "AGENT_NOT_FOUND",
            error: "Nenhum agente de IA encontrado",
            details: slug
              ? `Agente com slug "${slug}" não encontrado para esta organização`
              : "Nenhum agente padrão configurado para esta organização",
            suggestion:
              "Configure um agente de IA nas configurações da instituição ou entre em contato com o suporte",
            empresaId,
            slug,
          },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, data: config });
    }

    // Default: return all agents
    const agents = await service.getAllForEmpresa(empresaId);
    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error("[AI Agents API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "AI_AGENTS_FETCH_ERROR",
        error: "Erro ao buscar agentes de IA",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/ai-agents/[empresaId]
 *
 * Create a new AI agent for a specific empresa.
 */
async function postHandler(
  request: AuthenticatedRequest,
  context?: RouteContext | Record<string, unknown>,
) {
  try {
    if (!context || !("params" in context)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Parâmetros de rota ausentes",
        },
        { status: 400 },
      );
    }

    const routeParams =
      context.params instanceof Promise ? await context.params : context.params;
    const empresaId = routeParams?.empresaId;

    if (!empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId é obrigatório",
        },
        { status: 400 },
      );
    }

    if (!request.user?.id) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Usuário não autenticado",
        },
        { status: 401 },
      );
    }

    const userEmpresaId = request.user?.empresaId;

    // Segurança multi-tenant: a API só pode responder para o tenant efetivo da request.
    if (!userEmpresaId || userEmpresaId !== empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_TENANT",
          error: "Acesso negado para este tenant",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Omit<CreateAIAgentInput, "empresaId">;

    if (!body || !body.slug || !body.name) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Campos obrigatórios: slug e name são necessários",
        },
        { status: 400 },
      );
    }

    const input: CreateAIAgentInput = {
      ...body,
      empresaId,
    };

    const supabase = getDatabaseClient();
    const service = new AIAgentsService(supabase);

    const agent = await service.create(input, request.user.id);

    return NextResponse.json({ success: true, data: agent }, { status: 201 });
  } catch (error) {
    console.error("[AI Agents POST] Error:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido";

    // Map known service errors to appropriate status codes
    if (message.includes("Slug") || message.includes("Já existe")) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", error: message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "AI_AGENT_CREATE_ERROR",
        error: "Erro ao criar agente de IA",
        details: message,
      },
      { status: 500 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
export const POST = requireUserAuth(postHandler);
