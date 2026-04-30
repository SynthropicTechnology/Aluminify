import { getDatabaseClient } from "@/app/shared/core/database/database";
import { QuestaoRepositoryImpl } from "./questao.repository";
import { QuestaoService } from "./questao.service";

let _questaoService: QuestaoService | null = null;

function getQuestaoService(): QuestaoService {
  if (!_questaoService) {
    const databaseClient = getDatabaseClient();
    const repository = new QuestaoRepositoryImpl(databaseClient);
    _questaoService = new QuestaoService(repository);
  }
  return _questaoService;
}

export const questaoService = new Proxy({} as QuestaoService, {
  get(_target, prop) {
    return getQuestaoService()[prop as keyof QuestaoService];
  },
});

export * from "./questao.service";
export * from "./questao.repository";
export * from "./questao.validation";
export * from "./errors";
