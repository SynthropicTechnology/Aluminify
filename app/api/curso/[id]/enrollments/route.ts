import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/[tenant]/auth/middleware';
import { getDatabaseClient } from '@/app/shared/core/database/database';

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

    // Get enrollments from alunos_cursos (authoritative source, includes Hotmart + UI enrollments)
    const { data: enrollments, error } = await db
      .from('alunos_cursos')
      .select(`
        curso_id,
        created_at,
        cursos!inner(empresa_id),
        usuario:usuarios!alunos_cursos_usuario_id_fkey (
          id,
          nome_completo,
          email,
          telefone,
          cidade,
          estado
        )
      `)
      .eq('curso_id', courseId)
      .eq('cursos.empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Enrollments API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    const serializedEnrollments = enrollments?.map((e: {
      curso_id: string;
      created_at: string | null;
      usuario: unknown;
    }) => ({
      id: `${(e.usuario as { id: string })?.id}-${e.curso_id}`,
      enrollmentDate: e.created_at || null,
      startDate: null,
      endDate: null,
      active: true,
      student: e.usuario ? {
        id: (e.usuario as { id: string }).id,
        name: (e.usuario as { nome_completo: string }).nome_completo,
        email: (e.usuario as { email: string }).email,
        phone: (e.usuario as { telefone: string | null }).telefone,
        city: (e.usuario as { cidade: string | null }).cidade,
        state: (e.usuario as { estado: string | null }).estado,
      } : null,
    })) || [];

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
