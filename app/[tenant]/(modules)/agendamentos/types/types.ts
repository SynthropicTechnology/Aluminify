import type { Database } from "@/app/shared/core/database.types";

// =============================================
// Type Aliases from Generated Database Types
// =============================================

export type DbAgendamentoRecorrencia =
  Database["public"]["Tables"]["agendamento_recorrencia"]["Row"];
export type DbAgendamentoBloqueio =
  Database["public"]["Tables"]["agendamento_bloqueios"]["Row"];
export type DbAgendamento = Database["public"]["Tables"]["agendamentos"]["Row"];
export type DbAgendamentoConfiguracoes =
  Database["public"]["Tables"]["agendamento_configuracoes"]["Row"];

// Enums from schema
export type TipoBloqueioEnum =
  Database["public"]["Enums"]["enum_tipo_bloqueio"];
export type TipoServicoEnum =
  Database["public"]["Enums"]["enum_tipo_servico_agendamento"];

// =============================================
// Types for tables NOT in generated schema
// =============================================

export type VAgendamentosEmpresa = {
  id: string;
  professor_id: string;
  aluno_id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  empresa_id: string;
  professor_nome?: string;
  professor_foto?: string;
  aluno_nome?: string;
  aluno_email?: string;
  link_reuniao?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type DbAgendamentoRelatorio = {
  id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  tipo: "mensal" | "semanal" | "customizado";
  dados_json: unknown;
  gerado_em: string;
  gerado_por: string;
  created_at?: string;
  updated_at?: string;
};

// =============================================
// Application Types
// =============================================

export type AgendamentoStatus =
  | "pendente"
  | "confirmado"
  | "cancelado"
  | "concluido";
export type TipoServico = "plantao";
export type TipoBloqueio = "feriado" | "recesso" | "imprevisto" | "outro";
export type IntegrationProvider = "google" | "zoom" | "default";
export type TipoNotificacao =
  | "criacao"
  | "confirmacao"
  | "cancelamento"
  | "lembrete"
  | "alteracao"
  | "rejeicao";

export type Disponibilidade = {
  id?: string;
  professor_id?: string;
  dia_semana: number; // 0-6
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
  ativo: boolean;
};

export type Agendamento = {
  id?: string;
  professor_id: string;
  aluno_id: string;
  data_inicio: string | Date;
  data_fim: string | Date;
  status: AgendamentoStatus;
  link_reuniao?: string | null;
  observacoes?: string | null;
  motivo_cancelamento?: string | null;
  cancelado_por?: string | null;
  confirmado_em?: string | null;
  lembrete_enviado?: boolean;
  lembrete_enviado_em?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AgendamentoComDetalhes = Agendamento & {
  aluno?: {
    id: string;
    nome: string;
    email: string;
    avatar_url?: string | null;
  };
  professor?: {
    id: string;
    nome: string;
    email: string;
    avatar_url?: string | null;
  };
};

export type ConfiguracoesProfessor = {
  id?: string;
  professor_id?: string;
  auto_confirmar: boolean;
  tempo_antecedencia_minimo: number; // minutes
  tempo_lembrete_minutos: number; // minutes
  link_reuniao_padrao?: string | null;
  mensagem_confirmacao?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AgendamentoFilters = {
  status?: AgendamentoStatus | AgendamentoStatus[];
  dateStart?: Date;
  dateEnd?: Date;
};

export type Recorrencia = {
  id?: string;
  professor_id: string;
  empresa_id: string;
  tipo_servico: TipoServico;
  data_inicio: string; // YYYY-MM-DD
  data_fim?: string | null; // YYYY-MM-DD, null = indefinida
  dia_semana: number; // 0-6
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
  duracao_slot_minutos: number; // 15, 30, 45, or 60
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RecorrenciaTurma = {
  turma_id: string;
  turma_nome: string;
};

export type RecorrenciaCurso = {
  curso_id: string;
  curso_nome: string;
};

export type RecorrenciaWithTurmas = Recorrencia & {
  turmas: RecorrenciaTurma[];
  cursos: RecorrenciaCurso[];
};

export type Bloqueio = {
  id?: string;
  professor_id?: string | null; // null = bloqueio para toda empresa
  empresa_id: string;
  tipo: TipoBloqueio;
  data_inicio: string | Date;
  data_fim: string | Date;
  motivo?: string | null;
  criado_por: string;
  created_at?: string;
  updated_at?: string;
};

export type NotificacaoAgendamento = {
  id: string;
  agendamento_id: string;
  tipo: string;
  created_at: string;
  agendamento?: {
    professor_id: string;
    data_inicio: string;
    professor?: { nome_completo: string };
    aluno?: { nome_completo: string };
  };
};

export type RelatorioTipo = "mensal" | "semanal" | "customizado";

export type RelatorioDados = {
  total_agendamentos: number;
  por_status: {
    confirmado: number;
    cancelado: number;
    concluido: number;
    pendente: number;
  };
  por_professor: Array<{
    professor_id: string;
    nome: string;
    total: number;
    taxa_comparecimento: number;
  }>;
  taxa_ocupacao: number;
  horarios_pico: string[];
  taxa_nao_comparecimento: number;
};

export type Relatorio = {
  id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  tipo: RelatorioTipo;
  dados_json: RelatorioDados;
  gerado_em: string;
  gerado_por: string;
  created_at?: string;
  updated_at?: string;
};

export type ProfessorDisponivel = {
  id: string;
  nome: string;
  email: string;
  foto_url?: string | null;
  especialidade?: string | null;
  bio?: string | null;
  empresa_id: string;
  proximos_slots: string[]; // ISO strings of next available slots
  tem_disponibilidade: boolean;
};

export function isValidUserObject(obj: unknown): obj is {
  id: string;
  nome: string;
  email: string;
  avatar_url?: string | null;
} {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !("code" in obj) &&
    "id" in obj &&
    "nome" in obj &&
    "email" in obj
  );
}

// =============================================
// Dashboard View Types
// =============================================

/**
 * Tipo para exibição de próximos agendamentos no dashboard
 */
export interface UpcomingAppointment {
  id: string;
  alunoId: string;
  alunoNome: string;
  alunoAvatar: string | null;
  dataHora: string; // Data ISO
  duracao: number; // Minutos
  status: "pendente" | "confirmado" | "cancelado" | "realizado";
  titulo: string | null;
  notas: string | null;
}
