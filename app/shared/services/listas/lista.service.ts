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
