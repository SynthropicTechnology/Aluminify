import { NextResponse } from 'next/server';
import { requireUserAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { createFlashcardsService, ListFlashcardsFilters } from '@/app/[tenant]/(modules)/flashcards/services/flashcards.service';

function parseIntegerParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function getHandler(request: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseIntegerParam(searchParams.get('page'), 1);
    const limit = parseIntegerParam(searchParams.get('limit'), 50);
    const orderBy = searchParams.get('orderBy');
    const orderDirection = searchParams.get('orderDirection');

    if (!Number.isFinite(page) || page < 1) {
      return NextResponse.json(
        { error: 'Parâmetro page inválido', code: 'INVALID_PAGE', requestId },
        { status: 422 },
      );
    }
    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Parâmetro limit inválido (1-100)', code: 'INVALID_LIMIT', requestId },
        { status: 422 },
      );
    }
    if (orderBy && orderBy !== 'created_at' && orderBy !== 'pergunta') {
      return NextResponse.json(
        { error: 'Parâmetro orderBy inválido', code: 'INVALID_ORDER_BY', requestId },
        { status: 422 },
      );
    }
    if (orderDirection && orderDirection !== 'asc' && orderDirection !== 'desc') {
      return NextResponse.json(
        { error: 'Parâmetro orderDirection inválido', code: 'INVALID_ORDER_DIRECTION', requestId },
        { status: 422 },
      );
    }

    const filters: ListFlashcardsFilters = {
      disciplinaId: searchParams.get('disciplinaId') || undefined,
      frenteId: searchParams.get('frenteId') || undefined,
      moduloId: searchParams.get('moduloId') || undefined,
      search: searchParams.get('search') || undefined,
      page,
      limit,
      orderBy: (orderBy as 'created_at' | 'pergunta') || undefined,
      orderDirection: (orderDirection as 'asc' | 'desc') || undefined,
    };

    console.log('[flashcards API] Recebida requisição GET com filtros:', JSON.stringify(filters, null, 2));
    console.log('[flashcards API] User ID:', request.user!.id);

    const flashcardsService = createFlashcardsService();
    const result = await flashcardsService.listAll(
      filters,
      request.user!.id,
      request.user?.empresaId,
    );
    
    console.log('[flashcards API] Resultado:', {
      total: result.total,
      dataLength: result.data.length
    });
    
    return NextResponse.json({ data: result.data, total: result.total });
  } catch (error) {
    console.error('[flashcards GET] Erro completo:', error);
    console.error('[flashcards GET] Tipo do erro:', typeof error);
    console.error('[flashcards GET] Erro é instância de Error?', error instanceof Error);
    
    if (error instanceof Error) {
      console.error('[flashcards GET] Mensagem:', error.message);
      console.error('[flashcards GET] Stack:', error.stack);
      console.error('[flashcards GET] Name:', error.name);
    }
    
    // Extrair mensagem de erro de forma segura
    let message = 'Erro interno ao listar flashcards';
    let details: string | undefined = undefined;
    
    if (error instanceof Error) {
      message = error.message || message;
      details = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      message = (errorObj.message as string) || (errorObj.error as string) || message;
      details = errorObj.stack as string | undefined;
    }
    
    // Garantir que a mensagem não seja muito longa ou mal formatada
    if (message.length > 500) {
      message = message.substring(0, 500) + '...';
    }
    
    // Limpar mensagens mal formatadas
    if (message.includes('{"') || message.startsWith('{')) {
      try {
        const parsed = JSON.parse(message);
        message = parsed.error || parsed.message || 'Erro ao processar resposta do servidor';
      } catch {
        // Se não conseguir parsear, usar mensagem genérica
        message = 'Erro ao processar resposta do servidor';
      }
    }
    
    console.error('[flashcards GET] Mensagem final a retornar:', message);
    console.error('[flashcards GET] Tamanho da mensagem:', message.length);
    console.error('[flashcards GET] Primeiros 200 chars da mensagem:', message.substring(0, 200));
    
    // Garantir que a mensagem seja uma string válida
    const safeMessage = String(message).substring(0, 1000);
    
    const responseBody = {
      error: safeMessage,
      code: 'FLASHCARDS_LIST_ERROR',
      requestId,
      ...(process.env.NODE_ENV === 'development' && details ? { details } : {})
    };
    
    console.error('[flashcards GET] Corpo da resposta a ser serializado:', JSON.stringify(responseBody).substring(0, 500));
    
    try {
      const response = NextResponse.json(
        responseBody, 
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      console.error('[flashcards GET] Resposta criada com sucesso');
      return response;
    } catch (jsonError) {
      // Se houver erro ao criar JSON, retornar resposta simples
      console.error('[flashcards GET] Erro ao criar JSON de resposta:', jsonError);
      console.error('[flashcards GET] Tentando criar resposta alternativa...');
      
      try {
        const simpleResponse = new NextResponse(
          JSON.stringify({ error: safeMessage || 'Erro interno ao processar resposta' }),
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );
        return simpleResponse;
      } catch (finalError) {
        console.error('[flashcards GET] Erro ao criar resposta alternativa:', finalError);
        return new NextResponse(
          'Erro interno',
          { 
            status: 500,
            headers: {
              'Content-Type': 'text/plain',
            }
          }
        );
      }
    }
  }
}

async function postHandler(request: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json();
    const { moduloId, pergunta, resposta } = body;

    if (!moduloId || !pergunta || !resposta) {
      return NextResponse.json(
        {
          error: 'Módulo, pergunta e resposta são obrigatórios.',
          code: 'MISSING_REQUIRED_FIELDS',
          requestId,
        },
        { status: 422 },
      );
    }

    const flashcardsService = createFlashcardsService();
    const flashcard = await flashcardsService.create(
      { moduloId, pergunta, resposta },
      request.user!.id,
      request.user?.empresaId,
    );

    return NextResponse.json({ data: flashcard }, { status: 201 });
  } catch (error) {
    console.error('[flashcards POST]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { error: message, code: 'FLASHCARDS_CREATE_ERROR', requestId },
      { status: 400 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
export const POST = requireUserAuth(postHandler);



