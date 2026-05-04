import type { QuestaoParseadaSerializada, ParseWarning } from "./types";
import { readDocx } from "./docx-reader";
import { splitQuestions } from "./question-splitter";

export class DocxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxParseError";
  }
}

export interface DocxParseResult {
  questoes: QuestaoParseadaSerializada[];
  warnings: ParseWarning[];
  images: Map<string, Buffer>;
}

export async function parseDocx(buffer: Buffer): Promise<DocxParseResult> {
  let readResult;
  try {
    readResult = await readDocx(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new DocxParseError(`Falha ao ler arquivo .docx: ${msg}`);
  }

  const ctx = {
    warnings: [] as ParseWarning[],
    images: readResult.images,
    imageExtensions: readResult.imageExtensions,
    imageCounter: 0,
  };

  const questoes = splitQuestions(readResult.paragraphs, readResult.images, ctx);

  return {
    questoes,
    warnings: ctx.warnings,
    images: ctx.images,
  };
}

export type { QuestaoParseadaSerializada, ParseWarning, DocxParseResult as ParseResult };
