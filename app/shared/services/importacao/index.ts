import { getDatabaseClient } from "@/app/shared/core/database/database";
import { ImportacaoRepositoryImpl } from "./importacao.repository";
import { QuestaoRepositoryImpl } from "@/app/shared/services/questoes/questao.repository";
import { ListaRepositoryImpl } from "@/app/shared/services/listas/lista.repository";
import { ImportacaoService } from "./importacao.service";

let _importacaoService: ImportacaoService | null = null;

function getService() {
  if (!_importacaoService) {
    const client = getDatabaseClient();
    const importacaoRepo = new ImportacaoRepositoryImpl(client);
    const questaoRepo = new QuestaoRepositoryImpl(client);
    const listaRepo = new ListaRepositoryImpl(client);
    _importacaoService = new ImportacaoService(
      importacaoRepo,
      questaoRepo,
      listaRepo,
      client,
    );
  }
  return _importacaoService;
}

export const importacaoService = new Proxy({} as ImportacaoService, {
  get(_target, prop) {
    return getService()[prop as keyof ImportacaoService];
  },
});

export * from "./importacao.service";
export * from "./importacao.repository";
export * from "./importacao.validation";
export * from "./errors";
