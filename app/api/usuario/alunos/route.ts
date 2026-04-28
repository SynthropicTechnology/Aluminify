import { NextResponse } from "next/server";
import {
  createStudentService,
  StudentConflictError,
  StudentValidationError,
  Student,
} from "@/app/[tenant]/(modules)/usuario/services";
import {
  getServiceRoleClient,
  getAuthenticatedClient,
} from "@/app/shared/core/database/database-auth";
import { getDatabaseClientAsUser } from "@/app/shared/core/database/database";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import type { PaginationParams } from "@/app/shared/types/dtos/api-responses";
import { checkStudentLimit } from "@/app/shared/core/services/plan-limits.service";

const serializeStudent = (student: Student) => ({
  id: student.id,
  fullName: student.fullName ?? null,
  email: student.email,
  cpf: student.cpf ?? null,
  phone: student.phone ?? null,
  birthDate: student.birthDate?.toISOString().split("T")[0] ?? null,
  address: student.address ?? null,
  zipCode: student.zipCode ?? null,
  enrollmentNumber: student.enrollmentNumber ?? null,
  instagram: student.instagram ?? null,
  twitter: student.twitter ?? null,
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

  // Log detalhado do erro
  console.error("Student API Error:", error);

  // Extrair mensagem de erro mais detalhada
  let errorMessage = "Internal server error";
  if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
    console.error("Error stack:", error.stack);
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object" && "message" in error) {
    errorMessage = String(error.message);
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

// GET - RLS filtra automaticamente (alunos veem apenas seu próprio perfil)
async function getHandler(request: AuthenticatedRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: PaginationParams = {};

    const page = searchParams.get("page");
    if (page) {
      const pageNum = parseInt(page, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        params.page = pageNum;
      }
    }

    const perPage = searchParams.get("perPage");
    if (perPage) {
      const perPageNum = parseInt(perPage, 10);
      if (!isNaN(perPageNum) && perPageNum > 0) {
        params.perPage = perPageNum;
      }
    }

    const sortBy = searchParams.get("sortBy");
    if (sortBy) {
      params.sortBy = sortBy;
    }

    const sortOrder = searchParams.get("sortOrder");
    if (sortOrder === "asc" || sortOrder === "desc") {
      params.sortOrder = sortOrder;
    }

    // Usar cliente com escopo de usuário para respeitar RLS
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    // Se tivermos um token de usuário, usamos o client com RLS (getDatabaseClientAsUser)
    // Caso contrário (API Key), usamos o cliente autenticado padrão
    const client = token
      ? getDatabaseClientAsUser(token)
      : getAuthenticatedClient(request);

    const service = createStudentService(client);

    const { data, meta } = await service.list(params);
    return NextResponse.json({
      data: data.map(serializeStudent),
      meta,
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST - Criação de aluno (geralmente via signup, mas pode ser manual por staff)
async function postHandler(request: AuthenticatedRequest) {
  console.log("[Student POST] Auth check:", {
    hasUser: !!request.user,
    hasApiKey: !!request.apiKey,
    userRole: request.user?.role,
  });

  try {
    // Somente staff (usuario) / api key podem criar/vincular alunos
    if (
      request.user &&
      request.user.role !== "usuario"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    console.log("[Student POST] Request body:", body);

    if (!body?.email) {
      return NextResponse.json(
        {
          error: "Campo obrigatório: email é necessário",
        },
        { status: 400 },
      );
    }

    // Obter empresaId: priorizar o tenant ativo (effective) do request; validar body se fornecido
    const effectiveEmpresaId = request.user?.empresaId;
    const bodyEmpresaId = body?.empresaId;

    if (bodyEmpresaId && effectiveEmpresaId && bodyEmpresaId !== effectiveEmpresaId) {
      return NextResponse.json(
        { error: "empresaId do body não corresponde ao tenant ativo" },
        { status: 403 },
      );
    }

    const empresaId = effectiveEmpresaId || bodyEmpresaId;

    if (!empresaId) {
      return NextResponse.json(
        {
          error: "empresaId é obrigatório para criar um aluno",
        },
        { status: 400 },
      );
    }

    // Verificar limite de alunos do plano antes de criar
    const limitCheck = await checkStudentLimit(empresaId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message },
        { status: 403 },
      );
    }

    // Para criação/vínculo, usamos service role (bypass RLS) e aplicamos autorização aqui.
    // Motivo: quando o e-mail já existe, o `.upsert()` em `alunos` pode cair no caminho de UPDATE
    // e ser bloqueado por RLS (erro "violates row-level security policy (USING expression)").
    const db = getServiceRoleClient();

    const email = String(body.email).trim().toLowerCase();
    const cpfRaw = body?.cpf != null ? String(body.cpf).trim() : "";
    const cpfNormalized = cpfRaw ? cpfRaw.replace(/\D/g, "") : "";
    const courseIds: string[] = Array.isArray(body?.courseIds)
      ? body.courseIds.filter(Boolean)
      : [];

    // Se o aluno já existe, não tentamos recriar em `usuarios`.
    // Apenas vinculamos aos cursos solicitados (alunos_cursos) se permitido.
    const { data: existingAluno, error: existingAlunoError } = await db
      .from("usuarios")
      .select("id, empresa_id, email")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingAlunoError) {
      console.error("[Student POST] Error checking existing aluno:", existingAlunoError);
    }

    // Se não encontrou por e-mail, mas o CPF foi informado, tente resolver por CPF.
    // Isso evita tentar criar um "novo aluno" com CPF já cadastrado (violaria alunos_cpf_key).
    let resolvedExistingAluno = existingAluno as
      | { id: string; empresa_id: string | null; email?: string | null }
      | null;

    if (!resolvedExistingAluno?.id && cpfNormalized && cpfNormalized.length === 11) {
      const { data: byCpf, error: byCpfError } = await db
        .from("usuarios")
        .select("id, empresa_id, email")
        .eq("cpf", cpfNormalized)
        .is("deleted_at", null)
        .maybeSingle();

      if (byCpfError) {
        console.error("[Student POST] Error checking existing aluno by CPF:", byCpfError);
      }

      if (byCpf?.id) {
        // Se o CPF pertence a outro e-mail, não criamos um novo aluno.
        // (Evita duplicidade e confusão de identidade)
        const existingEmail = (byCpf as { email?: string | null }).email ?? null;
        if (existingEmail && existingEmail !== email) {
          return NextResponse.json(
            {
              error:
                "Este CPF já está cadastrado para outro aluno. Use o cadastro existente e apenas vincule ao curso.",
            },
            { status: 409 },
          );
        }

        resolvedExistingAluno = byCpf as { id: string; empresa_id: string | null; email?: string | null };
      }
    }

    if (resolvedExistingAluno?.id) {
      // Aluno já existe no sistema (possivelmente em outra empresa)
      // Permitir vínculo cross-tenant - criar vínculo em usuarios_empresas e vincular aos cursos
      // O empresa_id "primário" do aluno permanece inalterado para compatibilidade
      const existingAlunoId = resolvedExistingAluno.id;

      // Criar vínculo em usuarios_empresas para a nova empresa (se ainda não existir)
      const { error: vinculoError } = await db
        .from("usuarios_empresas")
        .upsert(
          {
            usuario_id: existingAlunoId,
            empresa_id: empresaId,
            papel_base: "aluno",
            ativo: true,
          },
          { onConflict: "usuario_id,empresa_id,papel_base", ignoreDuplicates: true },
        );

      if (vinculoError) {
        console.error("[Student POST] Error creating tenant binding:", vinculoError);
        return NextResponse.json(
          { error: `Erro ao vincular aluno à empresa: ${vinculoError.message}` },
          { status: 500 },
        );
      }

      // Validar que os cursos informados pertencem à empresa (evita vínculo cross-tenant).
      if (courseIds.length > 0) {
        const { data: cursos, error: cursosError } = await db
          .from("cursos")
          .select("id")
          .eq("empresa_id", empresaId)
          .in("id", courseIds);

        if (cursosError) {
          console.error("[Student POST] Error validating cursos:", cursosError);
          return NextResponse.json({ error: "Erro ao validar cursos" }, { status: 500 });
        }

        const validIds = new Set((cursos ?? []).map((c) => c.id));
        const invalidIds = courseIds.filter((id) => !validIds.has(id));
        if (invalidIds.length > 0) {
          return NextResponse.json(
            { error: "Um ou mais cursos selecionados são inválidos para esta empresa." },
            { status: 400 },
          );
        }
      }

      if (courseIds.length > 0) {
        const rows = courseIds.map((cursoId) => ({
          usuario_id: existingAlunoId,
          curso_id: cursoId,
        }));

        const { error: linkError } = await db
          .from("alunos_cursos")
          .upsert(rows, { onConflict: "usuario_id,curso_id", ignoreDuplicates: true });

        if (linkError) {
          console.error("[Student POST] Error linking existing aluno to courses:", linkError);
          return NextResponse.json(
            { error: `Erro ao vincular aluno ao(s) curso(s): ${linkError.message}` },
            { status: 500 },
          );
        }
      }

      // Retornar o aluno já existente com cursos atualizados
      const { StudentRepositoryImpl } = await import(
        "@/app/[tenant]/(modules)/usuario/services/student.repository"
      );
      const repository = new StudentRepositoryImpl(db);
      const updated = await repository.findById(existingAlunoId);
      if (!updated) {
        return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
      }

      return NextResponse.json(
        { data: serializeStudent(updated) },
        { status: 200 },
      );
    }

    // Se não existe, segue criação padrão via service role
    // (mantém validações e criação do auth.users dentro do serviço).
    const service = createStudentService(db);

    const student = await service.create({
      id: body?.id,
      empresaId, // Passando empresaId para isolamento multi-tenant
      fullName: body?.fullName,
      email,
      cpf: body?.cpf,
      phone: body?.phone,
      birthDate: body?.birthDate,
      address: body?.address,
      zipCode: body?.zipCode,
      enrollmentNumber: body?.enrollmentNumber,
      instagram: body?.instagram,
      twitter: body?.twitter,
      courseIds,
      temporaryPassword: body?.temporaryPassword,
    });
    console.log("[Student POST] Student created:", student.id);
    return NextResponse.json(
      { data: serializeStudent(student) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Student POST] Error creating student:", error);
    return handleError(error);
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireAuth(postHandler);
