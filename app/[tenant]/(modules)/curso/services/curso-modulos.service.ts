import { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";

// ============================================
// Types
// ============================================

export interface CursoModulo {
  id: string;
  cursoId: string;
  moduleId: string;
  empresaId: string;
  createdAt: Date;
  createdBy: string | null;
}



// ============================================
// Service
// ============================================

export class CursoModulosService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Get all module IDs bound to a specific course
   */
  async getModulesForCourse(cursoId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from("curso_modulos")
      .select("module_id")
      .eq("curso_id", cursoId);

    if (error) {
      throw new Error(`Failed to fetch modules for course: ${error.message}`);
    }

    return (data ?? []).map((row: { module_id: string }) => row.module_id);
  }

  /**
   * Get the UNION of all module IDs from a student's enrolled courses.
   * Uses two-step query: .in() expects an array, not a subquery (passing a query builder causes "object is not iterable").
   */
  async getModulesForStudentCourses(
    usuarioId: string,
    empresaId: string,
  ): Promise<string[]> {
    const cursoIds = await fetchCanonicalCourseIdsForStudent(
      this.client,
      usuarioId,
      empresaId,
    );

    if (cursoIds.length === 0) {
      return [];
    }

    const { data: modules, error: modError } = await this.client
      .from("curso_modulos")
      .select("module_id")
      .eq("empresa_id", empresaId)
      .in("curso_id", cursoIds);

    if (modError) {
      throw new Error(
        `Failed to fetch student course modules: ${modError.message}`,
      );
    }

    return [
      ...new Set(
        (modules ?? []).map((row: { module_id: string }) => row.module_id),
      ),
    ];
  }

  /**
   * Set modules for a course (replace all)
   */
  async setModulesForCourse(
    cursoId: string,
    empresaId: string,
    moduleIds: string[],
    userId: string,
  ): Promise<void> {
    // Delete existing bindings
    const { error: deleteError } = await this.client
      .from("curso_modulos")
      .delete()
      .eq("curso_id", cursoId);

    if (deleteError) {
      throw new Error(`Failed to clear course modules: ${deleteError.message}`);
    }

    // Insert new bindings
    if (moduleIds.length > 0) {
      const rows = moduleIds.map((moduleId) => ({
        curso_id: cursoId,
        module_id: moduleId,
        empresa_id: empresaId,
        created_by: userId,
      }));

      const { error: insertError } = await this.client
        .from("curso_modulos")
        .insert(rows);

      if (insertError) {
        throw new Error(`Failed to set course modules: ${insertError.message}`);
      }
    }
  }

  /**
   * Check if any course in the tenant has module bindings configured
   * Used for backward compatibility: if no bindings exist, show all modules
   */
  async hasAnyCourseModuleBindings(empresaId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from("curso_modulos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    if (error) {
      return false;
    }

    return (count ?? 0) > 0;
  }

}
