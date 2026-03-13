"use server";

import { createClient } from "@/app/shared/core/server";
import { revalidatePath } from "next/cache";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { generateAvailableSlots } from "./agendamento-validations";
import type { Database } from "@/app/shared/core/database.types";
import {
  Disponibilidade,
  DbAgendamentoRecorrencia,
  DbAgendamentoBloqueio,
} from "../types";
import { getConfiguracoesProfessor } from "./config-actions";
import { SCHEDULING_TIMEZONE } from "./constants";
import {
  getRecorrenciaTurmas,
  getAlunoTurmaIds,
  filterRecorrenciasByTurma,
} from "./turma-filter-helpers";

export async function getDisponibilidade(professorId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agendamento_disponibilidade")
    .select("*")
    .eq("professor_id", professorId)
    .eq("ativo", true);

  if (error) {
    console.error("Error fetching availability:", error);
    return [];
  }

  return data;
}

export async function upsertDisponibilidade(data: Disponibilidade) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Fetch professor's empresa_id
  const { data: professor } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  const empresaId = professor?.empresa_id;

  if (!empresaId) {
    throw new Error("Professor company not found");
  }

  const payload = {
    ...data,
    professor_id: user.id,
    empresa_id: empresaId,
    ativo: data.ativo,
  };

  const { error } = await supabase
    .from("agendamento_disponibilidade")
    .upsert(
      payload as Database["public"]["Tables"]["agendamento_disponibilidade"]["Insert"],
    )
    .select();

  if (error) {
    console.error("Error upserting availability:", error);
    throw new Error("Failed to update availability");
  }

  revalidatePath("/agendamentos");
  return { success: true };
}

export async function getAvailableSlots(professorId: string, dateStr: string, alunoId?: string) {
  const supabase = await createClient();

  const date = new Date(dateStr);
  const localDate = toZonedTime(date, SCHEDULING_TIMEZONE);
  const dayOfWeek = localDate.getDay(); // 0-6
  const dateOnly = dateStr.split("T")[0]; // YYYY-MM-DD format

  // Get professor configuration for minimum advance time
  const config = await getConfiguracoesProfessor(professorId);
  const minAdvanceMinutes = config?.tempo_antecedencia_minimo || 60;

  // Get availability rules from agendamento_recorrencia
  const { data: rulesData } = await supabase
    .from("agendamento_recorrencia")
    .select("*")
    .eq("professor_id", professorId)
    .eq("dia_semana", dayOfWeek)
    .eq("ativo", true)
    .lte("data_inicio", dateOnly)
    .or(`data_fim.is.null,data_fim.gte.${dateOnly}`);

  // Filter by turma if alunoId is provided
  let filteredRulesData = (rulesData || []) as DbAgendamentoRecorrencia[];
  if (alunoId && filteredRulesData.length > 0) {
    const recorrenciaIds = filteredRulesData.map((r) => r.id);
    const { data: professor } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("id", professorId)
      .single();
    if (professor?.empresa_id) {
      const [turmasMap, alunoTurmaIds] = await Promise.all([
        getRecorrenciaTurmas(recorrenciaIds),
        getAlunoTurmaIds(alunoId, professor.empresa_id),
      ]);
      filteredRulesData = await filterRecorrenciasByTurma(
        filteredRulesData,
        turmasMap,
        alunoTurmaIds,
      );
    }
  }

  // Filter and map rules to ensure ativo is boolean
  const rules = filteredRulesData
    .filter((r) => r.ativo === true)
    .map((r) => ({
      dia_semana: r.dia_semana,
      hora_inicio: r.hora_inicio,
      hora_fim: r.hora_fim,
      ativo: r.ativo,
      duracao_slot_minutos: r.duracao_slot_minutos || 30,
    }));

  if (!rules || rules.length === 0) {
    return [];
  }

  // Get existing bookings - use local day boundaries
  const startOfDay = fromZonedTime(`${dateOnly}T00:00:00`, SCHEDULING_TIMEZONE);
  const endOfDay = fromZonedTime(
    `${dateOnly}T23:59:59.999`,
    SCHEDULING_TIMEZONE,
  );

  const { data: bookings } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("professor_id", professorId)
    .gte("data_inicio", startOfDay.toISOString())
    .lte("data_fim", endOfDay.toISOString())
    .neq("status", "cancelado");

  const existingSlots = (bookings || []).map((b) => ({
    start: new Date(b.data_inicio),
    end: new Date(b.data_fim),
  }));

  // Get bloqueios for this professor and date
  const { data: professor } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("id", professorId)
    .single();

  const empresaId = professor?.empresa_id;

  let bloqueios: Array<{ data_inicio: string; data_fim: string }> = [];
  if (empresaId) {
    const { data: bloqueiosData } = await supabase
      .from("agendamento_bloqueios")
      .select("data_inicio, data_fim")
      .eq("empresa_id", empresaId)
      .or(`professor_id.is.null,professor_id.eq.${professorId}`)
      .lte("data_inicio", endOfDay.toISOString())
      .gte("data_fim", startOfDay.toISOString());

    bloqueios = (bloqueiosData as DbAgendamentoBloqueio[]) || [];
  }

  // Add bloqueios to existing slots to exclude them
  const blockedSlots = bloqueios.map((b) => ({
    start: new Date(b.data_inicio),
    end: new Date(b.data_fim),
  }));

  const allBlockedSlots = [...existingSlots, ...blockedSlots];

  // Use the validation library to generate available slots
  const validRules = rules.filter((r) => r.ativo === true);
  const slotDuration = validRules[0]?.duracao_slot_minutos || 30;

  const slots = generateAvailableSlots(
    date,
    validRules,
    allBlockedSlots,
    slotDuration,
    minAdvanceMinutes,
    SCHEDULING_TIMEZONE,
  );

  return {
    slots: slots.map((slot: Date) => slot.toISOString()),
    slotDurationMinutes: slotDuration,
  };
}

export async function getAvailabilityForMonth(
  professorId: string,
  year: number,
  month: number, // 1-12
  alunoId?: string,
): Promise<{ [date: string]: { hasSlots: boolean; slotCount: number } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {};
  }

  // Get professor's empresa_id
  const { data: professor } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("id", professorId)
    .single();

  if (!professor?.empresa_id) {
    return {};
  }

  // Get recorrencias for this professor
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const { data: recorrencias } = await supabase
    .from("agendamento_recorrencia")
    .select("*")
    .eq("professor_id", professorId)
    .eq("ativo", true)
    .or(
      `data_fim.is.null,data_fim.gte.${monthStart.toISOString().split("T")[0]}`,
    )
    .lte("data_inicio", monthEnd.toISOString().split("T")[0]);

  if (!recorrencias || recorrencias.length === 0) {
    return {};
  }

  // Filter recorrencias by turma if alunoId provided
  let filteredRecorrencias = recorrencias;
  if (alunoId) {
    const recorrenciaIds = recorrencias.map((r) => r.id);
    const [turmasMap, alunoTurmaIds] = await Promise.all([
      getRecorrenciaTurmas(recorrenciaIds),
      getAlunoTurmaIds(alunoId, professor.empresa_id),
    ]);
    filteredRecorrencias = await filterRecorrenciasByTurma(
      recorrencias,
      turmasMap,
      alunoTurmaIds,
    );
    if (filteredRecorrencias.length === 0) {
      return {};
    }
  }

  // Create a map of day of week -> recorrencias
  const dayRecorrencias: { [dayOfWeek: number]: boolean } = {};
  for (const rec of filteredRecorrencias) {
    dayRecorrencias[rec.dia_semana] = true;
  }

  // Get existing appointments for the month
  const { data: appointments } = await supabase
    .from("agendamentos")
    .select("data_inicio")
    .eq("professor_id", professorId)
    .in("status", ["pendente", "confirmado"])
    .gte("data_inicio", monthStart.toISOString())
    .lte("data_inicio", monthEnd.toISOString());

  // Get bloqueios for the month
  const { data: bloqueios } = await supabase
    .from("agendamento_bloqueios")
    .select("data_inicio, data_fim, professor_id")
    .eq("empresa_id", professor.empresa_id)
    .or(`professor_id.is.null,professor_id.eq.${professorId}`)
    .lte("data_inicio", monthEnd.toISOString())
    .gte("data_fim", monthStart.toISOString());

  // Count appointments per date
  const appointmentCounts: { [date: string]: number } = {};
  for (const apt of appointments || []) {
    const dateKey = new Date(apt.data_inicio).toISOString().split("T")[0];
    appointmentCounts[dateKey] = (appointmentCounts[dateKey] || 0) + 1;
  }

  // Helper function to check if a day is blocked
  const isDayBlocked = (
    dateStr: string,
    bloqueiosList: Array<{
      data_inicio: string;
      data_fim: string;
      professor_id: string | null;
    }>,
  ): boolean => {
    return bloqueiosList.some((b) => {
      // Use helper to convert UTC ISO string to Zoned Date, then formatted YYYY-MM-DD
      const blockStart = toZonedTime(b.data_inicio, SCHEDULING_TIMEZONE)
        .toISOString()
        .split("T")[0];
      const blockEnd = toZonedTime(b.data_fim, SCHEDULING_TIMEZONE)
        .toISOString()
        .split("T")[0];
      return dateStr >= blockStart && dateStr <= blockEnd;
    });
  };

  // Build availability map for each day of the month
  const availability: {
    [date: string]: { hasSlots: boolean; slotCount: number };
  } = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= monthEnd.getDate(); day++) {
    const date = new Date(year, month - 1, day);
    const dateKey = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();

    // Skip past dates
    if (date < today) {
      continue;
    }

    // Check if day is blocked
    if (isDayBlocked(dateKey, bloqueios || [])) {
      availability[dateKey] = { hasSlots: false, slotCount: 0 };
      continue;
    }

    // Check if this day has recorrencias
    if (dayRecorrencias[dayOfWeek]) {
      const existingCount = appointmentCounts[dateKey] || 0;
      const estimatedSlots = Math.max(0, 10 - existingCount);
      availability[dateKey] = {
        hasSlots: estimatedSlots > 0,
        slotCount: estimatedSlots,
      };
    }
  }

  return availability;
}

export async function deleteDisponibilidade(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("agendamento_disponibilidade")
    .delete()
    .eq("id", id)
    .eq("professor_id", user.id);

  if (error) {
    console.error("Error deleting availability:", error);
    throw new Error("Failed to delete availability");
  }

  revalidatePath("/agendamentos/disponibilidade");
  revalidatePath("/agendamentos");
  return { success: true };
}

export async function bulkUpsertDisponibilidade(items: Disponibilidade[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Fetch professor's empresa_id to ensure tenant scoping
  const { data: professor } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  const empresaId = professor?.empresa_id;

  if (!empresaId) {
    throw new Error("Professor company not found");
  }

  const payload = items.map((item) => ({
    ...item,
    professor_id: user.id, // Enforce current user
    empresa_id: empresaId, // Enforce user's company
    ativo: item.ativo ?? true, // Default to true if missing, or respect input? Comment says "consider enforcing ativo defaults". Let's use ?? true as safe default but respect false.
  }));

  const { error } = await supabase
    .from("agendamento_disponibilidade")
    .upsert(
      payload as Database["public"]["Tables"]["agendamento_disponibilidade"]["Insert"][],
    );

  if (error) {
    console.error("Error bulk upserting availability:", error);
    throw new Error("Failed to update availability");
  }

  revalidatePath("/agendamentos/disponibilidade");
  revalidatePath("/agendamentos");
  return { success: true };
}

export async function getProfessoresDisponibilidade(
  empresaId: string,
  date: Date,
) {
  const supabase = await createClient();
  const dateStr = date.toISOString().split("T")[0];
  const localDate = toZonedTime(date, SCHEDULING_TIMEZONE);
  const dayOfWeek = localDate.getDay();

  // Get all professors from the company
  const { data: professores } = await supabase
    .from("usuarios")
    .select("id, nome_completo, foto_url")
    .eq("empresa_id", empresaId);

  if (!professores || professores.length === 0) {
    return [];
  }

  const professorIds = professores.map((p) => p.id);

  // Get availability patterns for all professors
  const { data: recorrencias } = await supabase
    .from("agendamento_recorrencia")
    .select("*")
    .in("professor_id", professorIds)
    .eq("dia_semana", dayOfWeek)
    .eq("ativo", true)
    .lte("data_inicio", dateStr)
    .or(`data_fim.is.null,data_fim.gte.${dateStr}`);

  // Get bloqueios for all professors - use local day boundaries
  const startOfDay = fromZonedTime(`${dateStr}T00:00:00`, SCHEDULING_TIMEZONE);
  const endOfDay = fromZonedTime(
    `${dateStr}T23:59:59.999`,
    SCHEDULING_TIMEZONE,
  );

  const { data: bloqueios } = await supabase
    .from("agendamento_bloqueios")
    .select("professor_id, data_inicio, data_fim")
    .eq("empresa_id", empresaId)
    .or(`professor_id.is.null,professor_id.in.(${professorIds.join(",")})`)
    .lte("data_inicio", endOfDay.toISOString())
    .gte("data_fim", startOfDay.toISOString());

  // Get existing appointments
  const { data: agendamentos } = await supabase
    .from("agendamentos")
    .select("professor_id, data_inicio, data_fim")
    .in("professor_id", professorIds)
    .gte("data_inicio", startOfDay.toISOString())
    .lte("data_fim", endOfDay.toISOString())
    .neq("status", "cancelado");

  // Build result for each professor
  const result = professores.map((professor) => {
    const profRecorrencias = (
      (recorrencias || []) as DbAgendamentoRecorrencia[]
    ).filter((r) => r.professor_id === professor.id);
    const profBloqueios = ((bloqueios || []) as DbAgendamentoBloqueio[]).filter(
      (b) => !b.professor_id || b.professor_id === professor.id,
    );
    const profAgendamentos = (agendamentos || []).filter(
      (a) => a.professor_id === professor.id,
    ) as Array<{ data_inicio: string; data_fim: string }>;

    // Generate available slots for this professor
    const rules = profRecorrencias.map((r) => ({
      dia_semana: r.dia_semana,
      hora_inicio: r.hora_inicio,
      hora_fim: r.hora_fim,
      ativo: r.ativo,
    }));

    const existingSlots = profAgendamentos.map((a) => ({
      start: new Date(a.data_inicio),
      end: new Date(a.data_fim),
    }));

    const blockedSlots = profBloqueios.map((b) => ({
      start: new Date(b.data_inicio),
      end: new Date(b.data_fim),
    }));

    const allBlockedSlots = [...existingSlots, ...blockedSlots];
    const slotDuration = profRecorrencias[0]?.duracao_slot_minutos || 30;

    const slots = generateAvailableSlots(
      date,
      rules,
      allBlockedSlots,
      slotDuration,
      60, // min advance
      SCHEDULING_TIMEZONE,
    );

    return {
      professor_id: professor.id,
      nome: professor.nome_completo,
      foto: professor.foto_url,
      slots_disponiveis: slots.map((s: Date) => s.toISOString()),
    };
  });

  return result;
}
