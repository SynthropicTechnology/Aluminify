import { NextResponse } from 'next/server';
import { requireUserAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { createFlashcardsService, type FlashcardsReviewScope } from '@/app/[tenant]/(modules)/flashcards/services/flashcards.service';

async function handler(request: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(request.url);
    const modo = searchParams.get('modo') ?? 'revisao_geral';
    const cursoId = searchParams.get('cursoId') || undefined;
    const frenteId = searchParams.get('frenteId') || undefined;
    const moduloId = searchParams.get('moduloId') || undefined;
    const requestedEmpresaId =
      searchParams.get('empresa_id') || searchParams.get('empresaId') || undefined;
    const empresaId = request.user?.empresaId || undefined;
    if (requestedEmpresaId && empresaId && requestedEmpresaId !== empresaId) {
      return NextResponse.json(
        { error: 'Tenant inválido para o usuário autenticado.', code: 'TENANT_MISMATCH', requestId },
        { status: 403 },
      );
    }
    const scopeParam = searchParams.get('scope') || undefined;
    const scope: FlashcardsReviewScope = scopeParam === 'completed' ? 'completed' : 'all';
    const allowedModos = new Set([
      'mais_errados',
      'mais_cobrados',
      'conteudos_basicos',
      'revisao_geral',
      'personalizado',
    ]);
    if (!allowedModos.has(modo)) {
      return NextResponse.json(
        { error: 'Modo de revisão inválido.', code: 'INVALID_MODO', requestId },
        { status: 422 },
      );
    }
    if (scopeParam && scopeParam !== 'all' && scopeParam !== 'completed') {
      return NextResponse.json(
        { error: 'Escopo de revisão inválido.', code: 'INVALID_SCOPE', requestId },
        { status: 422 },
      );
    }

    // Parâmetro para excluir cards já vistos na sessão
    const excludeIdsParam = searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',').filter(Boolean) : undefined;

    console.log(
      `[flashcards/revisao] Requisição recebida - modo: ${modo}, alunoId: ${request.user!.id}, empresaId: ${empresaId || '(todas)'}`,
    );
    const flashcardsService = createFlashcardsService();
    const data = await flashcardsService.listForReview(
      request.user!.id,
      modo,
      { cursoId, frenteId, moduloId, empresaId },
      excludeIds,
      scope,
      empresaId,
    );
    console.log(`[flashcards/revisao] Retornando ${data.length} flashcards`);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[flashcards/revisao] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARDS_REVIEW_ERROR', requestId },
      { status: 400 },
    );
  }
}

export const GET = requireUserAuth(handler);


