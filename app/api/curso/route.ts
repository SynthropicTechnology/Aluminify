import { NextResponse } from "next/server";
import {
  cursoService,
  createCursoService,
  CourseConflictError,
  CourseValidationError,
} from "@/app/[tenant]/(modules)/curso/services";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import {
  getDatabaseClient,
  getDatabaseClientAsUser,
} from "@/app/shared/core/database/database";
import { checkCourseLimit } from "@/app/shared/core/services/plan-limits.service";

const serializeCourse = (
  course: Awaited<ReturnType<typeof cursoService.getById>>,
) => ({
  id: course.id,
  segmentId: course.segmentId,
  disciplineId: course.disciplineId, // Mantido para compatibilidade
  disciplineIds: course.disciplineIds, // Nova propriedade
  name: course.name,
  modality: course.modality,
  modalityId: course.modalityId,
  modalityData: course.modalityData,
  type: course.type,
  description: course.description,
  year: course.year,
  startDate: course.startDate?.toISOString().split("T")[0] ?? null,
  endDate: course.endDate?.toISOString().split("T")[0] ?? null,
  accessMonths: course.accessMonths,
  planningUrl: course.planningUrl,
  coverImageUrl: course.coverImageUrl,
  usaTurmas: course.usaTurmas,
  hotmartProductIds: course.hotmartProductIds,
  hotmartProductId: course.hotmartProductId,
  createdAt: course.createdAt.toISOString(),
  updatedAt: course.updatedAt.toISOString(),
});

function handleError(error: unknown) {
  if (error instanceof CourseValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CourseConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  console.error("[Course API] Unhandled error:", error);
  const isDev = process.env.NODE_ENV === "development";
  return NextResponse.json(
    {
      error: "Erro interno do servidor",
      ...(isDev && {
        debug: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      }),
    },
    { status: 500 },
  );
}

// GET requer autenticação para respeitar isolamento de tenant via RLS
async function getHandler(request: AuthenticatedRequest) {
  try {
    // Usar cliente com contexto do usuário para respeitar RLS
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { error: "Token não encontrado" },
        { status: 401 },
      );
    }

    const client = getDatabaseClientAsUser(token);

    // Query cursos com disciplinas associadas
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data: rawData, error } = await (client
      .from("cursos")
      .select(
        `
        id,
        segmento_id,
        disciplina_id,
        nome,
        modalidade,
        modalidade_id,
        tipo,
        descricao,
        ano_vigencia,
        data_inicio,
        data_termino,
        meses_acesso,
        planejamento_url,
        imagem_capa_url,
        usa_turmas,
        created_at,
        updated_at,
        cursos_disciplinas (disciplina_id),
        cursos_hotmart_products (hotmart_product_id),
        modalidades_curso (
          id,
          nome,
          slug
        )
      `,
      )
      .order("nome", { ascending: true }) as unknown as Promise<{
      data: any[];
      error: any;
    }>);

    if (error) {
      throw new Error(`Erro ao listar cursos: ${error.message}`);
    }

    const response = NextResponse.json({
      data: (rawData || []).map((c: any) => ({
        id: c.id,
        segmentId: c.segmento_id,
        disciplineId: c.disciplina_id,
        disciplineIds:
          c.cursos_disciplinas?.map(
            (cd: { disciplina_id: string }) => cd.disciplina_id,
          ) || [],
        name: c.nome,
        modality: c.modalidade,
        modalityId: c.modalidade_id,
        modalityData: c.modalidades_curso,
        type: c.tipo,
        description: c.descricao,
        year: c.ano_vigencia,
        startDate: c.data_inicio,
        endDate: c.data_termino,
        accessMonths: c.meses_acesso,
        planningUrl: c.planejamento_url,
        coverImageUrl: c.imagem_capa_url,
        usaTurmas: c.usa_turmas ?? false,
        hotmartProductIds:
          c.cursos_hotmart_products?.map(
            (p: { hotmart_product_id: string }) => p.hotmart_product_id,
          ) || [],
        hotmartProductId:
          c.cursos_hotmart_products?.[0]?.hotmart_product_id ?? null,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Cache privado pois é específico do usuário/tenant
    response.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=120",
    );

    return response;
  } catch (error) {
    return handleError(error);
  }
}

export const GET = requireAuth(getHandler);

// POST requer autenticação de usuario (JWT ou API Key)
async function postHandler(request: AuthenticatedRequest) {
  if (request.user && request.user.role !== "usuario") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Resolver empresaId:
    // - Usuario: sempre deriva da tabela `usuarios` (fonte de verdade)
    // - API Key: deriva do `createdBy` da API key (que deve ser um usuario)
    let empresaId: string | null = null;

    if (request.user?.role === "usuario") {
      // Preferir empresaId do contexto de auth (já populado pelo middleware)
      empresaId = request.user.empresaId ?? null;

      // Fallback para tabela usuarios se não tiver no contexto
      if (!empresaId) {
        const adminClient = getDatabaseClient();
        const { data: usuario } = await adminClient
          .from("usuarios")
          .select("empresa_id")
          .eq("id", request.user.id)
          .eq("ativo", true)
          .is("deleted_at", null)
          .maybeSingle();

        empresaId = usuario?.empresa_id ?? null;
      }

      if (!empresaId) {
        return NextResponse.json(
          {
            error:
              "empresaId is required (crie/vincule uma empresa antes de cadastrar cursos)",
          },
          { status: 400 },
        );
      }
    } else if (request.apiKey?.createdBy) {
      const adminClient = getDatabaseClient();
      const { data: usuario } = await adminClient
        .from("usuarios")
        .select("empresa_id")
        .eq("id", request.apiKey.createdBy)
        .eq("ativo", true)
        .is("deleted_at", null)
        .maybeSingle();

      empresaId = usuario?.empresa_id ?? null;

      if (!empresaId) {
        return NextResponse.json(
          {
            error:
              "empresaId is required (API key não está vinculada a um usuário com empresa)",
          },
          { status: 400 },
        );
      }
    }

    if (!empresaId) {
      return NextResponse.json(
        {
          error:
            "empresaId is required (não foi possível resolver a empresa do curso)",
        },
        { status: 400 },
      );
    }

    // Verificar limite de cursos do plano antes de criar
    const limitCheck = await checkCourseLimit(empresaId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.message },
        { status: 403 },
      );
    }

    // Usar client com contexto do usuário para respeitar RLS/triggers de tenant
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { error: "Token não encontrado" },
        { status: 401 },
      );
    }
    const userClient = getDatabaseClientAsUser(token);
    const userCursoService = createCursoService(userClient);

    const course = await userCursoService.create({
      empresaId,
      segmentId: body?.segmentId,
      disciplineId: body?.disciplineId, // Mantido para compatibilidade
      disciplineIds: body?.disciplineIds, // Nova propriedade
      name: body?.name,
      modality: body?.modality,
      modalityId: body?.modalityId,
      type: body?.type,
      description: body?.description,
      year: body?.year,
      startDate: body?.startDate,
      endDate: body?.endDate,
      accessMonths: body?.accessMonths,
      planningUrl: body?.planningUrl,
      coverImageUrl: body?.coverImageUrl,
      usaTurmas: body?.usaTurmas,
      hotmartProductIds:
        body?.hotmartProductIds ??
        (body?.hotmartProductId ? [body.hotmartProductId] : undefined),
      hotmartProductId: body?.hotmartProductId,
    });
    return NextResponse.json(
      { data: serializeCourse(course) },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireAuth(postHandler);
