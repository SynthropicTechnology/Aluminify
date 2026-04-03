import { NextRequest, NextResponse } from 'next/server';
import {
  segmentService,
  createSegmentService,
  SegmentConflictError,
  SegmentNotFoundError,
  SegmentValidationError,
} from '@/app/[tenant]/(modules)/curso/(gestao)/segmentos/services';
import { requireAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClientAsUser } from '@/app/shared/core/database/database';

const serializeSegment = (segment: Awaited<ReturnType<typeof segmentService.getById>>) => ({
  id: segment.id,
  name: segment.name,
  slug: segment.slug,
  createdAt: segment.createdAt.toISOString(),
  updatedAt: segment.updatedAt.toISOString(),
});

function handleError(error: unknown) {
  if (error instanceof SegmentValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SegmentConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof SegmentNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  console.error('[Segment API] Unexpected error:', error);
  return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET é público (catálogo)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const segment = await segmentService.getById(params.id);
    return NextResponse.json({ data: serializeSegment(segment) });
  } catch (error) {
    return handleError(error);
  }
}

// PUT requer autenticação (JWT ou API Key) - RLS verifica se é o criador ou admin
async function putHandler(request: AuthenticatedRequest, params: { id: string }) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Token não encontrado" }, { status: 401 });
    }
    const userClient = getDatabaseClientAsUser(token);
    const userSegmentService = createSegmentService(userClient);

    const body = await request.json();
    const segment = await userSegmentService.update(params.id, { name: body?.name, slug: body?.slug });
    return NextResponse.json({ data: serializeSegment(segment) });
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
    const userSegmentService = createSegmentService(userClient);

    await userSegmentService.delete(params.id);
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

