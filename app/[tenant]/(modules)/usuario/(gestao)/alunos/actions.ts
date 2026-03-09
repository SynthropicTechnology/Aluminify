"use server";

import { createStudentService } from "@/app/[tenant]/(modules)/usuario/services/student.service";
import { getAuthenticatedUser } from "@/app/shared/core/auth";
import { CreateStudentInput } from "@/app/shared/types/entities/user";
import { revalidatePath } from "next/cache";
import { canCreate, canDelete } from "@/app/shared/core/roles";
import { getServiceRoleClient } from "@/app/shared/core/database/database-auth";
import { checkStudentLimit } from "@/app/shared/core/services/plan-limits.service";

export async function deleteStudentAction(studentId: string) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return { success: false, error: "Usuário não autenticado" };
    }

    // Check permission to delete students
    const canDeleteStudents = canDelete(user.permissions, "alunos");
    if (!canDeleteStudents) {
      return {
        success: false,
        error: "Permissão negada. Apenas administradores podem excluir alunos.",
      };
    }

    if (!user.empresaId) {
      return {
        success: false,
        error: "Usuário não está associado a uma empresa.",
      };
    }

    const supabase = getServiceRoleClient();
    const studentService = createStudentService(supabase);

    await studentService.delete(studentId, user.empresaId);

    revalidatePath("/usuario/alunos");

    return { success: true };
  } catch (error) {
    console.error("Error deleting student:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createStudentAction(data: CreateStudentInput) {
  try {
    // Obter usuário autenticado para pegar empresaId
    const user = await getAuthenticatedUser();

    if (!user) {
      return { success: false, error: "Usuário não autenticado" };
    }

    if (!user.empresaId) {
      return {
        success: false,
        error: "Usuário não está associado a uma empresa",
      };
    }

    // Check permission to create students
    const canCreateStudents = canCreate(user.permissions, "alunos");
    if (!canCreateStudents) {
      return {
        success: false,
        error:
          "Permissão negada. Apenas administradores podem cadastrar alunos.",
      };
    }

    // Verificar limite de alunos do plano antes de criar
    const limitCheck = await checkStudentLimit(user.empresaId);
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message };
    }

    /**
     * IMPORTANT (multi-tenant):
     * Para permitir que o MESMO e-mail/CPF seja associado a diferentes empresas/cursos,
     * precisamos enxergar registros já existentes fora do escopo RLS do usuário atual.
     * Por isso, a criação/vínculo roda com service role e a autorização fica aqui.
     */
    const supabase = getServiceRoleClient();
    const studentService = createStudentService(supabase);

    // Passar empresaId do usuário para o aluno
    const newStudent = await studentService.create({
      ...data,
      empresaId: user.empresaId,
    });

    revalidatePath("/usuario/alunos");
    revalidatePath("/usuario/alunos");
    revalidatePath("/aluno");

    return { success: true, data: newStudent };
  } catch (error) {
    console.error("Error creating student:", error);
    return { success: false, error: (error as Error).message };
  }
}
