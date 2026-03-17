import { NextRequest, NextResponse } from 'next/server';
import { requireUserAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { createFlashcardsService } from '@/app/[tenant]/(modules)/flashcards/services/flashcards.service';

interface FlashcardUpdateFields {
  moduloId?: string;
  pergunta?: string;
  resposta?: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const requestId = crypto.randomUUID();
  try {
    const flashcardsService = createFlashcardsService();
    const flashcard = await flashcardsService.getById(
      params.id,
      request.user!.id,
      request.user?.empresaId,
    );
    
    if (!flashcard) {
      return NextResponse.json({ error: 'Flashcard não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ data: flashcard });
  } catch (error) {
    console.error('[flashcards GET by id]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARD_GET_BY_ID_ERROR', requestId },
      { status: 400 },
    );
  }
}

async function putHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json();
    const { moduloId, pergunta, resposta } = body;

    const updateData: Partial<FlashcardUpdateFields> = {};
    if (moduloId !== undefined) updateData.moduloId = moduloId;
    if (pergunta !== undefined) updateData.pergunta = pergunta;
    if (resposta !== undefined) updateData.resposta = resposta;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar.', code: 'EMPTY_UPDATE_PAYLOAD', requestId },
        { status: 422 },
      );
    }

    const flashcardsService = createFlashcardsService();
    const flashcard = await flashcardsService.update(
      params.id,
      updateData,
      request.user!.id,
      request.user?.empresaId,
    );
    return NextResponse.json({ data: flashcard });
  } catch (error) {
    console.error('[flashcards PUT]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARD_UPDATE_ERROR', requestId },
      { status: 400 },
    );
  }
}

async function deleteHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const requestId = crypto.randomUUID();
  try {
    const flashcardsService = createFlashcardsService();
    await flashcardsService.delete(params.id, request.user!.id, request.user?.empresaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[flashcards DELETE]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARD_DELETE_ERROR', requestId },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => putHandler(req, params))(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => deleteHandler(req, params))(request);
}
