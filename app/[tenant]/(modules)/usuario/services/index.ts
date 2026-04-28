import { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { StudentRepositoryImpl } from "./student.repository";
import { StudentService } from "./student.service";
import { TeacherRepositoryImpl } from "./teacher.repository";
import { TeacherService } from "./teacher.service";

// === STUDENT SERVICE FACTORY ===

/**
 * Factory function para criar StudentService com cliente Supabase específico.
 * Use esta função quando precisar que as RLS policies sejam aplicadas.
 *
 * @param client - Cliente Supabase com contexto do usuário autenticado
 * @returns Instância de StudentService que respeita RLS
 */
export function createStudentService(client: SupabaseClient): StudentService {
  const repository = new StudentRepositoryImpl(client);
  return new StudentService(repository, client);
}

// === ADMIN STUDENT SERVICE (bypassa RLS - usar apenas em contextos seguros) ===

let _adminStudentService: StudentService | null = null;

function getAdminStudentService(): StudentService {
  if (!_adminStudentService) {
    const databaseClient = getDatabaseClient();
    const repository = new StudentRepositoryImpl(databaseClient);
    _adminStudentService = new StudentService(repository, databaseClient);
  }
  return _adminStudentService;
}

/**
 * @deprecated Use createStudentService(client) com cliente do usuário para respeitar RLS.
 * Este proxy usa admin client e BYPASSA todas as RLS policies.
 */
export const studentService = new Proxy({} as StudentService, {
  get(_target, prop) {
    return getAdminStudentService()[prop as keyof StudentService];
  },
});

// === TEACHER SERVICE FACTORY ===

/**
 * Factory function para criar TeacherService com cliente Supabase específico.
 * Use esta função quando precisar que as RLS policies sejam aplicadas.
 *
 * @param client - Cliente Supabase com contexto do usuário autenticado
 * @returns Instância de TeacherService que respeita RLS
 */
export function createTeacherService(client: SupabaseClient): TeacherService {
  const repository = new TeacherRepositoryImpl(client);
  return new TeacherService(repository);
}

// === ADMIN TEACHER SERVICE (bypassa RLS - usar apenas em contextos seguros) ===

let _adminTeacherService: TeacherService | null = null;

function getAdminTeacherService(): TeacherService {
  if (!_adminTeacherService) {
    const databaseClient = getDatabaseClient();
    const repository = new TeacherRepositoryImpl(databaseClient);
    _adminTeacherService = new TeacherService(repository);
  }
  return _adminTeacherService;
}

/**
 * @deprecated Use createTeacherService(client) com cliente do usuário para respeitar RLS.
 * Este proxy usa admin client e BYPASSA todas as RLS policies.
 */
export const teacherService = new Proxy({} as TeacherService, {
  get(_target, prop) {
    return getAdminTeacherService()[prop as keyof TeacherService];
  },
});

// === RE-EXPORTS ===

// Types
export * from "./student.types";
export * from "./teacher.types";
export * from "./student-transfer.types";
export * from "./user-role-identifier.types";

// Repositories
export * from "./usuario.repository";
export * from "./student.repository";
export { TeacherRepositoryImpl } from "./teacher.repository";
export * from "./student-transfer.repository";
export * from "./papel.repository";

// Services
export * from "./student.service";
export * from "./teacher.service";
export * from "./student-organizations.service";
export * from "./student-transfer.service";
export * from "./student-import.service";
export * from "./student-template.service";
export * from "./user-base.service";
export * from "./permission.service";
export * from "./user-role-identifier.service";

// Errors
export * from "./errors";

// Enrollment submodule
export * from "./enrollment";
