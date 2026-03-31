/**
 * AI Agent Thread Individual API Route
 *
 * GET    /api/ai-agents/[empresaId]/threads/[threadId] - Get thread with messages
 * PUT    /api/ai-agents/[empresaId]/threads/[threadId] - Update thread (rename, archive)
 * DELETE /api/ai-agents/[empresaId]/threads/[threadId] - Delete thread and messages
 */

import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import {
  requireUserAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ empresaId: string; threadId: string }>;
}

// ============================================
// GET /api/ai-agents/[empresaId]/threads/[threadId]
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
    const { empresaId, threadId } = routeParams as {
      empresaId: string;
      threadId: string;
    };

    if (!empresaId || !threadId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId e threadId são obrigatórios",
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

    // Fetch the thread
    const { data: thread, error: threadError } = await supabase
      .from("ai_agent_threads")
      .select("*")
      .eq("id", threadId)
      .eq("empresa_id", empresaId)
      .eq("user_id", request.user.id)
      .single();

    if (threadError || !thread) {
      console.error("[AI Thread GET] Thread fetch error:", threadError);
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_NOT_FOUND",
          error: "Conversa não encontrada",
        },
        { status: 404 },
      );
    }

    // Fetch messages sorted by created_at ASC
    const { data: messages, error: messagesError } = await supabase
      .from("ai_agent_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("[AI Thread GET] Messages fetch error:", messagesError);
      return NextResponse.json(
        {
          success: false,
          code: "MESSAGES_FETCH_ERROR",
          error: "Erro ao buscar mensagens da conversa",
          details: messagesError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { thread, messages: messages || [] },
    });
  } catch (error) {
    console.error("[AI Thread GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "THREAD_FETCH_ERROR",
        error: "Erro ao buscar conversa",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

// ============================================
// PUT /api/ai-agents/[empresaId]/threads/[threadId]
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
    const { empresaId, threadId } = routeParams as {
      empresaId: string;
      threadId: string;
    };

    if (!empresaId || !threadId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId e threadId são obrigatórios",
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
      title?: string;
      is_archived?: boolean;
    };

    if (!body || (body.title === undefined && body.is_archived === undefined)) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "Corpo da requisição vazio. Envie title ou is_archived.",
        },
        { status: 400 },
      );
    }

    const supabase = getDatabaseClient();

    // Verify thread exists and belongs to user + tenant
    const { data: existing, error: fetchError } = await supabase
      .from("ai_agent_threads")
      .select("id")
      .eq("id", threadId)
      .eq("empresa_id", empresaId)
      .eq("user_id", request.user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_NOT_FOUND",
          error: "Conversa não encontrada",
        },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.is_archived !== undefined) {
      updateData.is_archived = body.is_archived;
    }

    const { data: updated, error: updateError } = await supabase
      .from("ai_agent_threads")
      .update(updateData)
      .eq("id", threadId)
      .select()
      .single();

    if (updateError) {
      console.error("[AI Thread PUT] Database error:", updateError);
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_UPDATE_ERROR",
          error: "Erro ao atualizar conversa",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[AI Thread PUT] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "THREAD_UPDATE_ERROR",
        error: "Erro ao atualizar conversa",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE /api/ai-agents/[empresaId]/threads/[threadId]
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
    const { empresaId, threadId } = routeParams as {
      empresaId: string;
      threadId: string;
    };

    if (!empresaId || !threadId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST",
          error: "empresaId e threadId são obrigatórios",
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

    // Verify thread exists and belongs to user + tenant
    const { data: existing, error: fetchError } = await supabase
      .from("ai_agent_threads")
      .select("id")
      .eq("id", threadId)
      .eq("empresa_id", empresaId)
      .eq("user_id", request.user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_NOT_FOUND",
          error: "Conversa não encontrada",
        },
        { status: 404 },
      );
    }

    // Delete messages first, then the thread
    const { error: messagesDeleteError } = await supabase
      .from("ai_agent_messages")
      .delete()
      .eq("thread_id", threadId);

    if (messagesDeleteError) {
      console.error("[AI Thread DELETE] Messages delete error:", messagesDeleteError);
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_DELETE_ERROR",
          error: "Erro ao excluir mensagens da conversa",
          details: messagesDeleteError.message,
        },
        { status: 500 },
      );
    }

    const { error: threadDeleteError } = await supabase
      .from("ai_agent_threads")
      .delete()
      .eq("id", threadId);

    if (threadDeleteError) {
      console.error("[AI Thread DELETE] Thread delete error:", threadDeleteError);
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_DELETE_ERROR",
          error: "Erro ao excluir conversa",
          details: threadDeleteError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("[AI Thread DELETE] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "THREAD_DELETE_ERROR",
        error: "Erro ao excluir conversa",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
export const PUT = requireUserAuth(putHandler);
export const DELETE = requireUserAuth(deleteHandler);
