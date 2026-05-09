import { getDatabaseClient } from "@/app/shared/core/database/database";
import type { Database } from "@/app/shared/core/database.types";
import {
  MetodoEstudo,
  SessaoEstudo,
  SessaoStatus,
  LogPausa,
} from "@/app/[tenant]/(modules)/sala-de-estudos/types";

// Use generated Database types instead of manual definitions
type SessaoEstudoRow = Database["public"]["Tables"]["sessoes_estudo"]["Row"];
type _SessaoEstudoInsert =
  Database["public"]["Tables"]["sessoes_estudo"]["Insert"];
type SessaoEstudoUpdate =
  Database["public"]["Tables"]["sessoes_estudo"]["Update"];

function mapRowToModel(row: SessaoEstudoRow): SessaoEstudo {
  // Parse log_pausas safely
  let logPausas: LogPausa[] = [];
  if (row.log_pausas) {
    try {
      if (Array.isArray(row.log_pausas)) {
        // Validate that each item has the required LogPausa structure
        logPausas = (row.log_pausas as unknown[]).filter(
          (item): item is LogPausa => {
            return (
              typeof item === "object" &&
              item !== null &&
              "inicio" in item &&
              "fim" in item &&
              "tipo" in item
            );
          },
        );
      }
    } catch (e) {
      console.error("Error parsing log_pausas:", e);
    }
  }

  return {
    id: row.id,
    alunoId: row.usuario_id ?? "",
    disciplinaId: row.disciplina_id ?? null,
    frenteId: row.frente_id ?? null,
    moduloId: null,
    atividadeRelacionadaId: row.atividade_relacionada_id ?? null,
    listaId: (row as Record<string, unknown>).lista_id as string | null ?? null,
    tentativa: (row as Record<string, unknown>).tentativa as number | null ?? null,
    inicio: row.inicio ?? "",
    fim: row.fim ?? null,
    tempoTotalBrutoSegundos: row.tempo_total_bruto_segundos ?? null,
    tempoTotalLiquidoSegundos: row.tempo_total_liquido_segundos ?? null,
    logPausas,
    metodoEstudo: (row.metodo_estudo as MetodoEstudo) ?? null,
    nivelFoco: row.nivel_foco ?? null,
    status: (row.status as SessaoStatus) ?? "em_andamento",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export class SessaoEstudoRepository {
  private readonly table = "sessoes_estudo" as const;

  async create(input: {
    alunoId: string;
    disciplinaId?: string;
    frenteId?: string;
    moduloId?: string;
    atividadeRelacionadaId?: string;
    listaId?: string;
    tentativa?: number;
    metodoEstudo?: MetodoEstudo;
    inicioIso?: string;
    empresaId?: string;
  }): Promise<SessaoEstudo> {
    const client = getDatabaseClient();

    // Derivar modulo_id quando não vier explicitamente, mas houver atividade relacionada.
    // Isso melhora a qualidade do analytics por módulo sem exigir mudanças imediatas no front.
    let moduloId = input.moduloId ?? null;
    if (!moduloId && input.atividadeRelacionadaId) {
      const { data: atividade, error: atividadeError } = await client
        .from("atividades")
        .select("modulo_id")
        .eq("id", input.atividadeRelacionadaId)
        .maybeSingle<{ modulo_id: string | null }>();

      if (!atividadeError && atividade?.modulo_id) {
        moduloId = atividade.modulo_id;
      }
    }

    const baseInsert: Record<string, unknown> = {
      usuario_id: input.alunoId,
      disciplina_id: input.disciplinaId ?? null,
      frente_id: input.frenteId ?? null,
      atividade_relacionada_id: input.atividadeRelacionadaId ?? null,
      metodo_estudo: input.metodoEstudo ?? null,
      inicio: input.inicioIso ?? new Date().toISOString(),
      empresa_id: input.empresaId ?? null,
    };
    if (input.listaId) baseInsert.lista_id = input.listaId;
    if (input.tentativa != null) baseInsert.tentativa = input.tentativa;

    // Observação: alguns ambientes ainda não aplicaram a migration de `modulo_id`.
    // Tentamos inserir com `modulo_id` e, se o schema cache não conhecer a coluna, fazemos fallback sem ela.
    let data: unknown;
    let error: { message: string } | null = null;

    {
      const attempt = await client
        .from(this.table)
        .insert({ ...baseInsert, modulo_id: moduloId } as _SessaoEstudoInsert)
        .select()
        .single();
      data = attempt.data;
      error = attempt.error as { message: string } | null;
    }

    if (
      error &&
      typeof error.message === "string" &&
      error.message.includes("modulo_id") &&
      error.message.includes("schema cache")
    ) {
      const attempt = await client
        .from(this.table)
        .insert(baseInsert as _SessaoEstudoInsert)
        .select()
        .single();
      data = attempt.data;
      error = attempt.error as { message: string } | null;
    }

    if (error) {
      throw new Error(`Erro ao criar sessão de estudo: ${error.message}`);
    }

    return mapRowToModel(data as SessaoEstudoRow);
  }

  async findById(id: string): Promise<SessaoEstudo | null> {
    const client = getDatabaseClient();
    const { data, error } = await client
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Erro ao buscar sessão de estudo: ${error.message}`);
    }
    return data ? mapRowToModel(data as SessaoEstudoRow) : null;
  }

  async updateFinalizacao(
    id: string,
    alunoId: string,
    payload: {
      fimIso: string;
      logPausas: LogPausa[];
      tempoTotalBrutoSegundos: number;
      tempoTotalLiquidoSegundos: number;
      nivelFoco?: number;
      status?: SessaoStatus;
    },
  ): Promise<SessaoEstudo> {
    const client = getDatabaseClient();

    const updateData: SessaoEstudoUpdate = {
      fim: payload.fimIso,
      log_pausas:
        payload.logPausas as unknown as Database["public"]["Tables"]["sessoes_estudo"]["Update"]["log_pausas"],
      tempo_total_bruto_segundos: payload.tempoTotalBrutoSegundos,
      tempo_total_liquido_segundos: payload.tempoTotalLiquidoSegundos,
      nivel_foco: payload.nivelFoco ?? null,
      status: payload.status ?? "concluido",
    };

    const { data, error } = await client
      .from(this.table)
      .update(updateData)
      .eq("id", id)
      .eq("usuario_id", alunoId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao finalizar sessão de estudo: ${error.message}`);
    }

    return mapRowToModel(data as SessaoEstudoRow);
  }

  async findActiveByLista(
    alunoId: string,
    listaId: string,
  ): Promise<SessaoEstudo | null> {
    const client = getDatabaseClient();
    const { data, error } = await client
      .from(this.table)
      .select("*")
      .eq("usuario_id", alunoId)
      .eq("lista_id" as string, listaId)
      .in("status", ["em_andamento", "pausada"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Erro ao buscar sessão ativa: ${error.message}`);
    }
    return data ? mapRowToModel(data as SessaoEstudoRow) : null;
  }

  async getTempoAcumulado(
    alunoId: string,
    listaId: string,
    tentativa: number,
  ): Promise<number> {
    const client = getDatabaseClient();
    const { data, error } = await client
      .from(this.table)
      .select("tempo_total_liquido_segundos")
      .eq("usuario_id", alunoId)
      .eq("lista_id" as string, listaId)
      .eq("tentativa" as string, tentativa)
      .in("status", ["concluido", "finalizada"]);
    if (error) {
      throw new Error(`Erro ao buscar tempo acumulado: ${error.message}`);
    }
    return (data ?? []).reduce(
      (sum, row) => sum + ((row as Record<string, unknown>).tempo_total_liquido_segundos as number ?? 0),
      0,
    );
  }

  async updateStatus(
    id: string,
    alunoId: string,
    status: SessaoStatus,
    logPausas?: LogPausa[],
  ): Promise<void> {
    const client = getDatabaseClient();
    const update: Record<string, unknown> = { status };
    if (logPausas) {
      update.log_pausas = logPausas;
    }
    const { error } = await client
      .from(this.table)
      .update(update as SessaoEstudoUpdate)
      .eq("id", id)
      .eq("usuario_id", alunoId);
    if (error) {
      throw new Error(`Erro ao atualizar status da sessão: ${error.message}`);
    }
  }

  async heartbeat(id: string, alunoId: string): Promise<void> {
    const client = getDatabaseClient();
    const { error } = await client
      .from(this.table)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("usuario_id", alunoId);

    // Fallback para ambientes sem coluna updated_at (migration não aplicada)
    if (
      error &&
      typeof error.message === "string" &&
      error.message.includes("updated_at") &&
      error.message.includes("schema cache")
    ) {
      return;
    }

    if (error) {
      throw new Error(`Erro ao registrar heartbeat: ${error.message}`);
    }
  }
}
