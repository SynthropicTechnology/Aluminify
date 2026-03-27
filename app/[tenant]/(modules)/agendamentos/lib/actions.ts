/**
 * Agendamentos Actions Index
 *
 * This file re-exports all server action functions from specialized modules to maintain
 * backward compatibility while allowing a more modular and maintainable structure.
 *
 * NOTE: Types should be imported directly from "@/app/[tenant]/(modules)/agendamentos/types"
 * because "use server" files can only export async server action functions.
 */

// Availability actions
import {
  getDisponibilidade,
  upsertDisponibilidade,
  getAvailableSlots,
  getAvailabilityForMonth,
  deleteDisponibilidade,
  bulkUpsertDisponibilidade,
  getProfessoresDisponibilidade,
} from "./availability-actions";

export {
  getDisponibilidade,
  upsertDisponibilidade,
  getAvailableSlots,
  getAvailabilityForMonth,
  deleteDisponibilidade,
  bulkUpsertDisponibilidade,
  getProfessoresDisponibilidade,
};

// Appointment actions
import {
  createAgendamento,
  getAgendamentosProfessor,
  getAgendamentosAluno,
  getAgendamentoById,
  confirmarAgendamento,
  rejeitarAgendamento,
  cancelAgendamentoWithReason,
  updateAgendamento,
  getAgendamentosEmpresa,
  getAgendamentoStats,
  getAgendamentosGlobal,
  getAgendamentoStatsGlobal,
} from "./appointment-actions";

export {
  createAgendamento,
  getAgendamentosProfessor,
  getAgendamentosAluno,
  getAgendamentoById,
  confirmarAgendamento,
  rejeitarAgendamento,
  cancelAgendamentoWithReason,
  updateAgendamento,
  getAgendamentosEmpresa,
  getAgendamentoStats,
  getAgendamentosGlobal,
  getAgendamentoStatsGlobal,
};

// Config actions
import {
  getConfiguracoesProfessor,
  updateConfiguracoesProfessor,
} from "./config-actions";

export {
  getConfiguracoesProfessor,
  updateConfiguracoesProfessor,
};

// Recurrence actions
import {
  getRecorrencias,
  createRecorrencia,
  updateRecorrencia,
  deleteRecorrencia,
  getBloqueios,
  createBloqueio,
  updateBloqueio,
  deleteBloqueio,
} from "./recurrence-actions";

export {
  getRecorrencias,
  createRecorrencia,
  updateRecorrencia,
  deleteRecorrencia,
  getBloqueios,
  createBloqueio,
  updateBloqueio,
  deleteBloqueio,
};

// Validation actions
import { validateAgendamento, checkConflitos } from "./validation-actions";

export { validateAgendamento, checkConflitos };

// Report actions
import {
  gerarRelatorio,
  getRelatorios,
  getRelatorioById,
} from "./report-actions";

export { gerarRelatorio, getRelatorios, getRelatorioById };

// Professor selection actions
import {
  getProfessoresDisponiveis,
  getProfessorById,
} from "./professor-selection-actions";

export { getProfessoresDisponiveis, getProfessorById };

// Admin helpers
import {
  getAdminContext,
  getTeachersForAdminSelector,
  canManageProfessorSchedule,
} from "./admin-helpers";

export {
  getAdminContext,
  getTeachersForAdminSelector,
  canManageProfessorSchedule,
};

// Turma filter helpers
import { getTurmasForSelector, getCursosForSelector } from "./turma-filter-helpers";

export { getTurmasForSelector, getCursosForSelector };
