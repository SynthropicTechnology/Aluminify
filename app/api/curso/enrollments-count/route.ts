import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClient } from '@/app/shared/core/database/database';
import { fetchCanonicalEnrollments } from '@/app/shared/core/enrollments/canonical-enrollments';

async function getEnrollmentsCountHandler(request: AuthenticatedRequest) {
  try {
    const db = getDatabaseClient();
    const empresaId = request.user?.empresaId;

    if (!empresaId) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    const enrollments = await fetchCanonicalEnrollments(db, { empresaId });

    const counts: Record<string, number> = {};
    for (const row of enrollments) {
      counts[row.cursoId] = (counts[row.cursoId] || 0) + 1;
    }

    return NextResponse.json({ data: counts });
  } catch (error) {
    console.error('[Enrollments Count API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return requireAuth(getEnrollmentsCountHandler)(request);
}
