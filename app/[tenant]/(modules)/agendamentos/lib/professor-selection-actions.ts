"use server";

import { createClient } from "@/app/shared/core/server";
import { toZonedTime } from "date-fns-tz";
import { generateAvailableSlots } from "./agendamento-validations";
import {
  ProfessorDisponivel,
  DbAgendamentoRecorrencia,
  DbAgendamentoBloqueio,
} from "../types";
import { SCHEDULING_TIMEZONE } from "./constants";
import {
  getRecorrenciaTurmas,
  getAlunoTurmaIds,
  filterRecorrenciasByTurma,
} from "./turma-filter-helpers";

export async function getProfessoresDisponiveis(
  empresaId?: string,
  alunoId?: string,
): Promise<ProfessorDisponivel[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!empresaId) {
    console.error("empresa_id is required for tenant isolation in getProfessoresDisponiveis");
    return [];
  }

  // Access control is enforced by RLS via aluno_matriculado_empresa().
  // If the student has no enrollment in this tenant, RLS will return empty results.
  const targetEmpresaId = empresaId;

  // Query professores usando o padrão correto de join com papeis
  // Inclui todos os papéis com função de ensino (professor, professor_admin, monitor)
  const { data: professores, error } = await supabase
    .from("usuarios")
    .select(
      "id, nome_completo, email, foto_url, especialidade, biografia, empresa_id, papeis!inner(tipo)",
    )
    .eq("empresa_id", targetEmpresaId)
    .in("papeis.tipo", ["professor", "professor_admin", "monitor"])
    .order("nome_completo", { ascending: true });

  if (error || !professores) {
    console.error("Error fetching professors:", error);
    return [];
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const professorIds = professores.map((p) => p.id);
  const { data: recorrencias } = await supabase
    .from("agendamento_recorrencia")
    .select("*")
    .in("professor_id", professorIds)
    .eq("ativo", true)
    .lte("data_inicio", nextWeekStr)
    .or(`data_fim.is.null,data_fim.gte.${todayStr}`);

  const { data: agendamentos } = await supabase
    .from("agendamentos")
    .select("professor_id, data_inicio, data_fim")
    .in("professor_id", professorIds)
    .gte("data_inicio", today.toISOString())
    .lte("data_inicio", nextWeek.toISOString())
    .neq("status", "cancelado");

  const { data: bloqueios } = await supabase
    .from("agendamento_bloqueios")
    .select("professor_id, data_inicio, data_fim")
    .eq("empresa_id", targetEmpresaId)
    .lte("data_inicio", nextWeek.toISOString())
    .gte("data_fim", today.toISOString());

  // Filter recorrencias by turma if alunoId provided
  let allRecorrencias = (recorrencias || []) as DbAgendamentoRecorrencia[];
  if (alunoId && allRecorrencias.length > 0) {
    const recorrenciaIds = allRecorrencias.map((r) => r.id);
    const [turmasMap, alunoTurmaIds] = await Promise.all([
      getRecorrenciaTurmas(recorrenciaIds),
      getAlunoTurmaIds(alunoId, targetEmpresaId),
    ]);
    allRecorrencias = await filterRecorrenciasByTurma(
      allRecorrencias,
      turmasMap,
      alunoTurmaIds,
    );
  }

  return professores
    .map((professor) => {
      const profRecorrencias = allRecorrencias
        .filter((r) => r.professor_id === professor.id);

      const profAgendamentos = (agendamentos || [])
        .filter((a) => a.professor_id === professor.id)
        .map((a) => ({
          start: new Date(a.data_inicio),
          end: new Date(a.data_fim),
        }));

      const profBloqueios = ((bloqueios || []) as DbAgendamentoBloqueio[])
        .filter((b) => !b.professor_id || b.professor_id === professor.id)
        .map((b) => ({
          start: new Date(b.data_inicio),
          end: new Date(b.data_fim),
        }));

      const allBlockedSlots = [...profAgendamentos, ...profBloqueios];

      const proximosSlots: string[] = [];
      const checkDate = new Date(today);
      let daysChecked = 0;

      while (proximosSlots.length < 3 && daysChecked < 14) {
        const dayOfWeek = toZonedTime(checkDate, SCHEDULING_TIMEZONE).getDay();
        const dateStr = checkDate.toISOString().split("T")[0];

        const dayRules = profRecorrencias.filter(
          (r) =>
            r.dia_semana === dayOfWeek &&
            r.data_inicio <= dateStr &&
            (!r.data_fim || r.data_fim >= dateStr),
        );

        if (dayRules.length > 0) {
          const rules = dayRules.map((r) => ({
            dia_semana: r.dia_semana,
            hora_inicio: r.hora_inicio,
            hora_fim: r.hora_fim,
            ativo: true,
          }));

          const slotDuration = dayRules[0]?.duracao_slot_minutos || 30;
          const slots = generateAvailableSlots(
            checkDate,
            rules,
            allBlockedSlots,
            slotDuration,
            60,
            SCHEDULING_TIMEZONE,
          );

          for (const slot of slots) {
            if (proximosSlots.length < 3) {
              proximosSlots.push(slot.toISOString());
            }
          }
        }

        checkDate.setDate(checkDate.getDate() + 1);
        daysChecked++;
      }

      return {
        id: professor.id,
        nome: professor.nome_completo || "",
        email: professor.email || "",
        foto_url: professor.foto_url,
        especialidade: professor.especialidade,
        bio: professor.biografia,
        empresa_id: professor.empresa_id,
        proximos_slots: proximosSlots,
        tem_disponibilidade: profRecorrencias.length > 0,
      };
    })
    .sort((a, b) => {
      if (a.tem_disponibilidade && !b.tem_disponibilidade) return -1;
      if (!a.tem_disponibilidade && b.tem_disponibilidade) return 1;
      if (a.proximos_slots.length > 0 && b.proximos_slots.length === 0)
        return -1;
      if (a.proximos_slots.length === 0 && b.proximos_slots.length > 0)
        return 1;
      return a.nome.localeCompare(b.nome);
    });
}

export async function getProfessorById(
  professorId: string,
): Promise<ProfessorDisponivel | null> {
  const supabase = await createClient();

  const { data: professor, error } = await supabase
    .from("usuarios")
    .select(
      "id, nome_completo, email, foto_url, especialidade, biografia, empresa_id",
    )
    .eq("id", professorId)
    .single();

  if (error || !professor) {
    console.error("Error fetching professor:", error);
    return null;
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: recorrencias } = await supabase
    .from("agendamento_recorrencia")
    .select("id")
    .eq("professor_id", professorId)
    .eq("ativo", true)
    .lte("data_inicio", todayStr)
    .or(`data_fim.is.null,data_fim.gte.${todayStr}`)
    .limit(1);

  return {
    id: professor.id,
    nome: professor.nome_completo || "",
    email: professor.email || "",
    foto_url: professor.foto_url,
    especialidade: professor.especialidade,
    bio: professor.biografia,
    empresa_id: professor.empresa_id,
    proximos_slots: [],
    tem_disponibilidade: (recorrencias?.length || 0) > 0,
  };
}
