import type {
  Lista,
  ListaResumo,
  ListaComQuestoes,
  ListaParaAluno,
  QuestaoEmListaParaAluno,
  ModoCorrecao,
  CreateListaInput,
  UpdateListaInput,
} from "@/app/shared/types/entities/lista";
import type {
  LetraAlternativa,
  LetraGabarito,
  ContentBlock,
} from "@/app/shared/types/entities/questao";
import type { ListaRepository } from "./lista.repository";
import type { RespostaRepository } from "./resposta.repository";
import { ListaNotFoundError, ListaValidationError } from "./errors";

export interface RelatorioListas {
  resumo: {
    totalListas: number;
    totalAlunos: number;
    aproveitamentoMedio: number | null;
  };
  porLista: Array<{
    listaId: string;
    titulo: string;
    tipo: string;
    totalQuestoes: number;
    totalAlunosIniciaram: number;
    totalAlunosFinalizaram: number;
    aproveitamento: number | null;
    tempoMedio: number | null;
  }>;
  porDisciplina: Array<{
    disciplina: string;
    total: number;
    acertos: number;
    percentual: number;
  }>;
  ranking: Array<{
    alunoId: string;
    nome: string;
    total: number;
    acertos: number;
    percentual: number;
  }>;
  maisErradas: Array<{
    questaoId: string;
    codigo: string | null;
    numeroOriginal: number | null;
    disciplina: string | null;
    total: number;
    acertos: number;
    percentualAcerto: number;
  }>;
}

export class ListaService {
  constructor(
    private readonly listaRepo: ListaRepository,
    private readonly respostaRepo: RespostaRepository,
  ) {}

  async list(empresaId: string): Promise<ListaResumo[]> {
    if (!empresaId) {
      throw new ListaValidationError("empresaId is required");
    }
    return this.listaRepo.list(empresaId);
  }

  async listAvailable(empresaId: string): Promise<ListaResumo[]> {
    const listas = await this.list(empresaId);
    return listas.filter((lista) => lista.totalQuestoes > 0);
  }

  async listAvailablePaginated(
    empresaId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ data: ListaResumo[]; nextCursor: string | null }> {
    if (!empresaId) {
      throw new ListaValidationError("empresaId is required");
    }
    const result = await this.listaRepo.listPaginated(empresaId, opts);
    result.data = result.data.filter((l) => l.totalQuestoes > 0);
    return result;
  }

  async getRelatorio(empresaId: string): Promise<RelatorioListas> {
    if (!empresaId) {
      throw new ListaValidationError("empresaId is required");
    }
    const raw = await this.listaRepo.getRelatorioData(empresaId);

    const latestTentativas = new Map<string, number>();
    for (const r of raw.respostas) {
      const key = `${r.usuario_id}|${r.lista_id}`;
      const cur = latestTentativas.get(key) ?? 0;
      if (r.tentativa > cur) latestTentativas.set(key, r.tentativa);
    }
    const respostasLatest = raw.respostas.filter((r) => {
      const key = `${r.usuario_id}|${r.lista_id}`;
      return r.tentativa === latestTentativas.get(key);
    });

    const questaoMap = new Map(raw.questoes.map((q) => [q.id, q]));
    const usuarioMap = new Map(raw.usuarios.map((u) => [u.id, u.nome]));

    const porLista = raw.listas
      .filter((l) => l.total_questoes > 0)
      .map((lista) => {
        const resps = respostasLatest.filter((r) => r.lista_id === lista.id);
        const alunoIds = new Set(resps.map((r) => r.usuario_id));
        const finalizados = new Set<string>();
        for (const alunoId of alunoIds) {
          const respsAluno = resps.filter((r) => r.usuario_id === alunoId);
          if (respsAluno.length >= lista.total_questoes) finalizados.add(alunoId);
        }
        const totalAcertos = resps.filter((r) => r.correta).length;
        const tempos = resps
          .map((r) => r.tempo_resposta_segundos)
          .filter((t): t is number => t != null && t > 0);
        return {
          listaId: lista.id,
          titulo: lista.titulo,
          tipo: lista.tipo,
          totalQuestoes: lista.total_questoes,
          totalAlunosIniciaram: alunoIds.size,
          totalAlunosFinalizaram: finalizados.size,
          aproveitamento: resps.length > 0 ? Math.round((totalAcertos / resps.length) * 100) : null,
          tempoMedio: tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
        };
      });

    const porDisciplina = new Map<string, { total: number; acertos: number }>();
    for (const r of respostasLatest) {
      const q = questaoMap.get(r.questao_id);
      const disc = q?.disciplina ?? "Sem disciplina";
      const cur = porDisciplina.get(disc) ?? { total: 0, acertos: 0 };
      cur.total++;
      if (r.correta) cur.acertos++;
      porDisciplina.set(disc, cur);
    }
    const disciplinas = Array.from(porDisciplina.entries())
      .map(([nome, d]) => ({
        disciplina: nome,
        total: d.total,
        acertos: d.acertos,
        percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
      }))
      .sort((a, b) => a.disciplina.localeCompare(b.disciplina));

    const porAluno = new Map<string, { total: number; acertos: number }>();
    for (const r of respostasLatest) {
      const cur = porAluno.get(r.usuario_id) ?? { total: 0, acertos: 0 };
      cur.total++;
      if (r.correta) cur.acertos++;
      porAluno.set(r.usuario_id, cur);
    }
    const ranking = Array.from(porAluno.entries())
      .map(([id, d]) => ({
        alunoId: id,
        nome: usuarioMap.get(id) ?? "Aluno",
        total: d.total,
        acertos: d.acertos,
        percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.percentual - a.percentual);

    const porQuestao = new Map<string, { total: number; acertos: number }>();
    for (const r of respostasLatest) {
      const cur = porQuestao.get(r.questao_id) ?? { total: 0, acertos: 0 };
      cur.total++;
      if (r.correta) cur.acertos++;
      porQuestao.set(r.questao_id, cur);
    }
    const maisErradas = Array.from(porQuestao.entries())
      .filter(([, d]) => d.total >= 3)
      .map(([id, d]) => {
        const q = questaoMap.get(id);
        return {
          questaoId: id,
          codigo: q?.codigo ?? null,
          numeroOriginal: q?.numero_original ?? null,
          disciplina: q?.disciplina ?? null,
          total: d.total,
          acertos: d.acertos,
          percentualAcerto: Math.round((d.acertos / d.total) * 100),
        };
      })
      .sort((a, b) => a.percentualAcerto - b.percentualAcerto)
      .slice(0, 10);

    return {
      resumo: {
        totalListas: porLista.length,
        totalAlunos: new Set(respostasLatest.map((r) => r.usuario_id)).size,
        aproveitamentoMedio: respostasLatest.length > 0
          ? Math.round((respostasLatest.filter((r) => r.correta).length / respostasLatest.length) * 100)
          : null,
      },
      porLista,
      porDisciplina: disciplinas,
      ranking,
      maisErradas,
    };
  }

  async getById(id: string, empresaId?: string): Promise<ListaComQuestoes> {
    const lista = await this.listaRepo.findByIdWithQuestoes(id);
    if (!lista) throw new ListaNotFoundError(id);
    if (empresaId && lista.empresaId !== empresaId) {
      throw new ListaNotFoundError(id);
    }
    return lista;
  }

  private resolveModoConcrete(
    lista: ListaComQuestoes,
    modoSolicitado?: ModoCorrecao,
  ): ModoCorrecao {
    if (lista.modosCorrecaoPermitidos !== "ambos") {
      return lista.modosCorrecaoPermitidos;
    }
    if (modoSolicitado === "por_questao" || modoSolicitado === "ao_final") {
      return modoSolicitado;
    }
    return "por_questao";
  }

  async getParaAluno(
    id: string,
    usuarioId: string,
    empresaId?: string,
    modoSolicitado?: ModoCorrecao,
  ): Promise<ListaParaAluno> {
    const lista = await this.getById(id, empresaId);
    const totalQuestoes = lista.questoes.length;
    if (totalQuestoes === 0) {
      throw new ListaNotFoundError(id);
    }

    const modoEfetivo = this.resolveModoConcrete(lista, modoSolicitado);

    const maxTentativa = await this.respostaRepo.getMaxTentativa(
      usuarioId,
      id,
    );
    const tentativaAtual = maxTentativa === 0 ? 1 : maxTentativa;

    const totalRespondidas =
      maxTentativa === 0
        ? 0
        : await this.respostaRepo.countRespostasNaTentativa(
            usuarioId,
            id,
            maxTentativa,
          );
    const finalizada =
      totalRespondidas >= totalQuestoes && totalQuestoes > 0;

    let respostas: Awaited<ReturnType<typeof this.respostaRepo.findByUsuarioListaTentativa>> = [];
    if (maxTentativa > 0) {
      respostas = await this.respostaRepo.findByUsuarioListaTentativa(
        usuarioId,
        id,
        maxTentativa,
      );
    }
    const answeredQuestaoIds = new Set(respostas.map((r) => r.questaoId));

    const shouldExposeGabarito = (questaoId: string): boolean => {
      if (modoEfetivo === "por_questao") {
        return answeredQuestaoIds.has(questaoId);
      }
      return finalizada;
    };

    const questoes: QuestaoEmListaParaAluno[] = lista.questoes.map((q) => {
      const expose = shouldExposeGabarito(q.id);
      return {
        id: q.id,
        empresaId: q.empresaId,
        codigo: q.codigo,
        numeroOriginal: q.numeroOriginal,
        instituicao: q.instituicao,
        ano: q.ano,
        disciplina: q.disciplina,
        disciplinaId: q.disciplinaId,
        frenteId: q.frenteId,
        moduloId: q.moduloId,
        dificuldade: q.dificuldade,
        enunciado: q.enunciado,
        tags: q.tags,
        importacaoJobId: q.importacaoJobId,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        textoBase: q.textoBase,
        createdBy: q.createdBy,
        alternativas: q.alternativas.map((alt) => ({
          id: alt.id,
          letra: alt.letra as LetraAlternativa,
          texto: alt.texto,
          imagemPath: alt.imagemPath,
          ordem: alt.ordem,
        })),
        ...(expose
          ? {
              gabarito: q.gabarito as LetraGabarito,
              resolucaoTexto: q.resolucaoTexto as ContentBlock[] | null,
              resolucaoVideoUrl: q.resolucaoVideoUrl,
            }
          : {}),
      };
    });

    return {
      ...{
        id: lista.id,
        empresaId: lista.empresaId,
        atividadeId: lista.atividadeId,
        createdBy: lista.createdBy,
        titulo: lista.titulo,
        descricao: lista.descricao,
        tipo: lista.tipo,
        modosCorrecaoPermitidos: lista.modosCorrecaoPermitidos,
        embaralharQuestoes: lista.embaralharQuestoes,
        embaralharAlternativas: lista.embaralharAlternativas,
        createdAt: lista.createdAt,
        updatedAt: lista.updatedAt,
      },
      questoes,
      tentativaAtual,
      finalizada,
      modoCorrecaoEfetivo: modoEfetivo,
      respostasAnteriores: respostas.map((r) => ({
        questaoId: r.questaoId,
        alternativaEscolhida: r.alternativaEscolhida,
        correta: r.correta,
        alternativasRiscadas: r.alternativasRiscadas,
      })),
    };
  }

  async create(input: CreateListaInput): Promise<Lista> {
    if (!input.empresaId) {
      throw new ListaValidationError("empresaId is required");
    }
    if (!input.titulo || !input.titulo.trim()) {
      throw new ListaValidationError("titulo is required");
    }
    return this.listaRepo.create({ ...input, titulo: input.titulo.trim() });
  }

  async update(
    id: string,
    input: UpdateListaInput,
    empresaId?: string,
  ): Promise<Lista> {
    const existing = await this.listaRepo.findById(id);
    if (!existing) throw new ListaNotFoundError(id);
    if (empresaId && existing.empresaId !== empresaId) {
      throw new ListaNotFoundError(id);
    }
    return this.listaRepo.update(id, input);
  }

  async delete(id: string, empresaId?: string): Promise<void> {
    const existing = await this.listaRepo.findById(id);
    if (!existing) throw new ListaNotFoundError(id);
    if (empresaId && existing.empresaId !== empresaId) {
      throw new ListaNotFoundError(id);
    }
    await this.listaRepo.softDelete(id);
  }

  async addQuestoes(
    listaId: string,
    questaoIds: string[],
    empresaId: string,
  ): Promise<void> {
    const lista = await this.listaRepo.findById(listaId);
    if (!lista) throw new ListaNotFoundError(listaId);
    if (lista.empresaId !== empresaId) throw new ListaNotFoundError(listaId);
    await this.listaRepo.addQuestoes(listaId, questaoIds, empresaId);
  }

  async removeQuestao(
    listaId: string,
    questaoId: string,
    empresaId?: string,
  ): Promise<void> {
    const lista = await this.listaRepo.findById(listaId);
    if (!lista) throw new ListaNotFoundError(listaId);
    if (empresaId && lista.empresaId !== empresaId) {
      throw new ListaNotFoundError(listaId);
    }
    await this.listaRepo.removeQuestao(listaId, questaoId);
  }

  async reorderQuestoes(
    listaId: string,
    ordens: Array<{ questaoId: string; ordem: number }>,
    empresaId?: string,
  ): Promise<void> {
    const lista = await this.listaRepo.findById(listaId);
    if (!lista) throw new ListaNotFoundError(listaId);
    if (empresaId && lista.empresaId !== empresaId) {
      throw new ListaNotFoundError(listaId);
    }
    await this.listaRepo.reorderQuestoes(listaId, ordens);
  }
}
