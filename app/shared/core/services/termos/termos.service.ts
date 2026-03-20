/**
 * Serviço de Aceite de Termos Legais
 *
 * Gerencia o registro e verificação de aceites de termos por admins de tenant.
 * Usa cache em memória para evitar queries repetidas no banco.
 */

import { getDatabaseClient } from "@/app/shared/core/database/database";
import { cacheService } from "@/app/shared/core/services/cache/cache.service";
import {
  TERMOS_VIGENTES,
  TERMOS_LABELS,
  type TipoDocumentoLegal,
  type TermoAceite,
  type TermoAceiteStatus,
} from "@/app/shared/types/entities/termos";

const TERMOS_CACHE_TTL = 1800; // 30 minutos
const ALL_TIPOS: TipoDocumentoLegal[] = [
  "termos_uso",
  "politica_privacidade",
  "dpa",
];

function getCacheKey(usuarioId: string, empresaId: string): string {
  return `termos:aceite:${usuarioId}:${empresaId}`;
}

function getEmpresaCacheKey(empresaId: string): string {
  return `termos:aceite:empresa:${empresaId}`;
}

/**
 * Registra o aceite de todos os documentos legais vigentes por um admin.
 */
export async function registrarAceite(params: {
  usuarioId: string;
  empresaId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { usuarioId, empresaId, ipAddress, userAgent } = params;
  const adminClient = getDatabaseClient();

  const statusAtual = await consultarStatusAceite(usuarioId, empresaId);
  const tiposPendentes = statusAtual
    .filter((status) => !status.vigente)
    .map((status) => status.tipoDocumento);

  if (tiposPendentes.length === 0) {
    await cacheService.del(getCacheKey(usuarioId, empresaId));
    return;
  }

  const rows = tiposPendentes.map((tipo) => ({
    usuario_id: usuarioId,
    empresa_id: empresaId,
    tipo_documento: tipo,
    versao: TERMOS_VIGENTES[tipo],
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
  }));

  const { error } = await adminClient.from("termos_aceite").insert(rows);

  if (error) {
    throw new Error(`Erro ao registrar aceite de termos: ${error.message}`);
  }

  // Invalidar caches (por usuário e por empresa)
  await Promise.all([
    cacheService.del(getCacheKey(usuarioId, empresaId)),
    cacheService.del(getEmpresaCacheKey(empresaId)),
  ]);
}

/**
 * Verifica se um admin aceitou todas as versões vigentes dos termos.
 * Retorna true se todos os documentos foram aceitos na versão vigente.
 */
export async function verificarAceiteVigente(
  usuarioId: string,
  empresaId: string,
): Promise<boolean> {
  const cacheKey = getCacheKey(usuarioId, empresaId);

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      const status = await consultarStatusAceite(usuarioId, empresaId);
      return status.every((s) => s.vigente);
    },
    TERMOS_CACHE_TTL,
  );
}

/**
 * Verifica se QUALQUER admin/owner da empresa aceitou todas as versões vigentes.
 * Usado para decidir se o redirecionamento para aceite-termos é necessário.
 * Se um admin já aceitou, os demais admins não precisam aceitar novamente.
 */
export async function verificarAceiteVigenteEmpresa(
  empresaId: string,
): Promise<boolean> {
  const cacheKey = getEmpresaCacheKey(empresaId);

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      const adminClient = getDatabaseClient();

      // Para cada tipo de documento, verificar se existe aceite na versão vigente
      // por qualquer usuário da empresa
      for (const tipo of ALL_TIPOS) {
        const versaoVigente = TERMOS_VIGENTES[tipo];

        const { data, error } = await adminClient
          .from("termos_aceite")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("tipo_documento", tipo)
          .eq("versao", versaoVigente)
          .limit(1);

        if (error) {
          throw new Error(
            `Erro ao verificar aceite vigente da empresa: ${error.message}`,
          );
        }

        if (!data || data.length === 0) {
          return false;
        }
      }

      return true;
    },
    TERMOS_CACHE_TTL,
  );
}

/**
 * Consulta o status de aceite de cada documento para um admin.
 */
export async function consultarStatusAceite(
  usuarioId: string,
  empresaId: string,
): Promise<TermoAceiteStatus[]> {
  const adminClient = getDatabaseClient();

  const { data, error } = await adminClient
    .from("termos_aceite")
    .select("tipo_documento, versao, accepted_at")
    .eq("usuario_id", usuarioId)
    .eq("empresa_id", empresaId)
    .order("accepted_at", { ascending: false });

  if (error) {
    throw new Error(
      `Erro ao consultar status de aceite: ${error.message}`,
    );
  }

  // Para cada tipo de documento, pegar o aceite mais recente
  const latestByTipo = new Map<
    string,
    { versao: string; accepted_at: string }
  >();

  for (const row of data ?? []) {
    if (!latestByTipo.has(row.tipo_documento)) {
      latestByTipo.set(row.tipo_documento, {
        versao: row.versao,
        accepted_at: row.accepted_at,
      });
    }
  }

  return ALL_TIPOS.map((tipo) => {
    const latest = latestByTipo.get(tipo);
    const versaoVigente = TERMOS_VIGENTES[tipo];

    return {
      tipoDocumento: tipo,
      label: TERMOS_LABELS[tipo],
      aceito: !!latest,
      versaoAceita: latest?.versao ?? null,
      versaoVigente,
      vigente: latest?.versao === versaoVigente,
    };
  });
}

/**
 * Consulta o histórico completo de aceites de um tenant.
 */
export async function consultarHistoricoAceites(
  empresaId: string,
): Promise<TermoAceite[]> {
  const adminClient = getDatabaseClient();

  const { data, error } = await adminClient
    .from("termos_aceite")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("accepted_at", { ascending: false });

  if (error) {
    throw new Error(
      `Erro ao consultar histórico de aceites: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    usuarioId: row.usuario_id,
    empresaId: row.empresa_id,
    tipoDocumento: row.tipo_documento as TipoDocumentoLegal,
    versao: row.versao,
    ipAddress: typeof row.ip_address === "string" ? row.ip_address : null,
    userAgent: row.user_agent,
    acceptedAt: row.accepted_at,
  }));
}

/**
 * Invalida o cache de aceite de um admin.
 */
export async function invalidarCacheAceite(
  usuarioId: string,
  empresaId: string,
): Promise<void> {
  await cacheService.del(getCacheKey(usuarioId, empresaId));
}
