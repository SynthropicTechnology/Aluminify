import { NextRequest, NextResponse } from 'next/server';
import {
  disciplineService,
  createDisciplineService,
  DisciplineConflictError,
  DisciplineNotFoundError,
  DisciplineValidationError,
} from '@/app/[tenant]/(modules)/curso/(gestao)/disciplinas/services';
import { requireAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClientAsUser } from '@/app/shared/core/database/database';

const serializeDiscipline = (discipline: Awaited<ReturnType<typeof disciplineService.getById>>) => ({
  id: discipline.id,
  name: discipline.name,
  createdAt: discipline.createdAt.toISOString(),
  updatedAt: discipline.updatedAt.toISOString(),
});

function handleError(error: unknown) {
  if (error instanceof DisciplineValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof DisciplineConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof DisciplineNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  console.error('[Discipline API] Unexpected error:', error);
  return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET é público (catálogo)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const discipline = await disciplineService.getById(params.id);
    return NextResponse.json({ data: serializeDiscipline(discipline) });
  } catch (error) {
    return handleError(error);
  }
}

// PUT requer autenticação (JWT ou API Key) - RLS verifica se é o criador ou admin
async function putHandler(request: AuthenticatedRequest, params: { id: string }) {
  try {
    if (!request.user?.empresaId) {
      return NextResponse.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 401 });
    }
    const userClient = getDatabaseClientAsUser(token);
    const userDisciplineService = createDisciplineService(userClient);

    const body = await request.json();
    const discipline = await userDisciplineService.update(params.id, {
      name: body?.name,
      empresaId: request.user.empresaId,
    });
    return NextResponse.json({ data: serializeDiscipline(discipline) });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE requer autenticação (JWT ou API Key) - RLS verifica se é o criador ou admin
async function deleteHandler(request: AuthenticatedRequest, params: { id: string }) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 401 });
    }
    const userClient = getDatabaseClientAsUser(token);
    const userDisciplineService = createDisciplineService(userClient);

    await userDisciplineService.delete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => putHandler(req, params))(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => deleteHandler(req, params))(request);
}


