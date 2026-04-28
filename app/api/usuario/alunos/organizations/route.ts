import { NextResponse, type NextRequest } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getAuthenticatedClient } from "@/app/shared/core/database/database-auth";
import { createStudentOrganizationsService } from "@/app/[tenant]/(modules)/usuario/services/student-organizations.service";

function handleError(error: unknown) {
  console.error("Student Organizations API Error:", error);
  let errorMessage = "Internal server error";
  if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  return NextResponse.json(
    {
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.stack
            : String(error)
          : undefined,
    },
    { status: 500 },
  );
}

/**
 * GET /api/usuario/alunos/organizations
 *
 * Returns all organizations where the current student is enrolled.
 * Accessible by authenticated students (role: "aluno") OR admins impersonating a student.
 */
async function getHandler(request: AuthenticatedRequest) {
  try {
    let targetUserId: string | undefined = request.user?.id;
    let targetUserRole: string | undefined = request.user?.role;

    // Check for impersonation
    if (request.impersonationContext) {
      targetUserId = request.impersonationContext.impersonatedUserId;
      targetUserRole = request.impersonationContext.impersonatedUserRole;
    }

    // Only students can access this endpoint (either direct or impersonated)
    if (!targetUserId || targetUserRole !== "aluno") {
      return NextResponse.json(
        { error: "Forbidden: This endpoint is only for students" },
        { status: 403 },
      );
    }

    // Usar cliente autenticado (respeita RLS se for usuário, mas permite cross-tenant se configurado)
    // SECURITY: We only ever return data for the targetUserId.
    const supabase = await getAuthenticatedClient(request);

    // Create service and fetch organizations
    const service = createStudentOrganizationsService(supabase);
    const result =
      await service.getStudentOrganizationsForStudent(targetUserId);

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest) {
  return requireUserAuth(getHandler)(request);
}
