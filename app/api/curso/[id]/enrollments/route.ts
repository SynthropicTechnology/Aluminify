import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClient } from '@/app/shared/core/database/database';
import { fetchCanonicalEnrollments } from '@/app/shared/core/enrollments/canonical-enrollments';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getEnrollmentsHandler(request: AuthenticatedRequest, courseId: string) {
  try {
    const db = getDatabaseClient();
    const empresaId = request.user?.empresaId;

    if (!empresaId) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    const enrollments = await fetchCanonicalEnrollments(db, {
      empresaId,
      cursoId: courseId,
    });

    const studentIds = [...new Set(enrollments.map((enrollment) => enrollment.usuarioId))];
    const { data: usuarios, error: usuariosError } = studentIds.length > 0
      ? await db
        .from('usuarios')
        .select('id, nome_completo, email, telefone, cidade, estado')
        .in('id', studentIds)
      : { data: [], error: null };

    if (usuariosError) {
      console.error('[Enrollments API] Error:', usuariosError);
      return NextResponse.json({ error: usuariosError.message }, { status: 500 });
    }

    // Get course info
    const { data: course, error: courseError } = await db
      .from('cursos')
      .select('id, nome, modalidade, tipo, ano_vigencia, usa_turmas')
      .eq('id', courseId)
      .eq('empresa_id', empresaId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    const usuarioById = new Map((usuarios ?? []).map((usuario) => [usuario.id, usuario]));
    const serializedEnrollments = enrollments.map((enrollment) => {
      const usuario = usuarioById.get(enrollment.usuarioId);
      return {
        id: `${enrollment.usuarioId}-${enrollment.cursoId}`,
        enrollmentDate: null,
        startDate: null,
        endDate: null,
        active: true,
        student: usuario ? {
          id: usuario.id,
          name: usuario.nome_completo,
          email: usuario.email,
          phone: usuario.telefone,
          city: usuario.cidade,
          state: usuario.estado,
        } : null,
      };
    });

    return NextResponse.json({
      data: {
        course: {
          id: course.id,
          name: course.nome,
          modality: course.modalidade,
          type: course.tipo,
          year: course.ano_vigencia,
          usaTurmas: course.usa_turmas ?? false,
        },
        enrollments: serializedEnrollments,
        total: serializedEnrollments.length,
      },
    });
  } catch (error) {
    console.error('[Enrollments API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => getEnrollmentsHandler(req, params.id))(request);
}
