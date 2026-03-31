/**
 * AI Agent Threads API Route
 *
 * GET  /api/ai-agents/[empresaId]/threads - List threads for current user + agent
 * POST /api/ai-agents/[empresaId]/threads - Create a new thread
 */

import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import {
  requireUserAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ empresaId: string }> | { empresaId: string };
}

// ============================================
// GET /api/ai-agents/[empresaId]/threads
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
    const empresaId = (routeParams as { empresaId: string })?.empresaId;

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

    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "agentId é obrigatório como parâmetro de consulta",
        },
        { status: 400 },
      );
    }

    const supabase = getDatabaseClient();

    const { data: threads, error } = await supabase
      .from("ai_agent_threads")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("agent_id", agentId)
      .eq("user_id", request.user.id)
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("[AI Agent Threads GET] Database error:", error);
      return NextResponse.json(
        {
          success: false,
          code: "THREADS_FETCH_ERROR",
          error: "Erro ao buscar conversas",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: threads });
  } catch (error) {
    console.error("[AI Agent Threads GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "THREADS_FETCH_ERROR",
        error: "Erro ao buscar conversas",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

// ============================================
// POST /api/ai-agents/[empresaId]/threads
// ============================================

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
    const empresaId = (routeParams as { empresaId: string })?.empresaId;

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

    const body = (await request.json()) as {
      agentId?: string;
      title?: string;
    };

    if (!body?.agentId) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Campo obrigatório: agentId é necessário",
        },
        { status: 400 },
      );
    }

    const supabase = getDatabaseClient();

    const now = new Date().toISOString();

    const { data: thread, error } = await supabase
      .from("ai_agent_threads")
      .insert({
        empresa_id: empresaId,
        agent_id: body.agentId,
        user_id: request.user.id,
        title: body.title || null,
        is_archived: false,
        created_at: now,
        updated_at: now,
        last_message_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error("[AI Agent Threads POST] Database error:", error);
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_CREATE_ERROR",
          error: "Erro ao criar conversa",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: thread },
      { status: 201 },
    );
  } catch (error) {
    console.error("[AI Agent Threads POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "THREAD_CREATE_ERROR",
        error: "Erro ao criar conversa",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
export const POST = requireUserAuth(postHandler);
