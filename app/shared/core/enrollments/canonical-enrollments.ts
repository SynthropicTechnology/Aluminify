import type { SupabaseClient } from "@supabase/supabase-js";

type AppSupabaseClient = SupabaseClient;

export interface CourseLinkRow {
  usuario_id: string | null;
  curso_id: string | null;
  cursos:
    | { empresa_id: string | null }
    | { empresa_id: string | null }[]
    | null;
}

export interface MatriculaRow {
  id: string;
  usuario_id: string | null;
  curso_id: string | null;
  empresa_id: string | null;
  ativo: boolean | null;
  data_inicio_acesso: string | null;
  data_fim_acesso: string | null;
}

export interface CanonicalEnrollment {
  usuarioId: string;
  cursoId: string;
  empresaId: string;
  hasAlunosCursos: boolean;
  hasMatricula: boolean;
  matriculaId: string | null;
  active: boolean;
}

export interface CanonicalEnrollmentFilters {
  empresaId?: string;
  usuarioId?: string;
  cursoId?: string;
  dataRef?: Date | string;
  activeOnly?: boolean;
}

function normalizeDate(value?: Date | string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function getCourseEmpresaId(row: CourseLinkRow): string | null {
  if (Array.isArray(row.cursos)) {
    return row.cursos[0]?.empresa_id ?? null;
  }
  return row.cursos?.empresa_id ?? null;
}

function isMatriculaVigente(row: MatriculaRow, dataRef: string): boolean {
  return (
    row.ativo === true &&
    (!row.data_inicio_acesso || row.data_inicio_acesso <= dataRef) &&
    (!row.data_fim_acesso || row.data_fim_acesso >= dataRef)
  );
}

export function mergeCanonicalEnrollments(
  courseLinks: CourseLinkRow[],
  matriculas: MatriculaRow[],
  filters: CanonicalEnrollmentFilters = {},
): CanonicalEnrollment[] {
  const dataRef = normalizeDate(filters.dataRef);
  const map = new Map<string, CanonicalEnrollment>();

  for (const link of courseLinks) {
    const empresaId = getCourseEmpresaId(link);
    if (!link.usuario_id || !link.curso_id || !empresaId) continue;

    const key = `${link.usuario_id}:${link.curso_id}:${empresaId}`;
    map.set(key, {
      usuarioId: link.usuario_id,
      cursoId: link.curso_id,
      empresaId,
      hasAlunosCursos: true,
      hasMatricula: false,
      matriculaId: null,
      active: true,
    });
  }

  for (const matricula of matriculas) {
    if (!matricula.usuario_id || !matricula.curso_id || !matricula.empresa_id) {
      continue;
    }

    const key = `${matricula.usuario_id}:${matricula.curso_id}:${matricula.empresa_id}`;
    const existing = map.get(key);
    const matriculaActive = isMatriculaVigente(matricula, dataRef);

    if (existing) {
      const hadMatricula = existing.hasMatricula;
      existing.hasMatricula = true;
      existing.matriculaId = existing.matriculaId ?? matricula.id;
      existing.active = hadMatricula ? existing.active || matriculaActive : matriculaActive;
      map.set(key, existing);
      continue;
    }

    map.set(key, {
      usuarioId: matricula.usuario_id,
      cursoId: matricula.curso_id,
      empresaId: matricula.empresa_id,
      hasAlunosCursos: false,
      hasMatricula: true,
      matriculaId: matricula.id,
      active: matriculaActive,
    });
  }

  return [...map.values()].filter((row) =>
    filters.activeOnly === false ? true : row.active,
  );
}

export async function fetchCanonicalEnrollments(
  client: AppSupabaseClient,
  filters: CanonicalEnrollmentFilters = {},
): Promise<CanonicalEnrollment[]> {
  let courseLinksQuery = client
    .from("alunos_cursos")
    .select("usuario_id, curso_id, cursos!inner(empresa_id)");

  if (filters.usuarioId) {
    courseLinksQuery = courseLinksQuery.eq("usuario_id", filters.usuarioId);
  }
  if (filters.cursoId) {
    courseLinksQuery = courseLinksQuery.eq("curso_id", filters.cursoId);
  }
  if (filters.empresaId) {
    courseLinksQuery = courseLinksQuery.eq("cursos.empresa_id", filters.empresaId);
  }

  let matriculasQuery = client
    .from("matriculas")
    .select("id, usuario_id, curso_id, empresa_id, ativo, data_inicio_acesso, data_fim_acesso");

  if (filters.usuarioId) {
    matriculasQuery = matriculasQuery.eq("usuario_id", filters.usuarioId);
  }
  if (filters.cursoId) {
    matriculasQuery = matriculasQuery.eq("curso_id", filters.cursoId);
  }
  if (filters.empresaId) {
    matriculasQuery = matriculasQuery.eq("empresa_id", filters.empresaId);
  }

  const [courseLinksResult, matriculasResult] = await Promise.all([
    courseLinksQuery,
    matriculasQuery,
  ]);

  if (courseLinksResult.error) {
    throw new Error(
      `Failed to fetch canonical course links: ${courseLinksResult.error.message}`,
    );
  }

  if (matriculasResult.error) {
    throw new Error(
      `Failed to fetch canonical matriculas: ${matriculasResult.error.message}`,
    );
  }

  return mergeCanonicalEnrollments(
    (courseLinksResult.data ?? []) as unknown as CourseLinkRow[],
    (matriculasResult.data ?? []) as unknown as MatriculaRow[],
    filters,
  );
}

export async function fetchCanonicalStudentIds(
  client: AppSupabaseClient,
  filters: CanonicalEnrollmentFilters = {},
): Promise<string[]> {
  const enrollments = await fetchCanonicalEnrollments(client, filters);
  return [...new Set(enrollments.map((row) => row.usuarioId))];
}

export async function fetchCanonicalCourseIdsForStudent(
  client: AppSupabaseClient,
  studentId: string,
  empresaId?: string,
): Promise<string[]> {
  const enrollments = await fetchCanonicalEnrollments(client, {
    usuarioId: studentId,
    empresaId,
  });
  return [...new Set(enrollments.map((row) => row.cursoId))];
}
