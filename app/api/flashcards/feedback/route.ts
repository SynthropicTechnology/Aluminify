import { NextResponse } from 'next/server';
import { requireUserAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { createFlashcardsService } from '@/app/[tenant]/(modules)/flashcards/services/flashcards.service';

async function handler(request: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  if (request.method !== 'POST') {
    return NextResponse.json(
      { error: 'Método não suportado', code: 'METHOD_NOT_ALLOWED', requestId },
      { status: 405 },
    );
  }

  try {
    const body = await request.json();
    const cardId = body?.cardId as string;
    const feedback = Number(body?.feedback);

    if (!cardId) {
      return NextResponse.json(
        { error: 'cardId é obrigatório', code: 'MISSING_CARD_ID', requestId },
        { status: 422 },
      );
    }
    if (!Number.isInteger(feedback) || feedback < 1 || feedback > 4) {
      return NextResponse.json(
        { error: 'feedback deve ser inteiro entre 1 e 4', code: 'INVALID_FEEDBACK', requestId },
        { status: 422 },
      );
    }

    const flashcardsService = createFlashcardsService();
    const data = await flashcardsService.sendFeedback(request.user!.id, cardId, feedback);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[flashcards/feedback]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARDS_FEEDBACK_ERROR', requestId },
      { status: 400 },
    );
  }
}

export const POST = requireUserAuth(handler);



















