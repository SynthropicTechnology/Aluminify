"use server";

import { createClient } from "@/app/shared/core/server";
import { revalidatePath } from "next/cache";
import { Recorrencia, RecorrenciaWithTurmas, DbAgendamentoRecorrencia, Bloqueio } from "../types";
import type { Database } from "@/app/shared/core/database.types";
import { canManageProfessorSchedule } from "./admin-helpers";

export async function getRecorrencias(
  professorId: string,
): Promise<RecorrenciaWithTurmas[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (user.id !== professorId) {
    const canManage = await canManageProfessorSchedule(professorId);
    if (!canManage) throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("agendamento_recorrencia")
    .select("*")
    .eq("professor_id", professorId)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Error fetching recorrencias:", error);
    throw new Error("Failed to fetch recorrencias");
  }

  const recorrenciaIds = (data || []).map((item) => item.id);

  // Fetch turma links for all recorrencias
  const turmasMap: Record<string, Array<{ turma_id: string; turma_nome: string }>> = {};
  const cursosMap: Record<string, Array<{ curso_id: string; curso_nome: string }>> = {};
  if (recorrenciaIds.length > 0) {
    const { data: turmasData } = await supabase
      .from("agendamento_recorrencia_turmas")
      .select("recorrencia_id, turma_id, turmas(nome)")
      .in("recorrencia_id", recorrenciaIds);

    for (const row of turmasData || []) {
      if (!turmasMap[row.recorrencia_id]) {
        turmasMap[row.recorrencia_id] = [];
      }
      turmasMap[row.recorrencia_id].push({
        turma_id: row.turma_id,
        turma_nome: (row.turmas as unknown as { nome: string })?.nome ?? "",
      });
    }

    // A tabela agendamento_recorrencia_cursos pode não existir em ambientes antigos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cursosData } = await (supabase as any)
      .from("agendamento_recorrencia_cursos")
      .select("recorrencia_id, curso_id, cursos(nome)")
      .in("recorrencia_id", recorrenciaIds);

    for (const row of cursosData || []) {
      if (!cursosMap[row.recorrencia_id]) {
        cursosMap[row.recorrencia_id] = [];
      }
      cursosMap[row.recorrencia_id].push({
        curso_id: row.curso_id,
        curso_nome: (row.cursos as { nome?: string })?.nome ?? "",
      });
    }
  }

  return ((data || []) as unknown as DbAgendamentoRecorrencia[]).map(
    (item) => ({
      id: item.id,
      professor_id: item.professor_id,
      empresa_id: item.empresa_id,
      tipo_servico: item.tipo_servico as "plantao",
      data_inicio: item.data_inicio,
      data_fim: item.data_fim,
      dia_semana: item.dia_semana,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      duracao_slot_minutos: item.duracao_slot_minutos as number,
      ativo: item.ativo,
      created_at: item.created_at ?? undefined,
      updated_at: item.updated_at ?? undefined,
      turmas: turmasMap[item.id] || [],
      cursos: cursosMap[item.id] || [],
    }),
  );
}

export async function createRecorrencia(
  data: Omit<Recorrencia, "id" | "created_at" | "updated_at">,
  turmaIds?: string[],
  cursoIds?: string[],
): Promise<Recorrencia> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (user.id !== data.professor_id) {
    const canManage = await canManageProfessorSchedule(data.professor_id);
    if (!canManage) throw new Error("Unauthorized");
  }

  const payload = {
    professor_id: data.professor_id,
    empresa_id: data.empresa_id,
    tipo_servico: data.tipo_servico,
    data_inicio: data.data_inicio,
    data_fim: data.data_fim || null,
    dia_semana: data.dia_semana,
    hora_inicio: data.hora_inicio,
    hora_fim: data.hora_fim,
    duracao_slot_minutos: data.duracao_slot_minutos,
    ativo: data.ativo ?? true,
  };

  const { data: result, error } = await supabase
    .from("agendamento_recorrencia")
    .insert(
      payload as Database["public"]["Tables"]["agendamento_recorrencia"]["Insert"],
    )
    .select()
    .single();

  if (error) {
    console.error("Error creating recorrencia:", error);
    throw new Error("Failed to create recorrencia");
  }

  // Insert turma links if provided
  const typedResult = result as unknown as DbAgendamentoRecorrencia;
  if (turmaIds && turmaIds.length > 0) {
    const turmaPayload = turmaIds.map((turmaId) => ({
      recorrencia_id: typedResult.id,
      turma_id: turmaId,
      empresa_id: data.empresa_id,
    }));
    const { error: turmaError } = await supabase
      .from("agendamento_recorrencia_turmas")
      .insert(turmaPayload);
    if (turmaError) {
      console.error("Error linking turmas to recorrencia:", turmaError);
    }
  }

  // Insert curso links if provided
  if (cursoIds && cursoIds.length > 0) {
    const cursoPayload = cursoIds.map((cursoId) => ({
      recorrencia_id: typedResult.id,
      curso_id: cursoId,
      empresa_id: data.empresa_id,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: cursoError } = await (supabase as any)
      .from("agendamento_recorrencia_cursos")
      .insert(cursoPayload);
    if (cursoError) {
      console.error("Error linking cursos to recorrencia:", cursoError);
      throw new Error("Failed to link cursos to recorrencia");
    }
  }

  revalidatePath("/agendamentos/disponibilidade");
  revalidatePath("/agendamentos");
  return {
    id: typedResult.id,
    professor_id: typedResult.professor_id,
    empresa_id: typedResult.empresa_id,
    tipo_servico: typedResult.tipo_servico as "plantao",
    data_inicio: typedResult.data_inicio,
    data_fim: typedResult.data_fim,
    dia_semana: typedResult.dia_semana,
    hora_inicio: typedResult.hora_inicio,
    hora_fim: typedResult.hora_fim,
    duracao_slot_minutos: typedResult.duracao_slot_minutos as number,
    ativo: typedResult.ativo,
    created_at: typedResult.created_at ?? undefined,
    updated_at: typedResult.updated_at ?? undefined,
  };
}

export async function updateRecorrencia(
  id: string,
  data: Partial<
    Omit<
      Recorrencia,
      "id" | "professor_id" | "empresa_id" | "created_at" | "updated_at"
    >
  >,
  turmaIds?: string[],
  cursoIds?: string[],
): Promise<Recorrencia> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: existing } = await supabase
    .from("agendamento_recorrencia")
    .select("professor_id")
    .eq("id", id)
    .single();

  if (!existing) {
    throw new Error("Recorrencia not found");
  }

  if (existing.professor_id !== user.id) {
    const canManage = await canManageProfessorSchedule(existing.professor_id);
    if (!canManage) throw new Error("Unauthorized");
  }

  const updateData: Record<string, unknown> = {};
  if (data.tipo_servico !== undefined)
    updateData.tipo_servico = data.tipo_servico;
  if (data.data_inicio !== undefined) updateData.data_inicio = data.data_inicio;
  if (data.data_fim !== undefined) updateData.data_fim = data.data_fim;
  if (data.dia_semana !== undefined) updateData.dia_semana = data.dia_semana;
  if (data.hora_inicio !== undefined) updateData.hora_inicio = data.hora_inicio;
  if (data.hora_fim !== undefined) updateData.hora_fim = data.hora_fim;
  if (data.duracao_slot_minutos !== undefined)
    updateData.duracao_slot_minutos = data.duracao_slot_minutos;
  if (data.ativo !== undefined) updateData.ativo = data.ativo;

  const { data: result, error } = await supabase
    .from("agendamento_recorrencia")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating recorrencia:", error);
    throw new Error("Failed to update recorrencia");
  }

  // Update turma links if turmaIds provided
  if (turmaIds !== undefined) {
    // Delete existing links
    await supabase
      .from("agendamento_recorrencia_turmas")
      .delete()
      .eq("recorrencia_id", id);

    // Insert new links
    if (turmaIds.length > 0) {
      const { data: recForEmpresa } = await supabase
        .from("agendamento_recorrencia")
        .select("empresa_id")
        .eq("id", id)
        .single();
      if (recForEmpresa) {
        const turmaPayload = turmaIds.map((turmaId) => ({
          recorrencia_id: id,
          turma_id: turmaId,
          empresa_id: recForEmpresa.empresa_id,
        }));
        const { error: turmaError } = await supabase
          .from("agendamento_recorrencia_turmas")
          .insert(turmaPayload);
        if (turmaError) {
          console.error("Error updating turma links:", turmaError);
        }
      }
    }
  }

  // Update curso links if cursoIds provided
  if (cursoIds !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteCursoError } = await (supabase as any)
      .from("agendamento_recorrencia_cursos")
      .delete()
      .eq("recorrencia_id", id);
    if (deleteCursoError) {
      console.error("Error deleting existing curso links:", deleteCursoError);
      throw new Error("Failed to update curso links");
    }

    if (cursoIds.length > 0) {
      const { data: recForEmpresa } = await supabase
        .from("agendamento_recorrencia")
        .select("empresa_id")
        .eq("id", id)
        .single();

      if (recForEmpresa) {
        const cursoPayload = cursoIds.map((cursoId) => ({
          recorrencia_id: id,
          curso_id: cursoId,
          empresa_id: recForEmpresa.empresa_id,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: cursoError } = await (supabase as any)
          .from("agendamento_recorrencia_cursos")
          .insert(cursoPayload);
        if (cursoError) {
          console.error("Error updating curso links:", cursoError);
          throw new Error("Failed to update curso links");
        }
      }
    }
  }

  revalidatePath("/agendamentos/disponibilidade");
  revalidatePath("/agendamentos");

  const typedResult = result as unknown as DbAgendamentoRecorrencia;
  return {
    id: typedResult.id,
    professor_id: typedResult.professor_id,
    empresa_id: typedResult.empresa_id,
    tipo_servico: typedResult.tipo_servico as "plantao",
    data_inicio: typedResult.data_inicio,
    data_fim: typedResult.data_fim,
    dia_semana: typedResult.dia_semana,
    hora_inicio: typedResult.hora_inicio,
    hora_fim: typedResult.hora_fim,
    duracao_slot_minutos: typedResult.duracao_slot_minutos as number,
    ativo: typedResult.ativo,
    created_at: typedResult.created_at ?? undefined,
    updated_at: typedResult.updated_at ?? undefined,
  };
}

export async function deleteRecorrencia(
  id: string,
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: existing } = await supabase
    .from("agendamento_recorrencia")
    .select("professor_id")
    .eq("id", id)
    .single();

  if (!existing) {
    throw new Error("Recorrencia not found");
  }

  if (existing.professor_id !== user.id) {
    const canManage = await canManageProfessorSchedule(existing.professor_id);
    if (!canManage) throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("agendamento_recorrencia")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting recorrencia:", error);
    throw new Error("Failed to delete recorrencia");
  }

  revalidatePath("/agendamentos/disponibilidade");
  revalidatePath("/agendamentos");
  return { success: true };
}

export async function getBloqueios(
  professorId?: string,
  empresaId?: string,
): Promise<Bloqueio[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  let query = supabase
    .from("agendamento_bloqueios")
    .select("*")
    .order("data_inicio", { ascending: true });

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  }

  if (professorId) {
    query = query.or(`professor_id.is.null,professor_id.eq.${professorId}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching bloqueios:", error);
    throw new Error("Failed to fetch bloqueios");
  }

  return (data || []).map((item) => ({
    id: item.id,
    professor_id: item.professor_id,
    empresa_id: item.empresa_id,
    tipo: item.tipo as "feriado" | "recesso" | "imprevisto" | "outro",
    data_inicio: item.data_inicio,
    data_fim: item.data_fim,
    motivo: item.motivo,
    criado_por: item.criado_por,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function createBloqueio(
  data: Omit<Bloqueio, "id" | "created_at" | "updated_at">,
): Promise<Bloqueio> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (data.professor_id && data.professor_id !== user.id) {
    const canManage = await canManageProfessorSchedule(data.professor_id);
    if (!canManage) throw new Error("Unauthorized");
  }

  const dataInicio =
    typeof data.data_inicio === "string"
      ? data.data_inicio
      : data.data_inicio.toISOString();
  const dataFim =
    typeof data.data_fim === "string"
      ? data.data_fim
      : data.data_fim.toISOString();

  // Use atomic stored procedure to create bloqueio and cancel conflicts
  // This prevents race condition where appointments could be created during bloqueio creation
  // Using type casting since custom RPC function is not in generated types yet
  const { data: bloqueioId, error: rpcError } = (await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "create_bloqueio_and_cancel_conflicts" as any,
    {
      p_professor_id: data.professor_id || null,
      p_empresa_id: data.empresa_id,
      p_tipo: data.tipo,
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
      p_motivo: data.motivo || null,
      p_criado_por: user.id,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as { data: string | null; error: any };

  if (rpcError) {
    console.error("Error creating bloqueio:", rpcError);
    throw new Error("Failed to create bloqueio");
  }

  if (!bloqueioId || typeof bloqueioId !== "string") {
    throw new Error("Failed to create bloqueio: invalid response");
  }

  // Fetch the created bloqueio to return
  const { data: result, error: fetchError } = await supabase
    .from("agendamento_bloqueios")
    .select("*")
    .eq("id", bloqueioId)
    .single();

  if (fetchError || !result) {
    console.error("Error fetching created bloqueio:", fetchError);
    throw new Error("Failed to fetch created bloqueio");
  }

  revalidatePath("/agendamentos");
  revalidatePath("/agendamentos");

  return {
    id: result.id,
    professor_id: result.professor_id,
    empresa_id: result.empresa_id,
    tipo: result.tipo as "feriado" | "recesso" | "imprevisto" | "outro",
    data_inicio: result.data_inicio,
    data_fim: result.data_fim,
    motivo: result.motivo,
    criado_por: result.criado_por,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
}

export async function updateBloqueio(
  id: string,
  data: Partial<
    Omit<
      Bloqueio,
      "id" | "empresa_id" | "criado_por" | "created_at" | "updated_at"
    >
  >,
): Promise<Bloqueio> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: existing } = await supabase
    .from("agendamento_bloqueios")
    .select("professor_id, empresa_id")
    .eq("id", id)
    .single();

  if (!existing) {
    throw new Error("Bloqueio not found");
  }

  if (existing.professor_id && existing.professor_id !== user.id) {
    const canManage = await canManageProfessorSchedule(existing.professor_id);
    if (!canManage) throw new Error("Unauthorized");
  }

  const updateData: Record<string, unknown> = {};
  if (data.professor_id !== undefined)
    updateData.professor_id = data.professor_id || null;
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.data_inicio !== undefined) {
    updateData.data_inicio =
      typeof data.data_inicio === "string"
        ? data.data_inicio
        : data.data_inicio.toISOString();
  }
  if (data.data_fim !== undefined) {
    updateData.data_fim =
      typeof data.data_fim === "string"
        ? data.data_fim
        : data.data_fim.toISOString();
  }
  if (data.motivo !== undefined) updateData.motivo = data.motivo || null;

  const { data: result, error } = await supabase
    .from("agendamento_bloqueios")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating bloqueio:", error);
    throw new Error("Failed to update bloqueio");
  }

  revalidatePath("/agendamentos");
  revalidatePath("/agendamentos");

  return {
    id: result.id,
    professor_id: result.professor_id,
    empresa_id: result.empresa_id,
    tipo: result.tipo as "feriado" | "recesso" | "imprevisto" | "outro",
    data_inicio: result.data_inicio,
    data_fim: result.data_fim,
    motivo: result.motivo,
    criado_por: result.criado_por,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
}

export async function deleteBloqueio(
  id: string,
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: existing } = await supabase
    .from("agendamento_bloqueios")
    .select("professor_id")
    .eq("id", id)
    .single();

  if (!existing) {
    throw new Error("Bloqueio not found");
  }

  if (existing.professor_id && existing.professor_id !== user.id) {
    const canManage = await canManageProfessorSchedule(existing.professor_id);
    if (!canManage) throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("agendamento_bloqueios")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting bloqueio:", error);
    throw new Error("Failed to delete bloqueio");
  }

  revalidatePath("/agendamentos/disponibilidade");
  revalidatePath("/agendamentos");
  return { success: true };
}
