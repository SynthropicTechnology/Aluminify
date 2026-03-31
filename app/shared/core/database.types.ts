export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamento_bloqueios: {
        Row: {
          created_at: string
          criado_por: string
          data_fim: string
          data_inicio: string
          empresa_id: string
          id: string
          motivo: string | null
          professor_id: string | null
          tipo: Database["public"]["Enums"]["enum_tipo_bloqueio"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          data_fim: string
          data_inicio: string
          empresa_id: string
          id?: string
          motivo?: string | null
          professor_id?: string | null
          tipo?: Database["public"]["Enums"]["enum_tipo_bloqueio"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          professor_id?: string | null
          tipo?: Database["public"]["Enums"]["enum_tipo_bloqueio"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_bloqueios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_bloqueios_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_configuracoes: {
        Row: {
          auto_confirmar: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          link_reuniao_padrao: string | null
          mensagem_confirmacao: string | null
          professor_id: string
          tempo_antecedencia_minimo: number | null
          tempo_lembrete_minutos: number | null
          updated_at: string | null
        }
        Insert: {
          auto_confirmar?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          link_reuniao_padrao?: string | null
          mensagem_confirmacao?: string | null
          professor_id: string
          tempo_antecedencia_minimo?: number | null
          tempo_lembrete_minutos?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_confirmar?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          link_reuniao_padrao?: string | null
          mensagem_confirmacao?: string | null
          professor_id?: string
          tempo_antecedencia_minimo?: number | null
          tempo_lembrete_minutos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_configuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_configuracoes_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_disponibilidade: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dia_semana: number
          empresa_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          professor_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dia_semana: number
          empresa_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          professor_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dia_semana?: number
          empresa_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          professor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_disponibilidade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_disponibilidade_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_notificacoes: {
        Row: {
          agendamento_id: string
          created_at: string | null
          destinatario_id: string
          empresa_id: string | null
          enviado: boolean | null
          enviado_em: string | null
          erro: string | null
          id: string
          tipo: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string | null
          destinatario_id: string
          empresa_id?: string | null
          enviado?: boolean | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          tipo: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string | null
          destinatario_id?: string
          empresa_id?: string | null
          enviado?: boolean | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_notificacoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_recorrencia: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          dia_semana: number
          duracao_slot_minutos: number
          empresa_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          professor_id: string
          tipo_servico: Database["public"]["Enums"]["enum_tipo_servico_agendamento"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          dia_semana: number
          duracao_slot_minutos?: number
          empresa_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          professor_id: string
          tipo_servico?: Database["public"]["Enums"]["enum_tipo_servico_agendamento"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dia_semana?: number
          duracao_slot_minutos?: number
          empresa_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          professor_id?: string
          tipo_servico?: Database["public"]["Enums"]["enum_tipo_servico_agendamento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_recorrencia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_recorrencia_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_recorrencia_cursos: {
        Row: {
          created_at: string
          curso_id: string
          empresa_id: string
          id: string
          recorrencia_id: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          empresa_id: string
          id?: string
          recorrencia_id: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          empresa_id?: string
          id?: string
          recorrencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_recorrencia_cursos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_recorrencia_cursos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_recorrencia_cursos_recorrencia_id_fkey"
            columns: ["recorrencia_id"]
            isOneToOne: false
            referencedRelation: "agendamento_recorrencia"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_recorrencia_turmas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          recorrencia_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          recorrencia_id: string
          turma_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          recorrencia_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_recorrencia_turmas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_recorrencia_turmas_recorrencia_id_fkey"
            columns: ["recorrencia_id"]
            isOneToOne: false
            referencedRelation: "agendamento_recorrencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_recorrencia_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_relatorios: {
        Row: {
          created_at: string
          dados_json: Json
          empresa_id: string
          gerado_em: string
          gerado_por: string
          id: string
          periodo_fim: string
          periodo_inicio: string
          tipo: Database["public"]["Enums"]["enum_tipo_relatorio"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dados_json?: Json
          empresa_id: string
          gerado_em?: string
          gerado_por: string
          id?: string
          periodo_fim: string
          periodo_inicio: string
          tipo: Database["public"]["Enums"]["enum_tipo_relatorio"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dados_json?: Json
          empresa_id?: string
          gerado_em?: string
          gerado_por?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          tipo?: Database["public"]["Enums"]["enum_tipo_relatorio"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_relatorios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          aluno_id: string
          cancelado_por: string | null
          confirmado_em: string | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          empresa_id: string
          id: string
          lembrete_enviado: boolean | null
          lembrete_enviado_em: string | null
          link_reuniao: string | null
          motivo_cancelamento: string | null
          observacoes: string | null
          professor_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          cancelado_por?: string | null
          confirmado_em?: string | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          empresa_id: string
          id?: string
          lembrete_enviado?: boolean | null
          lembrete_enviado_em?: string | null
          link_reuniao?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          professor_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          cancelado_por?: string | null
          confirmado_em?: string | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          empresa_id?: string
          id?: string
          lembrete_enviado?: boolean | null
          lembrete_enviado_em?: string | null
          link_reuniao?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          professor_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_threads: {
        Row: {
          agent_id: string
          created_at: string
          empresa_id: string
          id: string
          is_archived: boolean | null
          last_message_at: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          empresa_id: string
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_threads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_threads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          empresa_id: string
          greeting_message: string | null
          id: string
          integration_config: Json | null
          integration_type: string
          is_active: boolean | null
          is_default: boolean | null
          model: string | null
          name: string
          placeholder_text: string | null
          slug: string
          supports_attachments: boolean | null
          supports_voice: boolean | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          empresa_id: string
          greeting_message?: string | null
          id?: string
          integration_config?: Json | null
          integration_type?: string
          is_active?: boolean | null
          is_default?: boolean | null
          model?: string | null
          name: string
          placeholder_text?: string | null
          slug: string
          supports_attachments?: boolean | null
          supports_voice?: boolean | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          empresa_id?: string
          greeting_message?: string | null
          id?: string
          integration_config?: Json | null
          integration_type?: string
          is_active?: boolean | null
          is_default?: boolean | null
          model?: string | null
          name?: string
          placeholder_text?: string | null
          slug?: string
          supports_attachments?: boolean | null
          supports_voice?: boolean | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos_cursos: {
        Row: {
          created_at: string | null
          curso_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          curso_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          curso_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_cursos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_cursos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos_turmas: {
        Row: {
          created_at: string | null
          data_entrada: string | null
          data_saida: string | null
          status: Database["public"]["Enums"]["enum_status_aluno_turma"] | null
          turma_id: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          data_entrada?: string | null
          data_saida?: string | null
          status?: Database["public"]["Enums"]["enum_status_aluno_turma"] | null
          turma_id: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          data_entrada?: string | null
          data_saida?: string | null
          status?: Database["public"]["Enums"]["enum_status_aluno_turma"] | null
          turma_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_turmas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          empresa_id: string | null
          expires_at: string | null
          id: string
          key: string
          last_used_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          expires_at?: string | null
          id?: string
          key: string
          last_used_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          last_used_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          empresa_id: string
          gabarito_url: string | null
          id: string
          link_externo: string | null
          modulo_id: string | null
          obrigatorio: boolean | null
          ordem_exibicao: number | null
          tipo: Database["public"]["Enums"]["enum_tipo_atividade"]
          titulo: string
          updated_at: string | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          empresa_id: string
          gabarito_url?: string | null
          id?: string
          link_externo?: string | null
          modulo_id?: string | null
          obrigatorio?: boolean | null
          ordem_exibicao?: number | null
          tipo: Database["public"]["Enums"]["enum_tipo_atividade"]
          titulo: string
          updated_at?: string | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          gabarito_url?: string | null
          id?: string
          link_externo?: string | null
          modulo_id?: string | null
          obrigatorio?: boolean | null
          ordem_exibicao?: number | null
          tipo?: Database["public"]["Enums"]["enum_tipo_atividade"]
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          created_at: string | null
          curso_id: string | null
          empresa_id: string
          id: string
          modulo_id: string | null
          nome: string
          numero_aula: number | null
          prioridade: number | null
          tempo_estimado_interval: string | null
          tempo_estimado_minutos: number | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          curso_id?: string | null
          empresa_id: string
          id?: string
          modulo_id?: string | null
          nome: string
          numero_aula?: number | null
          prioridade?: number | null
          tempo_estimado_interval?: string | null
          tempo_estimado_minutos?: number | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          curso_id?: string | null
          empresa_id?: string
          id?: string
          modulo_id?: string | null
          nome?: string
          numero_aula?: number | null
          prioridade?: number | null
          tempo_estimado_interval?: string | null
          tempo_estimado_minutos?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aulas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_aulas_modulo_id"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas_concluidas: {
        Row: {
          aula_id: string
          created_at: string | null
          curso_id: string | null
          empresa_id: string | null
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          aula_id: string
          created_at?: string | null
          curso_id?: string | null
          empresa_id?: string | null
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          aula_id?: string
          created_at?: string | null
          curso_id?: string | null
          empresa_id?: string | null
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_concluidas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_concluidas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_concluidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_concluidas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversation_history: {
        Row: {
          conversation_id: string
          created_at: string
          empresa_id: string | null
          history: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          empresa_id?: string | null
          history?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          empresa_id?: string | null
          history?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversation_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversation_history_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          is_active: boolean | null
          messages: Json | null
          session_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          is_active?: boolean | null
          messages?: Json | null
          session_id: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          is_active?: boolean | null
          messages?: Json | null
          session_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      color_palettes: {
        Row: {
          accent_color: string
          accent_foreground: string
          background_color: string
          card_color: string
          card_foreground: string
          created_at: string
          created_by: string | null
          destructive_color: string
          destructive_foreground: string
          empresa_id: string
          foreground_color: string
          id: string
          is_custom: boolean
          muted_color: string
          muted_foreground: string
          name: string
          primary_color: string
          primary_foreground: string
          secondary_color: string
          secondary_foreground: string
          sidebar_background: string
          sidebar_foreground: string
          sidebar_primary: string
          sidebar_primary_foreground: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color: string
          accent_foreground: string
          background_color: string
          card_color: string
          card_foreground: string
          created_at?: string
          created_by?: string | null
          destructive_color: string
          destructive_foreground: string
          empresa_id: string
          foreground_color: string
          id?: string
          is_custom?: boolean
          muted_color: string
          muted_foreground: string
          name: string
          primary_color: string
          primary_foreground: string
          secondary_color: string
          secondary_foreground: string
          sidebar_background: string
          sidebar_foreground: string
          sidebar_primary: string
          sidebar_primary_foreground: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          accent_foreground?: string
          background_color?: string
          card_color?: string
          card_foreground?: string
          created_at?: string
          created_by?: string | null
          destructive_color?: string
          destructive_foreground?: string
          empresa_id?: string
          foreground_color?: string
          id?: string
          is_custom?: boolean
          muted_color?: string
          muted_foreground?: string
          name?: string
          primary_color?: string
          primary_foreground?: string
          secondary_color?: string
          secondary_foreground?: string
          sidebar_background?: string
          sidebar_foreground?: string
          sidebar_primary?: string
          sidebar_primary_foreground?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "color_palettes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          empresa_id: string
          id: string
          max_uses: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          empresa_id: string
          id?: string
          max_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          empresa_id?: string
          id?: string
          max_uses?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_itens: {
        Row: {
          aula_id: string | null
          concluido: boolean | null
          created_at: string | null
          cronograma_id: string
          data_conclusao: string | null
          data_prevista: string | null
          duracao_sugerida_minutos: number | null
          frente_id: string | null
          frente_nome_snapshot: string | null
          id: string
          mensagem: string | null
          ordem_na_semana: number
          semana_numero: number
          tipo: string
        }
        Insert: {
          aula_id?: string | null
          concluido?: boolean | null
          created_at?: string | null
          cronograma_id: string
          data_conclusao?: string | null
          data_prevista?: string | null
          duracao_sugerida_minutos?: number | null
          frente_id?: string | null
          frente_nome_snapshot?: string | null
          id?: string
          mensagem?: string | null
          ordem_na_semana: number
          semana_numero: number
          tipo?: string
        }
        Update: {
          aula_id?: string | null
          concluido?: boolean | null
          created_at?: string | null
          cronograma_id?: string
          data_conclusao?: string | null
          data_prevista?: string | null
          duracao_sugerida_minutos?: number | null
          frente_id?: string | null
          frente_nome_snapshot?: string | null
          id?: string
          mensagem?: string | null
          ordem_na_semana?: number
          semana_numero?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_itens_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cronograma_itens_aula_id"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cronograma_itens_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_semanas_dias: {
        Row: {
          created_at: string | null
          cronograma_id: string
          dias_semana: number[]
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cronograma_id: string
          dias_semana?: number[]
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cronograma_id?: string
          dias_semana?: number[]
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_semanas_dias_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: true
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_tempo_estudos: {
        Row: {
          created_at: string | null
          cronograma_id: string
          data: string
          data_conclusao: string | null
          disciplina_id: string
          frente_id: string
          id: string
          tempo_estudos_concluido: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cronograma_id: string
          data: string
          data_conclusao?: string | null
          disciplina_id: string
          frente_id: string
          id?: string
          tempo_estudos_concluido?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cronograma_id?: string
          data?: string
          data_conclusao?: string | null
          disciplina_id?: string
          frente_id?: string
          id?: string
          tempo_estudos_concluido?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_tempo_estudos_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cronograma_tempo_estudos_disciplina_id"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cronograma_tempo_estudos_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
        ]
      }
      cronogramas: {
        Row: {
          created_at: string | null
          curso_alvo_id: string | null
          data_fim: string
          data_inicio: string
          dias_estudo_semana: number
          disciplinas_selecionadas: Json
          empresa_id: string
          excluir_aulas_concluidas: boolean
          horas_estudo_dia: number
          id: string
          modalidade_estudo: string
          modulos_selecionados: Json | null
          nome: string | null
          ordem_frentes_preferencia: Json | null
          periodos_ferias: Json | null
          prioridade_minima: number
          updated_at: string | null
          usuario_id: string
          velocidade_reproducao: number | null
        }
        Insert: {
          created_at?: string | null
          curso_alvo_id?: string | null
          data_fim: string
          data_inicio: string
          dias_estudo_semana: number
          disciplinas_selecionadas?: Json
          empresa_id: string
          excluir_aulas_concluidas?: boolean
          horas_estudo_dia: number
          id?: string
          modalidade_estudo: string
          modulos_selecionados?: Json | null
          nome?: string | null
          ordem_frentes_preferencia?: Json | null
          periodos_ferias?: Json | null
          prioridade_minima?: number
          updated_at?: string | null
          usuario_id: string
          velocidade_reproducao?: number | null
        }
        Update: {
          created_at?: string | null
          curso_alvo_id?: string | null
          data_fim?: string
          data_inicio?: string
          dias_estudo_semana?: number
          disciplinas_selecionadas?: Json
          empresa_id?: string
          excluir_aulas_concluidas?: boolean
          horas_estudo_dia?: number
          id?: string
          modalidade_estudo?: string
          modulos_selecionados?: Json | null
          nome?: string | null
          ordem_frentes_preferencia?: Json | null
          periodos_ferias?: Json | null
          prioridade_minima?: number
          updated_at?: string | null
          usuario_id?: string
          velocidade_reproducao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cronogramas_curso_alvo_id_fkey"
            columns: ["curso_alvo_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronogramas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_modulos: {
        Row: {
          created_at: string
          created_by: string | null
          curso_id: string
          empresa_id: string
          id: string
          module_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curso_id: string
          empresa_id: string
          id?: string
          module_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curso_id?: string
          empresa_id?: string
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curso_modulos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_modulos_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_plantao_quotas: {
        Row: {
          created_at: string
          created_by: string | null
          curso_id: string
          empresa_id: string
          id: string
          quota_mensal: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curso_id: string
          empresa_id: string
          id?: string
          quota_mensal?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curso_id?: string
          empresa_id?: string
          id?: string
          quota_mensal?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curso_plantao_quotas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_plantao_quotas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: true
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_plantao_quotas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curso_plantao_quotas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          ano_vigencia: number
          created_at: string
          created_by: string | null
          data_inicio: string | null
          data_termino: string | null
          descricao: string | null
          disciplina_id: string | null
          empresa_id: string
          id: string
          imagem_capa_url: string | null
          meses_acesso: number | null
          modalidade: Database["public"]["Enums"]["enum_modalidade"]
          modalidade_id: string | null
          nome: string
          planejamento_url: string | null
          segmento_id: string | null
          tipo: Database["public"]["Enums"]["enum_tipo_curso"]
          updated_at: string
          usa_turmas: boolean
        }
        Insert: {
          ano_vigencia: number
          created_at?: string
          created_by?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          descricao?: string | null
          disciplina_id?: string | null
          empresa_id: string
          id?: string
          imagem_capa_url?: string | null
          meses_acesso?: number | null
          modalidade: Database["public"]["Enums"]["enum_modalidade"]
          modalidade_id?: string | null
          nome: string
          planejamento_url?: string | null
          segmento_id?: string | null
          tipo: Database["public"]["Enums"]["enum_tipo_curso"]
          updated_at?: string
          usa_turmas?: boolean
        }
        Update: {
          ano_vigencia?: number
          created_at?: string
          created_by?: string | null
          data_inicio?: string | null
          data_termino?: string | null
          descricao?: string | null
          disciplina_id?: string | null
          empresa_id?: string
          id?: string
          imagem_capa_url?: string | null
          meses_acesso?: number | null
          modalidade?: Database["public"]["Enums"]["enum_modalidade"]
          modalidade_id?: string | null
          nome?: string
          planejamento_url?: string | null
          segmento_id?: string | null
          tipo?: Database["public"]["Enums"]["enum_tipo_curso"]
          updated_at?: string
          usa_turmas?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cursos_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_modalidade_id_fkey"
            columns: ["modalidade_id"]
            isOneToOne: false
            referencedRelation: "modalidades_curso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos_disciplinas: {
        Row: {
          created_at: string | null
          curso_id: string
          disciplina_id: string
        }
        Insert: {
          created_at?: string | null
          curso_id: string
          disciplina_id: string
        }
        Update: {
          created_at?: string | null
          curso_id?: string
          disciplina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_disciplinas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos_hotmart_products: {
        Row: {
          created_at: string
          curso_id: string
          empresa_id: string
          hotmart_product_id: string
          id: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          empresa_id: string
          hotmart_product_id: string
          id?: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          empresa_id?: string
          hotmart_product_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_hotmart_products_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_hotmart_products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_theme_presets: {
        Row: {
          color_palette_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          font_scheme_id: string | null
          id: string
          is_default: boolean | null
          mode: string | null
          name: string
          preview_colors: Json | null
          radius: number | null
          scale: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_palette_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          font_scheme_id?: string | null
          id?: string
          is_default?: boolean | null
          mode?: string | null
          name: string
          preview_colors?: Json | null
          radius?: number | null
          scale?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_palette_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          font_scheme_id?: string | null
          id?: string
          is_default?: boolean | null
          mode?: string | null
          name?: string
          preview_colors?: Json | null
          radius?: number | null
          scale?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_theme_presets_color_palette_id_fkey"
            columns: ["color_palette_id"]
            isOneToOne: false
            referencedRelation: "color_palettes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_theme_presets_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_theme_presets_font_scheme_id_fkey"
            columns: ["font_scheme_id"]
            isOneToOne: false
            referencedRelation: "font_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_oauth_credentials: {
        Row: {
          access_token_encrypted: string | null
          active: boolean
          client_id: string
          client_secret_encrypted: string
          configured_by: string | null
          created_at: string
          empresa_id: string
          extra_config: Json | null
          id: string
          provider: string
          refresh_token_encrypted: string | null
          token_expiry: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          active?: boolean
          client_id: string
          client_secret_encrypted: string
          configured_by?: string | null
          created_at?: string
          empresa_id: string
          extra_config?: Json | null
          id?: string
          provider: string
          refresh_token_encrypted?: string | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          active?: boolean
          client_id?: string
          client_secret_encrypted?: string
          configured_by?: string | null
          created_at?: string
          empresa_id?: string
          extra_config?: Json | null
          id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          token_expiry?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_oauth_credentials_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          configuracoes: Json | null
          created_at: string
          dominio_customizado: string | null
          email_contato: string | null
          id: string
          logo_url: string | null
          nome: string
          plano: Database["public"]["Enums"]["enum_plano_empresa"]
          slug: string
          storage_quota_mb: number | null
          storage_used_mb: number | null
          stripe_customer_id: string | null
          subdomain: string | null
          subscription_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          configuracoes?: Json | null
          created_at?: string
          dominio_customizado?: string | null
          email_contato?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          plano?: Database["public"]["Enums"]["enum_plano_empresa"]
          slug: string
          storage_quota_mb?: number | null
          storage_used_mb?: number | null
          stripe_customer_id?: string | null
          subdomain?: string | null
          subscription_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          configuracoes?: Json | null
          created_at?: string
          dominio_customizado?: string | null
          email_contato?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          plano?: Database["public"]["Enums"]["enum_plano_empresa"]
          slug?: string
          storage_quota_mb?: number | null
          storage_used_mb?: number | null
          stripe_customer_id?: string | null
          subdomain?: string | null
          subscription_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          modulo_id: string | null
          pergunta: string
          pergunta_imagem_path: string | null
          resposta: string
          resposta_imagem_path: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          modulo_id?: string | null
          pergunta: string
          pergunta_imagem_path?: string | null
          resposta: string
          resposta_imagem_path?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          modulo_id?: string | null
          pergunta?: string
          pergunta_imagem_path?: string | null
          resposta?: string
          resposta_imagem_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      font_schemes: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          font_mono: Json
          font_sans: Json
          font_sizes: Json
          font_weights: Json
          google_fonts: Json | null
          id: string
          is_custom: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          font_mono?: Json
          font_sans?: Json
          font_sizes?: Json
          font_weights?: Json
          google_fonts?: Json | null
          id?: string
          is_custom?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          font_mono?: Json
          font_sans?: Json
          font_sizes?: Json
          font_weights?: Json
          google_fonts?: Json | null
          id?: string
          is_custom?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "font_schemes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      frentes: {
        Row: {
          created_at: string | null
          created_by: string | null
          curso_id: string | null
          disciplina_id: string | null
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          curso_id?: string | null
          disciplina_id?: string | null
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          curso_id?: string | null
          disciplina_id?: string | null
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "frentes_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frentes_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_curso: {
        Row: {
          arquivo_url: string
          created_at: string
          created_by: string | null
          curso_id: string | null
          descricao_opcional: string | null
          empresa_id: string
          id: string
          ordem: number
          tipo: Database["public"]["Enums"]["enum_tipo_material"]
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          created_by?: string | null
          curso_id?: string | null
          descricao_opcional?: string | null
          empresa_id: string
          id?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["enum_tipo_material"]
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          created_by?: string | null
          curso_id?: string | null
          descricao_opcional?: string | null
          empresa_id?: string
          id?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["enum_tipo_material"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_curso_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_curso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          ativo: boolean
          created_at: string
          curso_id: string | null
          data_fim_acesso: string
          data_inicio_acesso: string
          data_matricula: string
          empresa_id: string | null
          id: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          curso_id?: string | null
          data_fim_acesso: string
          data_inicio_acesso?: string
          data_matricula?: string
          empresa_id?: string | null
          id?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          curso_id?: string | null
          data_fim_acesso?: string
          data_inicio_acesso?: string
          data_matricula?: string
          empresa_id?: string | null
          id?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      modalidades_curso: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modalidades_curso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      module_definitions: {
        Row: {
          created_at: string
          default_url: string
          default_visible: boolean
          description: string | null
          display_order: number
          icon_name: string
          id: string
          is_core: boolean
          name: string
        }
        Insert: {
          created_at?: string
          default_url: string
          default_visible?: boolean
          description?: string | null
          display_order?: number
          icon_name: string
          id: string
          is_core?: boolean
          name: string
        }
        Update: {
          created_at?: string
          default_url?: string
          default_visible?: boolean
          description?: string | null
          display_order?: number
          icon_name?: string
          id?: string
          is_core?: boolean
          name?: string
        }
        Relationships: []
      }
      modulos: {
        Row: {
          created_at: string | null
          curso_id: string | null
          empresa_id: string
          frente_id: string | null
          id: string
          importancia:
            | Database["public"]["Enums"]["enum_importancia_modulo"]
            | null
          nome: string
          numero_modulo: number | null
        }
        Insert: {
          created_at?: string | null
          curso_id?: string | null
          empresa_id: string
          frente_id?: string | null
          id?: string
          importancia?:
            | Database["public"]["Enums"]["enum_importancia_modulo"]
            | null
          nome: string
          numero_modulo?: number | null
        }
        Update: {
          created_at?: string | null
          curso_id?: string | null
          empresa_id?: string
          frente_id?: string | null
          id?: string
          importancia?:
            | Database["public"]["Enums"]["enum_importancia_modulo"]
            | null
          nome?: string
          numero_modulo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_modulos_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      papeis: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          is_system: boolean
          nome: string
          permissoes: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          is_system?: boolean
          nome: string
          permissoes?: Json
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          permissoes?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "papeis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          active: boolean
          created_at: string
          credentials: Json | null
          empresa_id: string
          id: string
          name: string
          provider: string
          provider_account_id: string | null
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          credentials?: Json | null
          empresa_id: string
          id?: string
          name: string
          provider: string
          provider_account_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          credentials?: Json | null
          empresa_id?: string
          id?: string
          name?: string
          provider?: string
          provider_account_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_providers_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantao_uso_mensal: {
        Row: {
          ano_mes: string
          created_at: string
          empresa_id: string
          id: string
          updated_at: string
          uso_count: number
          usuario_id: string
        }
        Insert: {
          ano_mes: string
          created_at?: string
          empresa_id: string
          id?: string
          updated_at?: string
          uso_count?: number
          usuario_id: string
        }
        Update: {
          ano_mes?: string
          created_at?: string
          empresa_id?: string
          id?: string
          updated_at?: string
          uso_count?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantao_uso_mensal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantao_uso_mensal_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          curso_id: string | null
          description: string | null
          empresa_id: string
          id: string
          metadata: Json | null
          name: string
          price_cents: number
          provider: string
          provider_offer_id: string | null
          provider_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          curso_id?: string | null
          description?: string | null
          empresa_id: string
          id?: string
          metadata?: Json | null
          name: string
          price_cents: number
          provider?: string
          provider_offer_id?: string | null
          provider_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          curso_id?: string | null
          description?: string | null
          empresa_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          price_cents?: number
          provider?: string
          provider_offer_id?: string | null
          provider_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      progresso_atividades: {
        Row: {
          anotacoes_pessoais: string | null
          atividade_id: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          dificuldade_percebida:
            | Database["public"]["Enums"]["enum_dificuldade_percebida"]
            | null
          empresa_id: string | null
          id: string
          questoes_acertos: number | null
          questoes_totais: number | null
          status: Database["public"]["Enums"]["enum_status_atividade"] | null
          updated_at: string | null
          usuario_id: string | null
        }
        Insert: {
          anotacoes_pessoais?: string | null
          atividade_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          dificuldade_percebida?:
            | Database["public"]["Enums"]["enum_dificuldade_percebida"]
            | null
          empresa_id?: string | null
          id?: string
          questoes_acertos?: number | null
          questoes_totais?: number | null
          status?: Database["public"]["Enums"]["enum_status_atividade"] | null
          updated_at?: string | null
          usuario_id?: string | null
        }
        Update: {
          anotacoes_pessoais?: string | null
          atividade_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          dificuldade_percebida?:
            | Database["public"]["Enums"]["enum_dificuldade_percebida"]
            | null
          empresa_id?: string | null
          id?: string
          questoes_acertos?: number | null
          questoes_totais?: number | null
          status?: Database["public"]["Enums"]["enum_status_atividade"] | null
          updated_at?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progresso_atividades_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_atividades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      progresso_flashcards: {
        Row: {
          created_at: string | null
          data_proxima_revisao: string | null
          dias_intervalo: number | null
          empresa_id: string
          flashcard_id: string | null
          id: string
          nivel_facilidade: number | null
          numero_revisoes: number | null
          ultimo_feedback: number | null
          updated_at: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_proxima_revisao?: string | null
          dias_intervalo?: number | null
          empresa_id: string
          flashcard_id?: string | null
          id?: string
          nivel_facilidade?: number | null
          numero_revisoes?: number | null
          ultimo_feedback?: number | null
          updated_at?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_proxima_revisao?: string | null
          dias_intervalo?: number | null
          empresa_id?: string
          flashcard_id?: string | null
          id?: string
          nivel_facilidade?: number | null
          numero_revisoes?: number | null
          ultimo_feedback?: number | null
          updated_at?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progresso_flashcards_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_flashcards_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_flashcards_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_atividades: {
        Row: {
          acumulativo: boolean | null
          acumulativo_desde_inicio: boolean | null
          comecar_no_modulo: number | null
          created_at: string | null
          curso_id: string | null
          empresa_id: string
          frequencia_modulos: number | null
          gerar_no_ultimo: boolean | null
          id: string
          nome_padrao: string
          tipo_atividade: Database["public"]["Enums"]["enum_tipo_atividade"]
          updated_at: string | null
        }
        Insert: {
          acumulativo?: boolean | null
          acumulativo_desde_inicio?: boolean | null
          comecar_no_modulo?: number | null
          created_at?: string | null
          curso_id?: string | null
          empresa_id: string
          frequencia_modulos?: number | null
          gerar_no_ultimo?: boolean | null
          id?: string
          nome_padrao: string
          tipo_atividade: Database["public"]["Enums"]["enum_tipo_atividade"]
          updated_at?: string | null
        }
        Update: {
          acumulativo?: boolean | null
          acumulativo_desde_inicio?: boolean | null
          comecar_no_modulo?: number | null
          created_at?: string | null
          curso_id?: string | null
          empresa_id?: string
          frequencia_modulos?: number | null
          gerar_no_ultimo?: boolean | null
          id?: string
          nome_padrao?: string
          tipo_atividade?: Database["public"]["Enums"]["enum_tipo_atividade"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_atividades_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      segmentos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "segmentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_estudo: {
        Row: {
          atividade_relacionada_id: string | null
          created_at: string | null
          disciplina_id: string | null
          empresa_id: string | null
          fim: string | null
          frente_id: string | null
          id: string
          inicio: string | null
          log_pausas: Json | null
          metodo_estudo: string | null
          modulo_id: string | null
          nivel_foco: number | null
          status: string | null
          tempo_total_bruto_segundos: number | null
          tempo_total_liquido_segundos: number | null
          updated_at: string | null
          usuario_id: string | null
        }
        Insert: {
          atividade_relacionada_id?: string | null
          created_at?: string | null
          disciplina_id?: string | null
          empresa_id?: string | null
          fim?: string | null
          frente_id?: string | null
          id?: string
          inicio?: string | null
          log_pausas?: Json | null
          metodo_estudo?: string | null
          modulo_id?: string | null
          nivel_foco?: number | null
          status?: string | null
          tempo_total_bruto_segundos?: number | null
          tempo_total_liquido_segundos?: number | null
          updated_at?: string | null
          usuario_id?: string | null
        }
        Update: {
          atividade_relacionada_id?: string | null
          created_at?: string | null
          disciplina_id?: string | null
          empresa_id?: string | null
          fim?: string | null
          frente_id?: string | null
          id?: string
          inicio?: string | null
          log_pausas?: Json | null
          metodo_estudo?: string | null
          modulo_id?: string | null
          nivel_foco?: number | null
          status?: string | null
          tempo_total_bruto_segundos?: number | null
          tempo_total_liquido_segundos?: number | null
          updated_at?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sessoes_estudo_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sessoes_estudo_modulo_id"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_estudo_atividade_relacionada_id_fkey"
            columns: ["atividade_relacionada_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_estudo_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_estudo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_estudo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      submodule_definitions: {
        Row: {
          created_at: string
          default_url: string
          display_order: number
          id: string
          module_id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_url: string
          display_order?: number
          id: string
          module_id: string
          name: string
        }
        Update: {
          created_at?: string
          default_url?: string
          display_order?: number
          id?: string
          module_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "submodule_definitions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          allowed_modules: Json | null
          badge_text: string | null
          created_at: string
          currency: string
          description: string | null
          display_order: number
          extra_student_price_cents: number | null
          features: Json
          id: string
          is_featured: boolean
          max_active_students: number | null
          max_courses: number | null
          max_storage_mb: number | null
          name: string
          price_monthly_cents: number
          price_yearly_cents: number | null
          slug: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_modules?: Json | null
          badge_text?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          extra_student_price_cents?: number | null
          features?: Json
          id?: string
          is_featured?: boolean
          max_active_students?: number | null
          max_courses?: number | null
          max_storage_mb?: number | null
          name: string
          price_monthly_cents: number
          price_yearly_cents?: number | null
          slug: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_modules?: Json | null
          badge_text?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          extra_student_price_cents?: number | null
          features?: Json
          id?: string
          is_featured?: boolean
          max_active_students?: number | null
          max_courses?: number | null
          max_storage_mb?: number | null
          name?: string
          price_monthly_cents?: number
          price_yearly_cents?: number | null
          slug?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          empresa_id: string
          id: string
          last_payment_amount_cents: number | null
          last_payment_date: string | null
          metadata: Json | null
          next_payment_date: string | null
          plan_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_interval: string
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id: string
          id?: string
          last_payment_amount_cents?: number | null
          last_payment_date?: string | null
          metadata?: Json | null
          next_payment_date?: string | null
          plan_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id?: string
          id?: string
          last_payment_amount_cents?: number | null
          last_payment_date?: string | null
          metadata?: Json | null
          next_payment_date?: string | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          active: boolean
          auth_user_id: string
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_access_log: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          metadata: Json | null
          operation: string
          row_count: number | null
          table_name: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          metadata?: Json | null
          operation: string
          row_count?: number | null
          table_name: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          metadata?: Json | null
          operation?: string
          row_count?: number | null
          table_name?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_access_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          color_palette_id: string | null
          created_at: string
          created_by: string | null
          custom_css: string | null
          empresa_id: string
          font_scheme_id: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_palette_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_css?: string | null
          empresa_id: string
          font_scheme_id?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_palette_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_css?: string | null
          empresa_id?: string
          font_scheme_id?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_color_palette_id_fkey"
            columns: ["color_palette_id"]
            isOneToOne: false
            referencedRelation: "color_palettes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_branding_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_branding_font_scheme_id_fkey"
            columns: ["font_scheme_id"]
            isOneToOne: false
            referencedRelation: "font_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_logos: {
        Row: {
          created_at: string
          empresa_id: string | null
          file_name: string | null
          file_size: number | null
          id: string
          logo_type: Database["public"]["Enums"]["enum_logo_type"]
          logo_url: string
          mime_type: string | null
          tenant_branding_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          logo_type: Database["public"]["Enums"]["enum_logo_type"]
          logo_url: string
          mime_type?: string | null
          tenant_branding_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          logo_type?: Database["public"]["Enums"]["enum_logo_type"]
          logo_url?: string
          mime_type?: string | null
          tenant_branding_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_logos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_logos_tenant_branding_id_fkey"
            columns: ["tenant_branding_id"]
            isOneToOne: false
            referencedRelation: "tenant_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_module_visibility: {
        Row: {
          created_at: string
          created_by: string | null
          custom_name: string | null
          custom_url: string | null
          display_order: number | null
          empresa_id: string
          id: string
          is_visible: boolean
          module_id: string
          options: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_name?: string | null
          custom_url?: string | null
          display_order?: number | null
          empresa_id: string
          id?: string
          is_visible?: boolean
          module_id: string
          options?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_name?: string | null
          custom_url?: string | null
          display_order?: number | null
          empresa_id?: string
          id?: string
          is_visible?: boolean
          module_id?: string
          options?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_visibility_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_module_visibility_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_submodule_visibility: {
        Row: {
          created_at: string
          created_by: string | null
          custom_name: string | null
          custom_url: string | null
          display_order: number | null
          empresa_id: string
          id: string
          is_visible: boolean
          module_id: string
          submodule_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_name?: string | null
          custom_url?: string | null
          display_order?: number | null
          empresa_id: string
          id?: string
          is_visible?: boolean
          module_id: string
          submodule_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_name?: string | null
          custom_url?: string | null
          display_order?: number | null
          empresa_id?: string
          id?: string
          is_visible?: boolean
          module_id?: string
          submodule_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_submodule_visibility_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_submodule_visibility_module_id_submodule_id_fkey"
            columns: ["module_id", "submodule_id"]
            isOneToOne: false
            referencedRelation: "submodule_definitions"
            referencedColumns: ["module_id", "id"]
          },
        ]
      }
      termos_aceite: {
        Row: {
          accepted_at: string
          empresa_id: string
          id: string
          ip_address: unknown
          tipo_documento: string
          user_agent: string | null
          usuario_id: string
          versao: string
        }
        Insert: {
          accepted_at?: string
          empresa_id: string
          id?: string
          ip_address?: unknown
          tipo_documento: string
          user_agent?: string | null
          usuario_id: string
          versao: string
        }
        Update: {
          accepted_at?: string
          empresa_id?: string
          id?: string
          ip_address?: unknown
          tipo_documento?: string
          user_agent?: string | null
          usuario_id?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_aceite_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          buyer_document: string | null
          buyer_email: string
          buyer_name: string | null
          confirmation_date: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          empresa_id: string
          id: string
          installments: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          product_id: string | null
          provider: string
          provider_data: Json | null
          provider_transaction_id: string | null
          refund_amount_cents: number | null
          refund_date: string | null
          sale_date: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          amount_cents: number
          buyer_document?: string | null
          buyer_email: string
          buyer_name?: string | null
          confirmation_date?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          empresa_id: string
          id?: string
          installments?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          product_id?: string | null
          provider?: string
          provider_data?: Json | null
          provider_transaction_id?: string | null
          refund_amount_cents?: number | null
          refund_date?: string | null
          sale_date?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_document?: string | null
          buyer_email?: string
          buyer_name?: string | null
          confirmation_date?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          empresa_id?: string
          id?: string
          installments?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          product_id?: string | null
          provider?: string
          provider_data?: Json | null
          provider_transaction_id?: string | null
          refund_amount_cents?: number | null
          refund_date?: string | null
          sale_date?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          acesso_apos_termino: boolean | null
          ativo: boolean | null
          created_at: string | null
          curso_id: string
          data_fim: string | null
          data_inicio: string | null
          dias_acesso_extra: number | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          acesso_apos_termino?: boolean | null
          ativo?: boolean | null
          created_at?: string | null
          curso_id: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_acesso_extra?: number | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          acesso_apos_termino?: boolean | null
          ativo?: boolean | null
          created_at?: string | null
          curso_id?: string
          data_fim?: string | null
          data_inicio?: string | null
          dias_acesso_extra?: number | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          bairro: string | null
          biografia: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string
          empresa_id: string
          endereco: string | null
          especialidade: string | null
          estado: string | null
          foto_url: string | null
          hotmart_id: string | null
          id: string
          instagram: string | null
          must_change_password: boolean
          nome_completo: string
          numero_endereco: string | null
          numero_matricula: string | null
          origem_cadastro: string | null
          pais: string | null
          papel_id: string | null
          quota_extra: number | null
          senha_temporaria: string | null
          telefone: string | null
          twitter: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          biografia?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email: string
          empresa_id: string
          endereco?: string | null
          especialidade?: string | null
          estado?: string | null
          foto_url?: string | null
          hotmart_id?: string | null
          id: string
          instagram?: string | null
          must_change_password?: boolean
          nome_completo: string
          numero_endereco?: string | null
          numero_matricula?: string | null
          origem_cadastro?: string | null
          pais?: string | null
          papel_id?: string | null
          quota_extra?: number | null
          senha_temporaria?: string | null
          telefone?: string | null
          twitter?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          biografia?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string
          empresa_id?: string
          endereco?: string | null
          especialidade?: string | null
          estado?: string | null
          foto_url?: string | null
          hotmart_id?: string | null
          id?: string
          instagram?: string | null
          must_change_password?: boolean
          nome_completo?: string
          numero_endereco?: string | null
          numero_matricula?: string | null
          origem_cadastro?: string | null
          pais?: string | null
          papel_id?: string | null
          quota_extra?: number | null
          senha_temporaria?: string | null
          telefone?: string | null
          twitter?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_papel_id_fkey"
            columns: ["papel_id"]
            isOneToOne: false
            referencedRelation: "papeis"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_disciplinas: {
        Row: {
          ativo: boolean
          created_at: string
          curso_id: string | null
          disciplina_id: string
          empresa_id: string
          frente_id: string | null
          id: string
          modulo_id: string | null
          turma_id: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          curso_id?: string | null
          disciplina_id: string
          empresa_id: string
          frente_id?: string | null
          id?: string
          modulo_id?: string | null
          turma_id?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          curso_id?: string | null
          disciplina_id?: string
          empresa_id?: string
          frente_id?: string | null
          id?: string
          modulo_id?: string | null
          turma_id?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_disciplinas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_disciplinas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_disciplinas_frente_id_fkey"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_disciplinas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_disciplinas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_disciplinas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_empresas: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          empresa_id: string
          id: string
          is_admin: boolean
          is_owner: boolean
          papel_base: Database["public"]["Enums"]["enum_papel_base"]
          papel_id: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          is_admin?: boolean
          is_owner?: boolean
          papel_base: Database["public"]["Enums"]["enum_papel_base"]
          papel_id?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          is_admin?: boolean
          is_owner?: boolean
          papel_base?: Database["public"]["Enums"]["enum_papel_base"]
          papel_id?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_empresas_papel_id_fkey"
            columns: ["papel_id"]
            isOneToOne: false
            referencedRelation: "papeis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_empresas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          processing_error: string | null
          processing_time_ms: number | null
          status: string
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          processing_time_ms?: number | null
          status?: string
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          processing_time_ms?: number | null
          status?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_index_usage_analysis: {
        Row: {
          idx_scan: number | null
          idx_tup_fetch: number | null
          idx_tup_read: number | null
          index_comment: string | null
          index_definition: string | null
          index_name: unknown
          index_size: string | null
          index_size_bytes: number | null
          schemaname: unknown
          should_keep: boolean | null
          table_name: unknown
          usage_category: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aluno_em_turma: { Args: { p_turma_id: string }; Returns: boolean }
      aluno_matriculado_empresa: {
        Args: { empresa_id_param: string }
        Returns: boolean
      }
      calcular_taxa_comparecimento: {
        Args: {
          data_fim_param: string
          data_inicio_param: string
          professor_id_param: string
        }
        Returns: number
      }
      calcular_taxa_ocupacao: {
        Args: {
          data_fim_param: string
          data_inicio_param: string
          empresa_id_param: string
        }
        Returns: number
      }
      cleanup_tenant_access_log: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      create_bloqueio_and_cancel_conflicts: {
        Args: {
          p_criado_por: string
          p_data_fim: string
          p_data_inicio: string
          p_empresa_id: string
          p_motivo: string
          p_professor_id: string
          p_tipo: Database["public"]["Enums"]["enum_tipo_bloqueio"]
        }
        Returns: string
      }
      decrement_plantao_usage: {
        Args: { p_ano_mes?: string; p_empresa_id: string; p_usuario_id: string }
        Returns: undefined
      }
      gerar_atividades_personalizadas: {
        Args: { p_curso_id: string; p_frente_id: string }
        Returns: undefined
      }
      get_aluno_empresa_id: { Args: never; Returns: string }
      get_aluno_empresas: {
        Args: never
        Returns: {
          empresa_id: string
        }[]
      }
      get_auth_user_empresa_id: { Args: never; Returns: string }
      get_auth_user_id_by_email: { Args: { email: string }; Returns: string }
      get_matriculas_aluno: {
        Args: { p_aluno_id: string }
        Returns: {
          curso_id: string
        }[]
      }
      get_oauth_credentials: {
        Args: {
          p_empresa_id: string
          p_encryption_key: string
          p_provider: string
        }
        Returns: {
          access_token: string
          client_id: string
          client_secret: string
          credential_id: string
          refresh_token: string
          token_expiry: string
        }[]
      }
      get_professor_disciplinas: { Args: never; Returns: string[] }
      get_student_ids_by_empresa_courses: {
        Args: { empresa_id_param: string }
        Returns: {
          aluno_id: string
        }[]
      }
      get_student_plantao_quota: {
        Args: { p_empresa_id: string; p_usuario_id: string }
        Returns: number
      }
      get_student_plantao_usage: {
        Args: { p_ano_mes?: string; p_empresa_id: string; p_usuario_id: string }
        Returns: number
      }
      get_user_context: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["user_context_type"]
        SetofOptions: {
          from: "*"
          to: "user_context_type"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_empresa_id: { Args: never; Returns: string }
      get_user_empresa_ids: { Args: never; Returns: string[] }
      importar_cronograma_aulas: {
        Args: {
          p_conteudo: Json
          p_curso_id: string
          p_disciplina_nome: string
          p_frente_nome: string
        }
        Returns: {
          aulas_importadas: number
          modulos_importados: number
        }[]
      }
      increment_plantao_usage: {
        Args: { p_ano_mes?: string; p_empresa_id: string; p_usuario_id: string }
        Returns: undefined
      }
      is_aluno: { Args: never; Returns: boolean }
      is_empresa_admin:
        | { Args: never; Returns: boolean }
        | {
            Args: { empresa_id_param: string; user_id_param: string }
            Returns: boolean
          }
      is_empresa_gestor: { Args: never; Returns: boolean }
      is_empresa_owner: { Args: { empresa_id_param: string }; Returns: boolean }
      is_professor: { Args: never; Returns: boolean }
      is_professor_da_disciplina: {
        Args: { p_disciplina_id: string }
        Returns: boolean
      }
      is_teaching_user:
        | { Args: never; Returns: boolean }
        | { Args: { user_id_param: string }; Returns: boolean }
      listar_horarios_vagos: {
        Args: {
          data_fim_param: string
          data_inicio_param: string
          empresa_id_param: string
        }
        Returns: {
          data: string
          hora_fim: string
          hora_inicio: string
          professor_id: string
          professor_nome: string
        }[]
      }
      log_tenant_access: {
        Args: {
          p_metadata?: Json
          p_operation: string
          p_row_count?: number
          p_table_name: string
        }
        Returns: undefined
      }
      professor_tem_acesso_frente: {
        Args: { p_frente_id: string }
        Returns: boolean
      }
      professor_tem_acesso_modulo: {
        Args: { p_modulo_id: string }
        Returns: boolean
      }
      save_oauth_tokens: {
        Args: {
          p_access_token: string
          p_empresa_id: string
          p_encryption_key: string
          p_provider: string
          p_refresh_token: string
          p_token_expiry?: string
        }
        Returns: boolean
      }
      upsert_oauth_credential:
        | {
            Args: {
              p_client_id: string
              p_client_secret: string
              p_configured_by?: string
              p_empresa_id: string
              p_encryption_key: string
              p_provider: string
            }
            Returns: string
          }
        | {
            Args: {
              p_access_token?: string
              p_client_id: string
              p_client_secret: string
              p_configured_by?: string
              p_empresa_id: string
              p_encryption_key: string
              p_provider: string
              p_refresh_token?: string
              p_token_expiry?: string
            }
            Returns: string
          }
      user_belongs_to_empresa: {
        Args: { empresa_id_param: string }
        Returns: boolean
      }
      validate_user_tenant_access: {
        Args: { tenant_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      discount_type: "percentage" | "fixed"
      enum_dificuldade_percebida:
        | "Muito Facil"
        | "Facil"
        | "Medio"
        | "Dificil"
        | "Muito Dificil"
      enum_importancia_modulo: "Alta" | "Media" | "Baixa" | "Base"
      enum_logo_type: "login" | "sidebar" | "favicon"
      enum_modalidade: "EAD" | "LIVE"
      enum_papel_base: "aluno" | "professor" | "usuario"
      enum_plano_empresa: "basico" | "profissional" | "enterprise"
      enum_status_aluno_turma: "ativo" | "concluido" | "cancelado" | "trancado"
      enum_status_atividade: "Pendente" | "Iniciado" | "Concluido"
      enum_tipo_atividade:
        | "Nivel_1"
        | "Nivel_2"
        | "Nivel_3"
        | "Nivel_4"
        | "Conceituario"
        | "Lista_Mista"
        | "Simulado_Diagnostico"
        | "Simulado_Cumulativo"
        | "Simulado_Global"
        | "Flashcards"
        | "Revisao"
      enum_tipo_bloqueio: "feriado" | "recesso" | "imprevisto" | "outro"
      enum_tipo_curso:
        | "Superextensivo"
        | "Extensivo"
        | "Intensivo"
        | "Superintensivo"
        | "Revisão"
      enum_tipo_material:
        | "Apostila"
        | "Lista de Exercícios"
        | "Planejamento"
        | "Resumo"
        | "Gabarito"
        | "Outros"
      enum_tipo_relatorio: "mensal" | "semanal" | "customizado"
      enum_tipo_servico_agendamento: "plantao" | "mentoria"
      payment_method:
        | "credit_card"
        | "debit_card"
        | "pix"
        | "boleto"
        | "bank_transfer"
        | "other"
      transaction_status:
        | "pending"
        | "approved"
        | "cancelled"
        | "refunded"
        | "disputed"
        | "chargeback"
    }
    CompositeTypes: {
      user_context_type: {
        user_id: string | null
        empresa_id: string | null
        is_admin: boolean | null
        is_professor: boolean | null
        is_aluno: boolean | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      discount_type: ["percentage", "fixed"],
      enum_dificuldade_percebida: [
        "Muito Facil",
        "Facil",
        "Medio",
        "Dificil",
        "Muito Dificil",
      ],
      enum_importancia_modulo: ["Alta", "Media", "Baixa", "Base"],
      enum_logo_type: ["login", "sidebar", "favicon"],
      enum_modalidade: ["EAD", "LIVE"],
      enum_papel_base: ["aluno", "professor", "usuario"],
      enum_plano_empresa: ["basico", "profissional", "enterprise"],
      enum_status_aluno_turma: ["ativo", "concluido", "cancelado", "trancado"],
      enum_status_atividade: ["Pendente", "Iniciado", "Concluido"],
      enum_tipo_atividade: [
        "Nivel_1",
        "Nivel_2",
        "Nivel_3",
        "Nivel_4",
        "Conceituario",
        "Lista_Mista",
        "Simulado_Diagnostico",
        "Simulado_Cumulativo",
        "Simulado_Global",
        "Flashcards",
        "Revisao",
      ],
      enum_tipo_bloqueio: ["feriado", "recesso", "imprevisto", "outro"],
      enum_tipo_curso: [
        "Superextensivo",
        "Extensivo",
        "Intensivo",
        "Superintensivo",
        "Revisão",
      ],
      enum_tipo_material: [
        "Apostila",
        "Lista de Exercícios",
        "Planejamento",
        "Resumo",
        "Gabarito",
        "Outros",
      ],
      enum_tipo_relatorio: ["mensal", "semanal", "customizado"],
      enum_tipo_servico_agendamento: ["plantao", "mentoria"],
      payment_method: [
        "credit_card",
        "debit_card",
        "pix",
        "boleto",
        "bank_transfer",
        "other",
      ],
      transaction_status: [
        "pending",
        "approved",
        "cancelled",
        "refunded",
        "disputed",
        "chargeback",
      ],
    },
  },
} as const

