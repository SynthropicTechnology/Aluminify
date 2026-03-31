/**
 * AI Agent Individual API Route
 *
 * GET    /api/ai-agents/[empresaId]/[agentId] - Get agent by ID
 * PUT    /api/ai-agents/[empresaId]/[agentId] - Update agent
 * DELETE /api/ai-agents/[empresaId]/[agentId] - Delete agent
 */

import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import {
  requireUserAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { AIAgentsService } from "@/app/shared/services/ai-agents/ai-agents.service";
import type { UpdateAIAgentInput } from "@/app/shared/services/ai-agents/ai-agents.types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ empresaId: string; agentId: string }>;
}

// ============================================
// GET /api/ai-agents/[empresaId]/[agentId]
// ============================================

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
    const { empresaId, agentId } = routeParams as {
      empresaId: string;
      agentId: string;
    };

    if (!empresaId || !agentId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId e agentId são obrigatórios",
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

    // Segurança multi-tenant
    if (!request.user.empresaId || request.user.empresaId !== empresaId) {
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

    const agent = await service.getById(agentId);

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          code: "AGENT_NOT_FOUND",
          error: "Agente de IA não encontrado",
        },
        { status: 404 },
      );
    }

    // Verifica que o agente pertence ao tenant
    if (agent.empresaId !== empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_TENANT",
          error: "Acesso negado para este tenant",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error("[AI Agent GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "AI_AGENT_FETCH_ERROR",
        error: "Erro ao buscar agente de IA",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

// ============================================
// PUT /api/ai-agents/[empresaId]/[agentId]
// ============================================

async function putHandler(
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
    const { empresaId, agentId } = routeParams as {
      empresaId: string;
      agentId: string;
    };

    if (!empresaId || !agentId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId e agentId são obrigatórios",
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

    // Segurança multi-tenant
    if (!request.user.empresaId || request.user.empresaId !== empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_TENANT",
          error: "Acesso negado para este tenant",
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as UpdateAIAgentInput;

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Corpo da requisição vazio. Envie os campos a serem atualizados.",
        },
        { status: 400 },
      );
    }

    const supabase = getDatabaseClient();
    const service = new AIAgentsService(supabase);

    // Verifica que o agente existe e pertence ao tenant
    const existing = await service.getById(agentId);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          code: "AGENT_NOT_FOUND",
          error: "Agente de IA não encontrado",
        },
        { status: 404 },
      );
    }

    if (existing.empresaId !== empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_TENANT",
          error: "Acesso negado para este tenant",
        },
        { status: 403 },
      );
    }

    const updated = await service.update(agentId, body, request.user.id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[AI Agent PUT] Error:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido";

    // Map known service errors to appropriate status codes
    if (message.includes("não encontrado")) {
      return NextResponse.json(
        { success: false, code: "AGENT_NOT_FOUND", error: message },
        { status: 404 },
      );
    }

    if (message.includes("Slug") || message.includes("Já existe")) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", error: message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "AI_AGENT_UPDATE_ERROR",
        error: "Erro ao atualizar agente de IA",
        details: message,
      },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE /api/ai-agents/[empresaId]/[agentId]
// ============================================

async function deleteHandler(
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
    const { empresaId, agentId } = routeParams as {
      empresaId: string;
      agentId: string;
    };

    if (!empresaId || !agentId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId e agentId são obrigatórios",
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

    // Segurança multi-tenant
    if (!request.user.empresaId || request.user.empresaId !== empresaId) {
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

    // Verifica que o agente existe e pertence ao tenant
    const existing = await service.getById(agentId);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          code: "AGENT_NOT_FOUND",
          error: "Agente de IA não encontrado",
        },
        { status: 404 },
      );
    }

    if (existing.empresaId !== empresaId) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_TENANT",
          error: "Acesso negado para este tenant",
        },
        { status: 403 },
      );
    }

    await service.delete(agentId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("[AI Agent DELETE] Error:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido";

    // Map known service errors
    if (message.includes("não encontrado")) {
      return NextResponse.json(
        { success: false, code: "AGENT_NOT_FOUND", error: message },
        { status: 404 },
      );
    }

    if (message.includes("agente padrão")) {
      return NextResponse.json(
        { success: false, code: "DEFAULT_AGENT_DELETE", error: message },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "AI_AGENT_DELETE_ERROR",
        error: "Erro ao excluir agente de IA",
        details: message,
      },
      { status: 500 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
export const PUT = requireUserAuth(putHandler);
export const DELETE = requireUserAuth(deleteHandler);
