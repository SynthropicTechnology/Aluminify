import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/shared/core/database.types";
import type { RespostaAluno } from "@/app/shared/types/entities/resposta";
import type { LetraAlternativa } from "@/app/shared/types/entities/questao";

type RespostaRow = Database["public"]["Tables"]["respostas_aluno"]["Row"];

export interface RespostaRepository {
  registrar(input: {
    empresaId: string;
    usuarioId: string;
    listaId: string;
    questaoId: string;
    tentativa: number;
    alternativaEscolhida: string;
    correta: boolean;
    tempoRespostaSegundos?: number | null;
    alternativasRiscadas?: string[];
  }): Promise<RespostaAluno>;
  findByUsuarioListaTentativa(
    usuarioId: string,
    listaId: string,
    tentativa: number,
  ): Promise<RespostaAluno[]>;
  getMaxTentativa(usuarioId: string, listaId: string): Promise<number>;
  countRespostasNaTentativa(
    usuarioId: string,
    listaId: string,
    tentativa: number,
  ): Promise<number>;
  getPercentualAcertoPorQuestao(
    questaoIds: string[],
    empresaId: string,
  ): Promise<Map<string, number>>;
}

function mapRespostaRow(row: RespostaRow): RespostaAluno {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    usuarioId: row.usuario_id,
    listaId: row.lista_id,
    questaoId: row.questao_id,
    tentativa: row.tentativa,
    alternativaEscolhida: row.alternativa_escolhida as LetraAlternativa,
    correta: row.correta,
    tempoRespostaSegundos: row.tempo_resposta_segundos,
    alternativasRiscadas: row.alternativas_riscadas as LetraAlternativa[],
    respondidaEm: new Date(row.respondida_em),
  };
}

export { mapRespostaRow };

export class RespostaRepositoryImpl implements RespostaRepository {
  constructor(private readonly client: SupabaseClient) {}

  async registrar(input: {
    empresaId: string;
    usuarioId: string;
    listaId: string;
    questaoId: string;
    tentativa: number;
    alternativaEscolhida: string;
    correta: boolean;
    tempoRespostaSegundos?: number | null;
    alternativasRiscadas?: string[];
  }): Promise<RespostaAluno> {
    const { data, error } = await this.client
      .from("respostas_aluno")
      .insert({
        empresa_id: input.empresaId,
        usuario_id: input.usuarioId,
        lista_id: input.listaId,
        questao_id: input.questaoId,
        tentativa: input.tentativa,
        alternativa_escolhida: input.alternativaEscolhida,
        correta: input.correta,
        tempo_resposta_segundos: input.tempoRespostaSegundos ?? null,
        alternativas_riscadas: input.alternativasRiscadas ?? [],
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("DUPLICATE_RESPOSTA");
      }
      throw new Error(`Failed to register resposta: ${error.message}`);
    }

    return mapRespostaRow(data);
  }

  async findByUsuarioListaTentativa(
    usuarioId: string,
    listaId: string,
    tentativa: number,
  ): Promise<RespostaAluno[]> {
    const { data, error } = await this.client
      .from("respostas_aluno")
      .select("*")
      .eq("usuario_id", usuarioId)
      .eq("lista_id", listaId)
      .eq("tentativa", tentativa)
      .order("respondida_em", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch respostas: ${error.message}`);
    }

    return (data ?? []).map(mapRespostaRow);
  }

  async getMaxTentativa(
    usuarioId: string,
    listaId: string,
  ): Promise<number> {
    const { data, error } = await this.client
      .from("respostas_aluno")
      .select("tentativa")
      .eq("usuario_id", usuarioId)
      .eq("lista_id", listaId)
      .order("tentativa", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to get max tentativa: ${error.message}`);
    }

    return data?.[0]?.tentativa ?? 0;
  }

  async countRespostasNaTentativa(
    usuarioId: string,
    listaId: string,
    tentativa: number,
  ): Promise<number> {
    const { count, error } = await this.client
      .from("respostas_aluno")
      .select("*", { count: "exact", head: true })
      .eq("usuario_id", usuarioId)
      .eq("lista_id", listaId)
      .eq("tentativa", tentativa);

    if (error) {
      throw new Error(`Failed to count respostas: ${error.message}`);
    }

    return count ?? 0;
  }

  async getPercentualAcertoPorQuestao(
    questaoIds: string[],
    empresaId: string,
  ): Promise<Map<string, number>> {
    if (questaoIds.length === 0) return new Map();

    const { data, error } = await this.client
      .from("respostas_aluno")
      .select("questao_id, correta")
      .eq("empresa_id", empresaId)
      .in("questao_id", questaoIds);

    if (error) {
      throw new Error(`Failed to get percentual acerto: ${error.message}`);
    }

    const stats = new Map<string, { total: number; acertos: number }>();
    for (const row of data ?? []) {
      const current = stats.get(row.questao_id) ?? { total: 0, acertos: 0 };
      current.total++;
      if (row.correta) current.acertos++;
      stats.set(row.questao_id, current);
    }

    const result = new Map<string, number>();
    for (const [qId, s] of stats) {
      result.set(qId, s.total > 0 ? Math.round((s.acertos / s.total) * 100) : 0);
    }
    return result;
  }
}
