import { NextRequest, NextResponse } from 'next/server';
import {
  cursoService,
  createCursoService,
  CourseConflictError,
  CourseNotFoundError,
  CourseValidationError,
} from '@/app/[tenant]/(modules)/curso/services';
import { requireAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClientAsUser } from '@/app/shared/core/database/database';

const serializeCourse = (course: Awaited<ReturnType<typeof cursoService.getById>>) => ({
  id: course.id,
  segmentId: course.segmentId,
  disciplineId: course.disciplineId, // Mantido para compatibilidade
  disciplineIds: course.disciplineIds, // Nova propriedade
  name: course.name,
  modality: course.modality,
  type: course.type,
  description: course.description,
  year: course.year,
  startDate: course.startDate?.toISOString().split('T')[0] ?? null,
  endDate: course.endDate?.toISOString().split('T')[0] ?? null,
  accessMonths: course.accessMonths,
  planningUrl: course.planningUrl,
  coverImageUrl: course.coverImageUrl,
  usaTurmas: course.usaTurmas,
  hotmartProductIds: course.hotmartProductIds,
  hotmartProductId: course.hotmartProductId,
  createdAt: course.createdAt.toISOString(),
  updatedAt: course.updatedAt.toISOString(),
});

function handleError(error: unknown) {
  if (error instanceof CourseValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CourseConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof CourseNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  console.error('[Course API] Unexpected error:', error);
  if (error instanceof Error) {
    console.error('[Course API] Error message:', error.message);
    console.error('[Course API] Error stack:', error.stack);
  }
  return NextResponse.json({
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { details: error.message } : {})
  }, { status: 500 });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET é público (catálogo)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const course = await cursoService.getById(params.id);
    return NextResponse.json({ data: serializeCourse(course) });
  } catch (error) {
    return handleError(error);
  }
}

// PUT requer autenticação (JWT ou API Key) - RLS verifica se é o criador ou admin
async function putHandler(request: AuthenticatedRequest, params: { id: string }) {
  try {
    if (!params || !params.id) {
      console.error('[Course PUT Handler] Invalid params:', params);
      return NextResponse.json({ error: 'ID do curso é obrigatório' }, { status: 400 });
    }

    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 401 });
    }
    const userClient = getDatabaseClientAsUser(token);
    const userCursoService = createCursoService(userClient);

    const body = await request.json();
    const course = await userCursoService.update(params.id, {
      segmentId: body?.segmentId,
      disciplineId: body?.disciplineId, // Mantido para compatibilidade
      disciplineIds: body?.disciplineIds, // Nova propriedade
      name: body?.name,
      modality: body?.modality,
      type: body?.type,
      description: body?.description,
      year: body?.year,
      startDate: body?.startDate,
      endDate: body?.endDate,
      accessMonths: body?.accessMonths,
      planningUrl: body?.planningUrl,
      coverImageUrl: body?.coverImageUrl,
      usaTurmas: body?.usaTurmas,
      hotmartProductIds:
        body?.hotmartProductIds ??
        (body?.hotmartProductId !== undefined
          ? body.hotmartProductId
            ? [body.hotmartProductId]
            : []
          : undefined),
      hotmartProductId: body?.hotmartProductId,
    });
    return NextResponse.json({ data: serializeCourse(course) });
  } catch (error) {
    console.error('[Course PUT Handler] Error:', error);
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
    const userCursoService = createCursoService(userClient);

    await userCursoService.delete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    if (!params || !params.id) {
      console.error('[Course PUT] Invalid params:', params);
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }
    return requireAuth((req) => putHandler(req, params))(request);
  } catch (error) {
    console.error('[Course PUT] Error in PUT handler:', error);
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => deleteHandler(req, params))(request);
}

