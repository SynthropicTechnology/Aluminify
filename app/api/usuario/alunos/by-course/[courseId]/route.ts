import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/app/shared/core/database/database-auth";
import { createStudentTransferService } from "@/app/[tenant]/(modules)/usuario/services";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

interface RouteContext {
  params: Promise<{ courseId: string }>;
}

async function getHandler(request: AuthenticatedRequest, params: { courseId: string }) {
  try {
    const supabase = await getAuthenticatedClient(request);
    const { courseId } = params;

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId e obrigatorio" },
        { status: 400 },
      );
    }

    const transferService = createStudentTransferService(supabase);
    const students = await transferService.getStudentsByCourse(courseId);

    return NextResponse.json({ data: students });
  } catch (error) {
    console.error("Error fetching students by course:", error);
    return NextResponse.json(
      { error: "Erro ao buscar alunos do curso" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => getHandler(req, params))(request);
}
