import { NextRequest, NextResponse } from "next/server";
import {
  getServiceRoleClient,
  getAuthenticatedClient,
} from "@/app/shared/core/database/database-auth";
import {
  createStudentService,
  StudentConflictError,
  StudentNotFoundError,
  StudentValidationError,
} from "@/app/[tenant]/(modules)/usuario/services";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

interface StudentData {
  id: string;
  empresaId: string;
  fullName: string | null;
  email: string;
  cpf: string | null;
  phone: string | null;
  birthDate: Date | null;
  address: string | null;
  zipCode: string | null;
  cidade: string | null;
  estado: string | null;
  bairro: string | null;
  pais: string | null;
  numeroEndereco: string | null;
  complemento: string | null;
  enrollmentNumber: string | null;
  instagram: string | null;
  twitter: string | null;
  hotmartId: string | null;
  origemCadastro: string | null;
  courses: Array<{ id: string; name: string }>;
  mustChangePassword: boolean;
  temporaryPassword: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const serializeStudent = (student: StudentData) => ({
  id: student.id,
  empresaId: student.empresaId,
  fullName: student.fullName,
  email: student.email,
  cpf: student.cpf,
  phone: student.phone,
  birthDate: student.birthDate?.toISOString().split("T")[0] ?? null,
  address: student.address,
  zipCode: student.zipCode,
  cidade: student.cidade,
  estado: student.estado,
  bairro: student.bairro,
  pais: student.pais,
  numeroEndereco: student.numeroEndereco,
  complemento: student.complemento,
  enrollmentNumber: student.enrollmentNumber,
  instagram: student.instagram,
  twitter: student.twitter,
  hotmartId: student.hotmartId,
  origemCadastro: student.origemCadastro,
  courses: student.courses,
  courseIds: student.courses.map((course) => course.id),
  mustChangePassword: student.mustChangePassword,
  temporaryPassword: student.temporaryPassword,
  createdAt: student.createdAt.toISOString(),
  updatedAt: student.updatedAt.toISOString(),
});

function handleError(error: unknown) {
  if (error instanceof StudentValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof StudentConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof StudentNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - RLS filtra automaticamente (alunos veem apenas seu próprio perfil)
async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const supabase = await getAuthenticatedClient(request);
    const service = createStudentService(supabase);
    const student = await service.getById(params.id);
    if (!student) throw new StudentNotFoundError(params.id);
    return NextResponse.json({
      data: serializeStudent({
        ...student,
        empresaId: student.empresaId || "",
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}

// PUT - Usa service role quando há courseIds ou operações de senha (bypass RLS)
async function putHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const body = await request.json();
    // Operações em alunos_cursos e alterações de senha exigem service role
    // (RLS bloqueia insert/delete com anon key e pode bloquear update de alunos cross-tenant)
    const needsServiceRole =
      body?.courseIds ||
      body?.temporaryPassword !== undefined ||
      body?.mustChangePassword !== undefined;
    const supabase = needsServiceRole
      ? getServiceRoleClient()
      : await createClient();
    const service = createStudentService(supabase);
    const student = await service.update(params.id, {
      fullName: body?.fullName,
      email: body?.email,
      cpf: body?.cpf,
      phone: body?.phone,
      birthDate: body?.birthDate,
      address: body?.address,
      zipCode: body?.zipCode,
      enrollmentNumber: body?.enrollmentNumber,
      instagram: body?.instagram,
      twitter: body?.twitter,
      courseIds: body?.courseIds,
      temporaryPassword: body?.temporaryPassword,
      mustChangePassword: body?.mustChangePassword,
      quotaExtra: body?.quotaExtra,
    });
    return NextResponse.json({
      data: serializeStudent({
        ...student,
        empresaId: student.empresaId || "",
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE - Revoga acesso do aluno aos cursos da empresa do usuário logado (não soft-delete global)
async function deleteHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const empresaId = request.user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Usuário não está associado a uma empresa" },
        { status: 400 },
      );
    }
    const supabase = await getAuthenticatedClient(request);
    const service = createStudentService(supabase);
    await service.delete(params.id, empresaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => getHandler(req, params))(request);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => putHandler(req, params))(request);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => deleteHandler(req, params))(request);
}
