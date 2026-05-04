import type {
  RespostaPorQuestao,
  RespostaAoFinal,
  ProgressoLista,
  ResultadoLista,
  ItemResultado,
} from "@/app/shared/types/entities/resposta";
import type { ModoCorrecao } from "@/app/shared/types/entities/lista";
import type { LetraGabarito } from "@/app/shared/types/entities/questao";
import type { RespostaRepository } from "./resposta.repository";
import type { ListaRepository } from "./lista.repository";
import {
  ListaNotFoundError,
  RespostaValidationError,
} from "./errors";

export class RespostaService {
  constructor(
    private readonly respostaRepo: RespostaRepository,
    private readonly listaRepo: ListaRepository,
  ) {}

  private resolveModoEfetivo(
    modosPermitidos: string,
    modoSolicitado?: ModoCorrecao,
  ): ModoCorrecao {
    if (modosPermitidos !== "ambos") return modosPermitidos as ModoCorrecao;
    if (modoSolicitado === "por_questao" || modoSolicitado === "ao_final") return modoSolicitado;
    return "por_questao";
  }

  async responder(
    listaId: string,
    usuarioId: string,
    empresaId: string,
    input: {
      questaoId: string;
      alternativaEscolhida: string;
      tempoRespostaSegundos?: number | null;
      alternativasRiscadas?: string[];
      modo?: ModoCorrecao;
    },
  ): Promise<RespostaPorQuestao | RespostaAoFinal> {
    const lista = await this.listaRepo.findByIdWithQuestoes(listaId);
    if (!lista) throw new ListaNotFoundError(listaId);
    if (lista.empresaId !== empresaId) throw new ListaNotFoundError(listaId);

    const questao = lista.questoes.find((q) => q.id === input.questaoId);
    if (!questao) {
      throw new RespostaValidationError(
        "Questao nao pertence a esta lista",
      );
    }

    const totalQuestoes = lista.questoes.length;
    const tentativa = await this.determineTentativa(
      usuarioId,
      listaId,
      totalQuestoes,
    );

    const correta =
      input.alternativaEscolhida === questao.gabarito.toLowerCase();

    try {
      const resposta = await this.respostaRepo.registrar({
        empresaId,
        usuarioId,
        listaId,
        questaoId: input.questaoId,
        tentativa,
        alternativaEscolhida: input.alternativaEscolhida,
        correta,
        tempoRespostaSegundos: input.tempoRespostaSegundos,
        alternativasRiscadas: input.alternativasRiscadas,
      });

      const modoEfetivo = this.resolveModoEfetivo(lista.modosCorrecaoPermitidos, input.modo);
      if (modoEfetivo === "por_questao") {
        return {
          resposta,
          correta,
          gabarito: questao.gabarito as LetraGabarito,
          resolucaoTexto: questao.resolucaoTexto ?? null,
          resolucaoVideoUrl: questao.resolucaoVideoUrl ?? null,
        };
      }

      const totalRespondidas =
        await this.respostaRepo.countRespostasNaTentativa(
          usuarioId,
          listaId,
          tentativa,
        );

      return {
        registrada: true,
        totalRespondidasNaTentativa: totalRespondidas,
        totalQuestoesNaLista: totalQuestoes,
      };
    } catch (err) {
      if (err instanceof Error && err.message === "DUPLICATE_RESPOSTA") {
        throw new RespostaValidationError(
          "Questao ja respondida nesta tentativa",
        );
      }
      throw err;
    }
  }

  async getProgresso(
    listaId: string,
    usuarioId: string,
  ): Promise<ProgressoLista> {
    const totalQuestoes = await this.listaRepo.countQuestoes(listaId);
    const maxTentativa = await this.respostaRepo.getMaxTentativa(
      usuarioId,
      listaId,
    );

    const tentativaAtual = maxTentativa === 0 ? 1 : maxTentativa;
    const totalRespondidas =
      maxTentativa === 0
        ? 0
        : await this.respostaRepo.countRespostasNaTentativa(
            usuarioId,
            listaId,
            maxTentativa,
          );

    return {
      listaId,
      usuarioId,
      tentativaAtual,
      totalQuestoes,
      totalRespondidas,
      finalizada: totalRespondidas >= totalQuestoes && totalQuestoes > 0,
    };
  }

  async getResultado(
    listaId: string,
    usuarioId: string,
    tentativa?: number,
  ): Promise<ResultadoLista> {
    const lista = await this.listaRepo.findByIdWithQuestoes(listaId);
    if (!lista) throw new ListaNotFoundError(listaId);

    const targetTentativa =
      tentativa ??
      (await this.respostaRepo.getMaxTentativa(usuarioId, listaId));

    if (targetTentativa === 0) {
      throw new RespostaValidationError("Nenhuma tentativa encontrada");
    }

    const totalQuestoes = lista.questoes.length;
    const totalRespondidas =
      await this.respostaRepo.countRespostasNaTentativa(
        usuarioId,
        listaId,
        targetTentativa,
      );

    if (totalRespondidas < totalQuestoes) {
      throw new RespostaValidationError(
        "Resultado indisponivel: tentativa nao finalizada",
      );
    }

    const respostas =
      await this.respostaRepo.findByUsuarioListaTentativa(
        usuarioId,
        listaId,
        targetTentativa,
      );

    const questaoMap = new Map(lista.questoes.map((q) => [q.id, q]));

    const questaoIds = respostas.map((r) => r.questaoId);
    const percentuais =
      await this.respostaRepo.getPercentualAcertoPorQuestao(
        questaoIds,
        lista.empresaId,
      );

    const itens: ItemResultado[] = respostas.map((r) => {
      const q = questaoMap.get(r.questaoId);
      return {
        questaoId: r.questaoId,
        alternativaEscolhida: r.alternativaEscolhida,
        correta: r.correta,
        gabarito: (q?.gabarito ?? "A") as LetraGabarito,
        resolucaoTexto: q?.resolucaoTexto ?? null,
        resolucaoVideoUrl: q?.resolucaoVideoUrl ?? null,
        tempoRespostaSegundos: r.tempoRespostaSegundos,
        percentualAcertoGeral: percentuais.get(r.questaoId) ?? null,
      };
    });

    const acertos = itens.filter((i) => i.correta).length;
    const total = itens.length;
    const percentual =
      total > 0 ? Math.round((acertos / total) * 10000) / 100 : 0;

    return {
      listaId,
      usuarioId,
      tentativa: targetTentativa,
      itens,
      resumo: { total, acertos, percentual },
    };
  }

  private async determineTentativa(
    usuarioId: string,
    listaId: string,
    totalQuestoes: number,
  ): Promise<number> {
    const maxTentativa = await this.respostaRepo.getMaxTentativa(
      usuarioId,
      listaId,
    );
    if (maxTentativa === 0) return 1;

    const count = await this.respostaRepo.countRespostasNaTentativa(
      usuarioId,
      listaId,
      maxTentativa,
    );

    return count >= totalQuestoes ? maxTentativa + 1 : maxTentativa;
  }
}
