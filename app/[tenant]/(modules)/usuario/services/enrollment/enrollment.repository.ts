import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/shared/core/database.types';
import { Enrollment, CreateEnrollmentInput, UpdateEnrollmentInput } from './enrollment.types';

export interface EnrollmentRepository {
  list(): Promise<Enrollment[]>;
  findById(id: string): Promise<Enrollment | null>;
  findByStudentId(studentId: string): Promise<Enrollment[]>;
  findByCourseId(courseId: string): Promise<Enrollment[]>;
  findActiveByStudentAndCourse(studentId: string, courseId: string): Promise<Enrollment | null>;
  create(payload: CreateEnrollmentInput): Promise<Enrollment>;
  update(id: string, payload: UpdateEnrollmentInput): Promise<Enrollment>;
  delete(id: string): Promise<void>;
  findByEmpresa(empresaId: string): Promise<Enrollment[]>;
  studentExists(studentId: string): Promise<boolean>;
  courseExists(courseId: string): Promise<boolean>;
}

const TABLE = 'matriculas';
const STUDENT_TABLE = 'alunos';
const COURSE_TABLE = 'cursos';
const COURSE_LINK_TABLE = 'alunos_cursos';

// Use generated Database types instead of manual definitions
type EnrollmentRow = Database['public']['Tables']['matriculas']['Row'];
type EnrollmentInsert = Database['public']['Tables']['matriculas']['Insert'];
type EnrollmentUpdate = Database['public']['Tables']['matriculas']['Update'];

function mapRow(row: EnrollmentRow): Enrollment {
  return {
    id: row.id,
    studentId: row.usuario_id ?? '',
    courseId: row.curso_id ?? '',
    enrollmentDate: new Date(row.data_matricula),
    accessStartDate: new Date(row.data_inicio_acesso),
    accessEndDate: new Date(row.data_fim_acesso),
    active: row.ativo,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class EnrollmentRepositoryImpl implements EnrollmentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Enrollment[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .order('data_matricula', { ascending: false });

    if (error) {
      throw new Error(`Failed to list enrollments: ${error.message}`);
    }

    return (data ?? []).map(mapRow);
  }

  async findById(id: string): Promise<Enrollment | null> {
    const { data, error } = await this.client.from(TABLE).select('*').eq('id', id).maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch enrollment: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByStudentId(studentId: string): Promise<Enrollment[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .eq('usuario_id', studentId)
      .order('data_matricula', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch enrollments by student: ${error.message}`);
    }

    return (data ?? []).map(mapRow);
  }

  async findByCourseId(courseId: string): Promise<Enrollment[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .eq('curso_id', courseId)
      .order('data_matricula', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch enrollments by course: ${error.message}`);
    }

    return (data ?? []).map(mapRow);
  }

  async findActiveByStudentAndCourse(studentId: string, courseId: string): Promise<Enrollment | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .eq('usuario_id', studentId)
      .eq('curso_id', courseId)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch active enrollment: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async create(payload: CreateEnrollmentInput): Promise<Enrollment> {
    const insertData: EnrollmentInsert = {
      usuario_id: payload.studentId,
      curso_id: payload.courseId,
      data_inicio_acesso: payload.accessStartDate || new Date().toISOString().split('T')[0],
      data_fim_acesso: payload.accessEndDate,
      ativo: payload.active ?? true,
    };

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create enrollment: ${error.message}`);
    }

    if (data.ativo && data.usuario_id && data.curso_id) {
      await this.syncCourseLink(data.usuario_id, data.curso_id, true);
    }

    return mapRow(data);
  }

  async update(id: string, payload: UpdateEnrollmentInput): Promise<Enrollment> {
    const updateData: EnrollmentUpdate = {};

    if (payload.accessStartDate !== undefined) {
      updateData.data_inicio_acesso = payload.accessStartDate.split('T')[0];
    }

    if (payload.accessEndDate !== undefined) {
      updateData.data_fim_acesso = payload.accessEndDate.split('T')[0];
    }

    if (payload.active !== undefined) {
      updateData.ativo = payload.active;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update enrollment: ${error.message}`);
    }

    if (data.usuario_id && data.curso_id && payload.active !== undefined) {
      await this.syncCourseLink(data.usuario_id, data.curso_id, data.ativo);
    }

    return mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    const { error } = await this.client.from(TABLE).delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete enrollment: ${error.message}`);
    }

    if (existing?.studentId && existing.courseId) {
      await this.syncCourseLink(existing.studentId, existing.courseId, false);
    }
  }

  private async syncCourseLink(
    studentId: string,
    courseId: string,
    active: boolean,
  ): Promise<void> {
    if (active) {
      const { error } = await this.client
        .from(COURSE_LINK_TABLE)
        .upsert(
          { usuario_id: studentId, curso_id: courseId },
          { onConflict: 'usuario_id,curso_id', ignoreDuplicates: true },
        );

      if (error) {
        throw new Error(`Failed to sync active enrollment link: ${error.message}`);
      }
      return;
    }

    const { error } = await this.client
      .from(COURSE_LINK_TABLE)
      .delete()
      .eq('usuario_id', studentId)
      .eq('curso_id', courseId);

    if (error) {
      throw new Error(`Failed to remove inactive enrollment link: ${error.message}`);
    }
  }

  async studentExists(studentId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(STUDENT_TABLE)
      .select('id')
      .eq('id', studentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check student existence: ${error.message}`);
    }

    return !!data;
  }

  async courseExists(courseId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(COURSE_TABLE)
      .select('id')
      .eq('id', courseId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check course existence: ${error.message}`);
    }

    return !!data;
  }

  async findByEmpresa(empresaId: string): Promise<Enrollment[]> {
    // Buscar matrículas em cursos da empresa
    const { data: cursos, error: cursosError } = await this.client
      .from(COURSE_TABLE)
      .select('id')
      .eq('empresa_id', empresaId);

    if (cursosError) {
      throw new Error(`Failed to fetch courses by empresa: ${cursosError.message}`);
    }

    const cursoIds = (cursos ?? []).map((c: { id: string }) => c.id);

    if (!cursoIds.length) {
      return [];
    }

    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .in('curso_id', cursoIds)
      .order('data_matricula', { ascending: false });

    if (error) {
      throw new Error(`Failed to list enrollments by empresa: ${error.message}`);
    }

    return (data ?? []).map(mapRow);
  }
}

