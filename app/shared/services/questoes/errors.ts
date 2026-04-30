export class QuestaoNotFoundError extends Error {
  constructor(id?: string) {
    super(
      id ? `Questao com id ${id} nao encontrada` : "Questao nao encontrada",
    );
    this.name = "QuestaoNotFoundError";
  }
}

export class QuestaoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestaoValidationError";
  }
}
