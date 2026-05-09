import {
  CalculoTempoResultado,
  FinalizarSessaoInput,
  IniciarSessaoInput,
  LogPausa,
  SessaoEstudo,
} from '@/app/[tenant]/(modules)/sala-de-estudos/types';
import { SessaoEstudoRepository } from './sessao-estudo.repository';
import { SessaoEstudoNotFoundError, SessaoEstudoValidationError } from './errors';
import { cacheService } from '@/app/shared/core/services/cache';

function isISODate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function parseLogPausas(logs: LogPausa[]): LogPausa[] {
  if (!Array.isArray(logs)) {
    throw new SessaoEstudoValidationError('log_pausas deve ser um array');
  }

  return logs.map((log, index) => {
    if (!log || typeof log !== 'object') {
      throw new SessaoEstudoValidationError(`log_pausas[${index}] inválido`);
    }
    if (!log.inicio || !log.fim) {
      throw new SessaoEstudoValidationError(`log_pausas[${index}] precisa de inicio e fim`);
    }
    if (!isISODate(log.inicio) || !isISODate(log.fim)) {
      throw new SessaoEstudoValidationError(`log_pausas[${index}] deve usar datas ISO`);
    }
    if (log.tipo !== 'manual' && log.tipo !== 'distracao') {
      throw new SessaoEstudoValidationError(`log_pausas[${index}].tipo inválido`);
    }

    return {
      inicio: log.inicio,
      fim: log.fim,
      tipo: log.tipo,
    };
  });
}

function calcularTempos(
  inicioIso: string,
  fimIso: string,
  logPausas: LogPausa[],
): CalculoTempoResultado {
  if (!isISODate(inicioIso) || !isISODate(fimIso)) {
    throw new SessaoEstudoValidationError('Datas de início e fim devem estar em ISO válido');
  }

  const inicioMs = Date.parse(inicioIso);
  const fimMs = Date.parse(fimIso);

  if (fimMs <= inicioMs) {
    throw new SessaoEstudoValidationError('Fim deve ser maior que início');
  }

  const brutoMs = fimMs - inicioMs;
  let totalPausasMs = 0;

  for (const pausa of logPausas) {
    // parseLogPausas already validates inicio/fim exist
    const pausaInicio = Date.parse(pausa.inicio!);
    const pausaFim = Date.parse(pausa.fim!);

    if (Number.isNaN(pausaInicio) || Number.isNaN(pausaFim) || pausaFim <= pausaInicio) {
      throw new SessaoEstudoValidationError('Intervalo de pausa inválido');
    }

    // Clamping para evitar que pausas extrapolem os limites da sessão
    const clampedInicio = Math.max(pausaInicio, inicioMs);
    const clampedFim = Math.min(pausaFim, fimMs);

    if (clampedFim > clampedInicio) {
      totalPausasMs += clampedFim - clampedInicio;
    }
  }

  const tempoTotalBrutoSegundos = Math.round(brutoMs / 1000);
  const tempoTotalLiquidoSegundos = Math.max(
    0,
    tempoTotalBrutoSegundos - Math.round(totalPausasMs / 1000),
  );

  return {
    tempoTotalBrutoSegundos,
    tempoTotalLiquidoSegundos,
    tempo_total_minutos: Math.round(tempoTotalBrutoSegundos / 60),
    tempo_efetivo_minutos: Math.round(tempoTotalLiquidoSegundos / 60),
    pausas: logPausas,
  };
}

export class SessaoEstudoService {
  constructor(private readonly repository: SessaoEstudoRepository) {}

  async iniciarSessao(alunoId: string, input: IniciarSessaoInput): Promise<SessaoEstudo> {
    if (!alunoId) {
      throw new SessaoEstudoValidationError('aluno_id é obrigatório');
    }
    if (input.inicioIso && !isISODate(input.inicioIso)) {
      throw new SessaoEstudoValidationError('inicio deve ser uma data ISO válida');
    }

    return this.repository.create({
      alunoId,
      disciplinaId: input.disciplinaId ?? undefined,
      frenteId: input.frenteId ?? undefined,
      moduloId: input.moduloId ?? undefined,
      atividadeRelacionadaId: input.atividadeRelacionadaId ?? undefined,
      listaId: input.listaId ?? undefined,
      tentativa: input.tentativa ?? undefined,
      metodoEstudo: input.metodoEstudo,
      inicioIso: input.inicioIso,
      empresaId: input.empresaId ?? undefined,
    });
  }

  async finalizarSessao(alunoId: string, input: FinalizarSessaoInput): Promise<SessaoEstudo> {
    if (!alunoId) {
      throw new SessaoEstudoValidationError('aluno_id é obrigatório');
    }
    if (!input.sessaoId) {
      throw new SessaoEstudoValidationError('sessao_id é obrigatório');
    }

    const sessao = await this.repository.findById(input.sessaoId);
    if (!sessao || sessao.alunoId !== alunoId) {
      throw new SessaoEstudoNotFoundError(input.sessaoId);
    }
    if (sessao.status === 'concluido' || sessao.status === 'descartado') {
      throw new SessaoEstudoValidationError('Sessão já finalizada');
    }

    const fimIso = input.fimIso ?? new Date().toISOString();
    const logPausas = parseLogPausas(input.logPausas ?? []);
    const { tempoTotalBrutoSegundos, tempoTotalLiquidoSegundos } = calcularTempos(
      sessao.inicio,
      fimIso,
      logPausas,
    );

    const result = await this.repository.updateFinalizacao(input.sessaoId, alunoId, {
      fimIso,
      logPausas,
      tempoTotalBrutoSegundos,
      tempoTotalLiquidoSegundos,
      nivelFoco: input.nivelFoco,
      status: input.status ?? 'concluido',
    });

    // Invalidar cache da sessão
    await cacheService.del(`cache:sessao:${input.sessaoId}:estado`);

    return result;
  }

  async heartbeat(alunoId: string, sessaoId: string): Promise<void> {
    if (!alunoId) {
      throw new SessaoEstudoValidationError('aluno_id é obrigatório');
    }
    if (!sessaoId) {
      throw new SessaoEstudoValidationError('sessao_id é obrigatório');
    }

    // Verificar cache primeiro (estado temporário)
    const cacheKey = `cache:sessao:${sessaoId}:estado`;
    const cachedState = await cacheService.get<{ lastHeartbeat: number; needsUpdate: boolean }>(cacheKey);
    const now = Date.now();
    
    // Se há cache e foi atualizado recentemente (< 5 minutos), apenas atualizar cache
    if (cachedState && (now - cachedState.lastHeartbeat) < 5 * 60 * 1000) {
      await cacheService.set(cacheKey, { lastHeartbeat: now, needsUpdate: true }, 600); // TTL: 10 minutos
      return; // Não atualizar banco ainda
    }

    // Buscar do banco e validar
    const sessao = await this.repository.findById(sessaoId);
    if (!sessao || sessao.alunoId !== alunoId) {
      throw new SessaoEstudoNotFoundError(sessaoId);
    }
    if (sessao.status === 'concluido' || sessao.status === 'descartado') {
      throw new SessaoEstudoValidationError('Sessão já finalizada');
    }

    // Atualizar banco
    await this.repository.heartbeat(sessaoId, alunoId);
    
    // Atualizar cache
    await cacheService.set(cacheKey, { lastHeartbeat: now, needsUpdate: false }, 600); // TTL: 10 minutos
  }

  async getOrCreateListaSessao(
    alunoId: string,
    listaId: string,
    tentativa: number,
    empresaId?: string,
  ): Promise<{ sessao: SessaoEstudo; tempoAcumulado: number }> {
    const active = await this.repository.findActiveByLista(alunoId, listaId);
    if (active && active.tentativa === tentativa) {
      const tempoAcumulado = await this.repository.getTempoAcumulado(alunoId, listaId, tentativa);
      return { sessao: active, tempoAcumulado };
    }

    if (active) {
      await this.finalizarSessao(alunoId, {
        sessaoId: active.id,
        status: "concluido",
      });
    }

    const tempoAcumulado = await this.repository.getTempoAcumulado(alunoId, listaId, tentativa);
    const sessao = await this.iniciarSessao(alunoId, {
      listaId,
      tentativa,
      metodoEstudo: "cronometro",
      empresaId,
    });
    return { sessao, tempoAcumulado };
  }

  async pausarListaSessao(
    alunoId: string,
    sessaoId: string,
    logPausas: LogPausa[],
  ): Promise<SessaoEstudo> {
    return this.finalizarSessao(alunoId, {
      sessaoId,
      logPausas,
      status: "concluido",
    });
  }
}

export const sessaoEstudoService = new SessaoEstudoService(new SessaoEstudoRepository());




