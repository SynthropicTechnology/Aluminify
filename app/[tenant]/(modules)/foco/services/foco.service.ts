import { createClient } from "@/app/shared/core/client";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";
import type { Option, ModuloOption } from "../types";
import { MetodoEstudo, LogPausa } from "@/app/[tenant]/(modules)/sala-de-estudos/types";

export class FocoService {
  private supabase = createClient();

  async getCursos(empresaId?: string | null): Promise<Option[]> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();
    if (error || !user) return [];

    const role = (user.user_metadata?.role as string) || "aluno";

    if (role === "professor" || role === "usuario") {
      let query = this.supabase
        .from("cursos")
        .select("id, nome")
        .eq("created_by", user.id)
        .order("nome", { ascending: true });
      if (empresaId) query = query.eq("empresa_id", empresaId);
      const { data, error: cursosError } = await query;

      if (cursosError) throw cursosError;
      return (data || []).map((c) => ({ id: c.id, nome: c.nome }));
    } else {
      const cursoIds = await fetchCanonicalCourseIdsForStudent(
        this.supabase,
        user.id,
        empresaId ?? undefined,
      );
      if (cursoIds.length === 0) return [];

      const { data, error: cursosError } = await this.supabase
        .from("cursos")
        .select("id, nome")
        .in("id", cursoIds)
        .order("nome", { ascending: true });

      if (cursosError) throw cursosError;
      const list = data || [];
      return list.map((c) => ({ id: c.id, nome: c.nome }));
    }
  }

  async getDisciplinas(empresaId?: string | null): Promise<Option[]> {
    let query = this.supabase
      .from("disciplinas")
      .select("id, nome")
      .order("nome", { ascending: true });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((d) => ({ id: d.id, nome: d.nome }));
  }

  async getFrentes(cursoId: string, disciplinaId: string): Promise<Option[]> {
    const { data, error } = await this.supabase
      .from("frentes")
      .select("id, nome")
      .eq("disciplina_id", disciplinaId)
      .eq("curso_id", cursoId)
      .order("nome", { ascending: true });

    if (error) throw error;
    return (data || []).map((f) => ({ id: f.id, nome: f.nome }));
  }

  async getModulos(frenteId: string): Promise<ModuloOption[]> {
    const { data, error } = await this.supabase
      .from("modulos")
      .select("id, nome, numero_modulo")
      .eq("frente_id", frenteId)
      .order("numero_modulo", { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Deduplicar
    const listaMap = new Map<string, ModuloOption>();
    (data || []).forEach((m) => {
      if (!listaMap.has(m.id)) {
        listaMap.set(m.id, {
          id: m.id,
          nome: m.nome,
          numero_modulo: m.numero_modulo,
        });
      }
    });
    return Array.from(listaMap.values());
  }

  private async fetchWithAuth(
    url: string,
    init: RequestInit,
    empresaId?: string | null,
  ): Promise<Response> {
    const {
      data: { session },
      error,
    } = await this.supabase.auth.getSession();
    if (error || !session) throw new Error("Sessão expirada");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init.headers as Record<string, string>),
    };
    if (empresaId) headers["x-tenant-id"] = empresaId;

    return fetch(url, { ...init, headers });
  }

  async getAtividades(moduloId: string, empresaId?: string | null): Promise<Option[]> {
    const url = `/api/sala-de-estudos/atividades?modulo_id=${moduloId}`;
    const resp = await this.fetchWithAuth(url, { method: "GET" }, empresaId);
    if (!resp.ok) throw new Error("Falha ao carregar atividades");
    const { data } = await resp.json();
    return (data || []).map((a: { id: string; titulo: string }) => ({
      id: a.id,
      nome: a.titulo,
    }));
  }

  async iniciarSessao(
    disciplinaId: string | null,
    frenteId: string | null,
    moduloId: string | null,
    atividadeId: string | null,
    metodo: MetodoEstudo,
    empresaId?: string | null,
  ): Promise<{ id: string; inicio: string }> {
    const body = {
      disciplina_id: disciplinaId,
      frente_id: frenteId,
      modulo_id: moduloId,
      atividade_relacionada_id: atividadeId,
      metodo_estudo: metodo,
      inicio: new Date().toISOString(),
    };

    const resp = await this.fetchWithAuth(
      "/api/sala-de-estudos/sessao/iniciar",
      { method: "POST", body: JSON.stringify(body) },
      empresaId,
    );

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Erro ao iniciar sessão");
    }

    const { data } = await resp.json();
    return data;
  }

  async finalizarSessao(
    sessaoId: string,
    logPausas: LogPausa[],
    lastTickAt: string | null,
    nivelFoco: number,
    concluiuAtividade: boolean,
    atividadeId: string,
    empresaId?: string | null,
  ): Promise<void> {
    const resp = await this.fetchWithAuth(
      "/api/sala-de-estudos/sessao/finalizar",
      {
        method: "PATCH",
        body: JSON.stringify({
          sessao_id: sessaoId,
          log_pausas: logPausas,
          fim: lastTickAt ?? new Date().toISOString(),
          nivel_foco: nivelFoco,
          status: "concluido",
        }),
      },
      empresaId,
    );

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Erro ao finalizar sessão");
    }

    if (concluiuAtividade && atividadeId) {
      try {
        await this.fetchWithAuth(
          `/api/sala-de-estudos/progresso/atividade/${atividadeId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status: "Concluido" }),
          },
          empresaId,
        );
      } catch (err) {
        console.warn("[foco-service] Falha ao marcar atividade concluída", err);
      }
    }
  }

  async sendHeartbeat(sessaoId: string, empresaId?: string | null): Promise<void> {
    try {
      await this.fetchWithAuth(
        "/api/sala-de-estudos/sessao/heartbeat",
        {
          method: "PATCH",
          body: JSON.stringify({ sessao_id: sessaoId }),
        },
        empresaId,
      );
    } catch (err) {
      console.warn("[foco-service] heartbeat falhou", err);
    }
  }
}

export const focoService = new FocoService();
