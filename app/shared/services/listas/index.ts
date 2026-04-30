import { getDatabaseClient } from "@/app/shared/core/database/database";
import { ListaRepositoryImpl } from "./lista.repository";
import { RespostaRepositoryImpl } from "./resposta.repository";
import { ListaService } from "./lista.service";
import { RespostaService } from "./resposta.service";

let _listaService: ListaService | null = null;
let _respostaService: RespostaService | null = null;

function getServices() {
  if (!_listaService || !_respostaService) {
    const client = getDatabaseClient();
    const listaRepo = new ListaRepositoryImpl(client);
    const respostaRepo = new RespostaRepositoryImpl(client);
    _listaService = new ListaService(listaRepo, respostaRepo);
    _respostaService = new RespostaService(respostaRepo, listaRepo);
  }
  return { listaService: _listaService, respostaService: _respostaService };
}

export const listaService = new Proxy({} as ListaService, {
  get(_target, prop) {
    return getServices().listaService[prop as keyof ListaService];
  },
});

export const respostaService = new Proxy({} as RespostaService, {
  get(_target, prop) {
    return getServices().respostaService[prop as keyof RespostaService];
  },
});

export * from "./lista.service";
export * from "./resposta.service";
export * from "./lista.repository";
export * from "./resposta.repository";
export * from "./lista.validation";
export * from "./errors";
