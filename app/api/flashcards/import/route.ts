import { NextResponse } from 'next/server';
import { requireUserAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { createFlashcardsService, FlashcardImportRow } from '@/app/[tenant]/(modules)/flashcards/services/flashcards.service';

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
    const rows = (body?.rows ?? []) as FlashcardImportRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Lista de flashcards vazia.', code: 'EMPTY_IMPORT_ROWS', requestId },
        { status: 422 },
      );
    }

    const flashcardsService = createFlashcardsService();
    const result = await flashcardsService.importFlashcards(
      rows,
      request.user!.id,
      request.user?.empresaId,
    );

    const hasErrors = result.errors.length > 0;
    return NextResponse.json(
      {
        data: {
          total: result.total,
          inserted: result.inserted,
          errors: result.errors,
        },
      },
      { status: hasErrors ? 207 : 200 }, // 207 Multi-Status indica parcial
    );
  } catch (error) {
    console.error('[flashcards/import]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARDS_IMPORT_ERROR', requestId },
      { status: 400 },
    );
  }
}

export const POST = requireUserAuth(handler);



















