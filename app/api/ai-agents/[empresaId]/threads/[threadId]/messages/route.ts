/**
 * AI Agent Thread Messages API Route
 *
 * POST /api/ai-agents/[empresaId]/threads/[threadId]/messages - Save a message
 */

import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import type { Json } from "@/app/shared/core/database.types";
import {
  requireUserAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ empresaId: string; threadId: string }>;
}

// ============================================
// POST /api/ai-agents/[empresaId]/threads/[threadId]/messages
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
      role?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body?.role || !body?.content) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Campos obrigatórios: role e content são necessários",
        },
        { status: 400 },
      );
    }

    const validRoles = ["user", "assistant", "system"];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Campo role deve ser: user, assistant ou system",
        },
        { status: 400 },
      );
    }

    const supabase = getDatabaseClient();

    // Verify thread exists and belongs to user + tenant
    const { data: thread, error: threadError } = await supabase
      .from("ai_agent_threads")
      .select("id")
      .eq("id", threadId)
      .eq("empresa_id", empresaId)
      .eq("user_id", request.user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        {
          success: false,
          code: "THREAD_NOT_FOUND",
          error: "Conversa não encontrada",
        },
        { status: 404 },
      );
    }

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from("ai_agent_messages")
      .insert({
        thread_id: threadId,
        role: body.role,
        content: body.content,
        metadata: (body.metadata as Json) || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (messageError) {
      console.error("[AI Messages POST] Message insert error:", messageError);
      return NextResponse.json(
        {
          success: false,
          code: "MESSAGE_CREATE_ERROR",
          error: "Erro ao salvar mensagem",
          details: messageError.message,
        },
        { status: 500 },
      );
    }

    // Update last_message_at on the thread
    const { error: updateError } = await supabase
      .from("ai_agent_threads")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    if (updateError) {
      console.error("[AI Messages POST] Thread update error:", updateError);
      // Message was saved successfully, so we still return it
      // but log the thread update failure
    }

    return NextResponse.json(
      { success: true, data: message },
      { status: 201 },
    );
  } catch (error) {
    console.error("[AI Messages POST] Error:", error);
    return NextResponse.json(
      {
        success: false,
        code: "MESSAGE_CREATE_ERROR",
        error: "Erro ao salvar mensagem",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}

export const POST = requireUserAuth(postHandler);
