export class ListaNotFoundError extends Error {
  constructor(id?: string) {
    super(id ? `Lista com id ${id} nao encontrada` : "Lista nao encontrada");
    this.name = "ListaNotFoundError";
  }
}

export class ListaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListaValidationError";
  }
}

export class RespostaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RespostaValidationError";
  }
}
