export class ImportacaoNotFoundError extends Error {
  constructor(id?: string) {
    super(
      id
        ? `Importacao com id ${id} nao encontrada`
        : "Importacao nao encontrada",
    );
    this.name = "ImportacaoNotFoundError";
  }
}

export class ImportacaoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportacaoValidationError";
  }
}
