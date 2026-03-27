"use server";

import { createClient } from "@/app/shared/core/server";
import { toZonedTime } from "date-fns-tz";
import { getConfiguracoesProfessor } from "./config-actions";
import { SCHEDULING_TIMEZONE } from "./constants";
import {
  getRecorrenciaTurmas,
  getRecorrenciaCursos,
  getAlunoTurmaIds,
  getAlunoCursoIds,
  filterRecorrenciasByAudience,
} from "./turma-filter-helpers";

export async function checkConflitos(
  professorId: string,
  dataInicio: Date,
  dataFim: Date,
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agendamentos")
    .select("id")
    .eq("professor_id", professorId)
    .neq("status", "cancelado")
    .or(
      `and(data_inicio.lt.${dataFim.toISOString()},data_fim.gt.${dataInicio.toISOString()})`,
    )
    .limit(1);

  if (error) {
    console.error("Error checking conflicts:", error);
    return false;
  }

  return (data?.length || 0) > 0;
}

export async function validateAgendamento(
  professorId: string,
  dataInicio: Date,
  dataFim: Date,
  alunoId?: string,
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient();

  // Check minimum advance time
  const config = await getConfiguracoesProfessor(professorId);
  const minAdvanceMinutes = config?.tempo_antecedencia_minimo || 60;
  const now = new Date();
  const minAllowedTime = new Date(
    now.getTime() + minAdvanceMinutes * 60 * 1000,
  );

  if (dataInicio < minAllowedTime) {
    return {
      valid: false,
      error: `O agendamento deve ser feito com pelo menos ${minAdvanceMinutes} minutos de antecedência.`,
    };
  }

  // Check for conflicts
  const hasConflict = await checkConflitos(professorId, dataInicio, dataFim);
  if (hasConflict) {
    return {
      valid: false,
      error: "Já existe um agendamento neste horário.",
    };
  }

  // Check if within availability (using agendamento_recorrencia table)
  const localInicio = toZonedTime(dataInicio, SCHEDULING_TIMEZONE);
  const dayOfWeek = localInicio.getDay();
  const dateStr = dataInicio.toISOString().split("T")[0];

  const { data: recorrencias } = await supabase
    .from("agendamento_recorrencia")
    .select("*")
    .eq("professor_id", professorId)
    .eq("dia_semana", dayOfWeek)
    .eq("ativo", true)
    .lte("data_inicio", dateStr)
    .or(`data_fim.is.null,data_fim.gte.${dateStr}`);

  if (!recorrencias || recorrencias.length === 0) {
    return {
      valid: false,
      error: "O professor não tem disponibilidade neste dia.",
    };
  }

  // Filter by turma if alunoId provided
  let filteredRecorrencias = recorrencias;
  if (alunoId) {
    const recorrenciaIds = recorrencias.map((r) => r.id);
    const { data: professor } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("id", professorId)
      .single();
    if (professor?.empresa_id) {
      const [turmasMap, cursosMap, alunoTurmaIds, alunoCursoIds] = await Promise.all([
        getRecorrenciaTurmas(recorrenciaIds),
        getRecorrenciaCursos(recorrenciaIds),
        getAlunoTurmaIds(alunoId, professor.empresa_id),
        getAlunoCursoIds(alunoId, professor.empresa_id),
      ]);
      filteredRecorrencias = await filterRecorrenciasByAudience(
        recorrencias,
        turmasMap,
        alunoTurmaIds,
        cursosMap,
        alunoCursoIds,
      );
    }
    if (filteredRecorrencias.length === 0) {
      return {
        valid: false,
        error: "O professor não tem disponibilidade neste horário.",
      };
    }
  }

  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const localFim = toZonedTime(dataFim, SCHEDULING_TIMEZONE);
  const startMinutes =
    localInicio.getHours() * 60 + localInicio.getMinutes();
  const endMinutes = localFim.getHours() * 60 + localFim.getMinutes();

  const isWithinAvailability = filteredRecorrencias.some((rec) => {
    const ruleStart = timeToMinutes(rec.hora_inicio);
    const ruleEnd = timeToMinutes(rec.hora_fim);
    return startMinutes >= ruleStart && endMinutes <= ruleEnd;
  });

  if (!isWithinAvailability) {
    return {
      valid: false,
      error: "O horario selecionado esta fora da disponibilidade do professor.",
    };
  }

  // Check for bloqueios
  const { data: bloqueios } = await supabase
    .from("agendamento_bloqueios")
    .select("id")
    .or(`professor_id.is.null,professor_id.eq.${professorId}`)
    .lt("data_inicio", dataFim.toISOString())
    .gt("data_fim", dataInicio.toISOString())
    .limit(1);

  if (bloqueios && bloqueios.length > 0) {
    return {
      valid: false,
      error: "O horario selecionado esta bloqueado pelo professor.",
    };
  }

  return { valid: true };
}
