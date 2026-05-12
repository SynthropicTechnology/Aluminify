"use server";

import { createClient } from "@/app/shared/core/server";
import { revalidatePath } from "next/cache";
import { ConfiguracoesProfessor } from "../types";
import type { Database } from "@/app/shared/core/database.types";
import { canManageProfessorSchedule } from "./admin-helpers";
import { getDatabaseClient } from "@/app/shared/core/database/database";

export async function getConfiguracoesProfessor(
  professorId: string,
): Promise<ConfiguracoesProfessor | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agendamento_configuracoes")
    .select("*")
    .eq("professor_id", professorId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching professor config:", error);
    return null;
  }

  // Return defaults if no config exists
  if (!data) {
    return {
      professor_id: professorId,
      auto_confirmar: false,
      tempo_antecedencia_minimo: 60,
      tempo_lembrete_minutos: 1440,
      link_reuniao_padrao: null,
      mensagem_confirmacao: null,
    };
  }

  // Map database data to ensure non-nullable fields have defaults
  return {
    id: data.id,
    professor_id: data.professor_id,
    auto_confirmar: data.auto_confirmar ?? false,
    tempo_antecedencia_minimo: data.tempo_antecedencia_minimo ?? 60,
    tempo_lembrete_minutos: data.tempo_lembrete_minutos ?? 1440,
    link_reuniao_padrao: data.link_reuniao_padrao,
    mensagem_confirmacao: data.mensagem_confirmacao,
    created_at: data.created_at ?? undefined,
    updated_at: data.updated_at ?? undefined,
  };
}

export async function updateConfiguracoesProfessor(
  professorId: string,
  config: Partial<ConfiguracoesProfessor>,
) {
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

  const {
    id: _id,
    created_at: _created_at,
    updated_at: _updated_at,
    ...configData
  } = config;
  void _id;
  void _created_at;
  void _updated_at;

  const adminClient = getDatabaseClient();
  const { data: professor, error: professorError } = await adminClient
    .from("usuarios")
    .select("empresa_id")
    .eq("id", professorId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .single();

  if (professorError || !professor?.empresa_id) {
    console.error("Error fetching professor company for config:", professorError);
    throw new Error("Professor company not found");
  }

  const { data, error } = await supabase
    .from("agendamento_configuracoes")
    .upsert(
      {
        ...configData,
        professor_id: professorId,
        empresa_id: professor.empresa_id,
      } as Database["public"]["Tables"]["agendamento_configuracoes"]["Insert"],
      { onConflict: "professor_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("Error updating professor config:", error);
    throw new Error("Failed to update configuration");
  }

  revalidatePath("/agendamentos/configuracoes");
  return data;
}
