import type {
  RawParagraph,
  ParseContext,
  ContentBlock,
  QuestaoParseadaSerializada,
  LetraGabarito,
} from "./types";
import { plainText } from "./types";
import type { LetraAlternativa } from "@/app/shared/types/entities/questao";
import { ommlToLatex } from "./omml-to-latex";

const QUESTION_START_RE = /^\s*(\d+)\s*[.)]\s*/;
const QUESTION_LABEL_RE = /^\s*(?:QUEST[ÃA]O|Quest[ãa]o)\s+(\d+)/i;
const ALTERNATIVE_RE = /^\s*([a-eA-E])\s*[.)]\s*(.*)/s;
const GABARITO_HEADER_RE = /^\s*(?:GABARITO|Gabarito)\s*:?\s*$/i;
const GABARITO_ENTRY_RE = /(\d+)\s*[-–:.)\s]+\s*([A-Ea-e])/g;
const RESOLUCAO_RE = /^\s*(?:RESOLU[ÇC][ÃA]O|Resolu[çc][ãa]o)\s*:?\s*$/i;

type GabaritoMap = Map<number, LetraGabarito>;

interface RawQuestion {
  numero: number;
  paragraphs: RawParagraph[];
}

function extractGabarito(
  paragraphs: RawParagraph[],
  _ctx: ParseContext,
): { gabarito: GabaritoMap; contentParagraphs: RawParagraph[] } {
  const gabarito: GabaritoMap = new Map();
  let gabaritoStart = -1;

  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const text = plainText(paragraphs[i]).trim();
    if (GABARITO_HEADER_RE.test(text)) {
      gabaritoStart = i;
      break;
    }
  }

  if (gabaritoStart === -1) {
    for (let i = paragraphs.length - 1; i >= Math.max(0, paragraphs.length - 30); i--) {
      const text = plainText(paragraphs[i]).trim().toUpperCase();
      if (text.includes("GABARITO")) {
        gabaritoStart = i;
        break;
      }
    }
  }

  if (gabaritoStart >= 0) {
    for (let i = gabaritoStart; i < paragraphs.length; i++) {
      const text = plainText(paragraphs[i]);
      let match;
      const regex = new RegExp(GABARITO_ENTRY_RE.source, "g");
      while ((match = regex.exec(text)) !== null) {
        const num = parseInt(match[1], 10);
        const letra = match[2].toUpperCase() as LetraGabarito;
        gabarito.set(num, letra);
      }
    }

    return {
      gabarito,
      contentParagraphs: paragraphs.slice(0, gabaritoStart),
    };
  }

  return { gabarito, contentParagraphs: paragraphs };
}

function detectQuestionBoundaries(paragraphs: RawParagraph[]): RawQuestion[] {
  const questions: RawQuestion[] = [];
  let currentQuestion: RawQuestion | null = null;

  for (const para of paragraphs) {
    const text = plainText(para);

    let match = QUESTION_START_RE.exec(text);
    if (!match) match = QUESTION_LABEL_RE.exec(text);

    if (match) {
      const num = parseInt(match[1], 10);
      const isAlternative = ALTERNATIVE_RE.test(text);

      if (!isAlternative) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = { numero: num, paragraphs: [para] };
        continue;
      }
    }

    if (currentQuestion) {
      currentQuestion.paragraphs.push(para);
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}

function paragraphToContentBlocks(
  para: RawParagraph,
  ctx: ParseContext,
  questaoNum: number,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let textAccum = "";

  for (const run of para.runs) {
    if (run.ommlNode) {
      if (textAccum.trim()) {
        blocks.push({ type: "paragraph", text: textAccum.trim() });
        textAccum = "";
      }
      const latex = ommlToLatex(run.ommlNode, ctx, questaoNum);
      if (latex) {
        blocks.push({ type: "math", latex });
      }
    } else if (run.imageRId) {
      if (textAccum.trim()) {
        blocks.push({ type: "paragraph", text: textAccum.trim() });
        textAccum = "";
      }
      const imgData = ctx.images.get(run.imageRId);
      if (imgData) {
        ctx.imageCounter++;
        const key = `q${questaoNum}_img${ctx.imageCounter}.png`;
        ctx.images.set(key, imgData);
        blocks.push({
          type: "image",
          storagePath: `pending:${key}`,
        });
      }
    } else {
      textAccum += run.text;
    }
  }

  if (textAccum.trim()) {
    blocks.push({ type: "paragraph", text: textAccum.trim() });
  }

  return blocks;
}

function parseAlternatives(
  paragraphs: RawParagraph[],
  ctx: ParseContext,
  questaoNum: number,
): {
  before: RawParagraph[];
  alternatives: Array<{ letra: LetraAlternativa; texto: string; imagemPath?: string | null }>;
  after: RawParagraph[];
} {
  let altStart = -1;
  let altEnd = -1;

  for (let i = 0; i < paragraphs.length; i++) {
    const text = plainText(paragraphs[i]);
    if (ALTERNATIVE_RE.test(text)) {
      if (altStart === -1) altStart = i;
      altEnd = i;
    } else if (altStart !== -1 && altEnd === i - 1) {
      break;
    }
  }

  if (altStart === -1) {
    return { before: paragraphs, alternatives: [], after: [] };
  }

  const before = paragraphs.slice(0, altStart);
  const altParas = paragraphs.slice(altStart, altEnd + 1);
  const after = paragraphs.slice(altEnd + 1);

  const alternatives: Array<{ letra: LetraAlternativa; texto: string; imagemPath?: string | null }> = [];

  for (const p of altParas) {
    const text = plainText(p);
    const match = ALTERNATIVE_RE.exec(text);
    if (!match) continue;

    const letra = match[1].toLowerCase() as LetraAlternativa;
    const texto = match[2].trim();

    let imagemPath: string | null = null;
    for (const run of p.runs) {
      if (run.imageRId) {
        const imgData = ctx.images.get(run.imageRId);
        if (imgData) {
          ctx.imageCounter++;
          const key = `q${questaoNum}_alt_${letra}_img${ctx.imageCounter}.png`;
          ctx.images.set(key, imgData);
          imagemPath = `pending:${key}`;
        }
        break;
      }
    }

    alternatives.push({ letra, texto, imagemPath });
  }

  return { before, alternatives, after };
}

function splitEnunciadoTextoBase(
  paragraphs: RawParagraph[],
  ctx: ParseContext,
  questaoNum: number,
): { textoBase: ContentBlock[]; enunciado: ContentBlock[] } {
  if (paragraphs.length === 0) {
    return { textoBase: [], enunciado: [] };
  }

  if (paragraphs.length === 1) {
    return {
      textoBase: [],
      enunciado: paragraphs.flatMap((p) =>
        paragraphToContentBlocks(p, ctx, questaoNum),
      ),
    };
  }

  let enunciadoStart = paragraphs.length - 1;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const text = plainText(paragraphs[i]).trim();
    if (text.endsWith("?") || text.endsWith(":")) {
      enunciadoStart = i;
      break;
    }
  }

  if (enunciadoStart === paragraphs.length - 1 && paragraphs.length > 2) {
    enunciadoStart = paragraphs.length - 1;
  }

  const textoBaseParagraphs = paragraphs.slice(0, enunciadoStart);
  const enunciadoParagraphs = paragraphs.slice(enunciadoStart);

  return {
    textoBase: textoBaseParagraphs.flatMap((p) =>
      paragraphToContentBlocks(p, ctx, questaoNum),
    ),
    enunciado: enunciadoParagraphs.flatMap((p) =>
      paragraphToContentBlocks(p, ctx, questaoNum),
    ),
  };
}

function parseResolucao(
  paragraphs: RawParagraph[],
  ctx: ParseContext,
  questaoNum: number,
): { resolucao: ContentBlock[]; remaining: RawParagraph[] } {
  let resolStart = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const text = plainText(paragraphs[i]).trim();
    if (RESOLUCAO_RE.test(text)) {
      resolStart = i;
      break;
    }
  }

  if (resolStart === -1) {
    return { resolucao: [], remaining: paragraphs };
  }

  const resolParagraphs = paragraphs.slice(resolStart + 1);
  const remaining = paragraphs.slice(0, resolStart);

  return {
    resolucao: resolParagraphs.flatMap((p) =>
      paragraphToContentBlocks(p, ctx, questaoNum),
    ),
    remaining,
  };
}

export function splitQuestions(
  paragraphs: RawParagraph[],
  images: Map<string, Buffer>,
  ctx: ParseContext,
): QuestaoParseadaSerializada[] {
  ctx.images = images;

  const { gabarito, contentParagraphs } = extractGabarito(paragraphs, ctx);
  const rawQuestions = detectQuestionBoundaries(contentParagraphs);

  if (rawQuestions.length === 0) {
    ctx.warnings.push({
      code: "NO_QUESTIONS_FOUND",
      message: "Nenhuma questao encontrada no documento",
    });
    return [];
  }

  const result: QuestaoParseadaSerializada[] = [];

  for (const rq of rawQuestions) {
    const { before, alternatives, after } = parseAlternatives(
      rq.paragraphs,
      ctx,
      rq.numero,
    );

    if (alternatives.length === 0) {
      ctx.warnings.push({
        questao: rq.numero,
        code: "NO_ALTERNATIVES",
        message: `Questao ${rq.numero}: nenhuma alternativa encontrada`,
      });
    } else if (alternatives.length < 4) {
      ctx.warnings.push({
        questao: rq.numero,
        code: "FEW_ALTERNATIVES",
        message: `Questao ${rq.numero}: apenas ${alternatives.length} alternativa(s) encontrada(s)`,
      });
    }

    const { resolucao, remaining: afterResolucao } = parseResolucao(
      after,
      ctx,
      rq.numero,
    );

    const contentBefore = [...before];
    if (afterResolucao.length > 0) {
      contentBefore.push(...afterResolucao);
    }

    const { textoBase, enunciado } = splitEnunciadoTextoBase(
      contentBefore,
      ctx,
      rq.numero,
    );

    const gabaritoLetra = gabarito.get(rq.numero);
    if (!gabaritoLetra) {
      ctx.warnings.push({
        questao: rq.numero,
        code: "MISSING_GABARITO",
        message: `Questao ${rq.numero}: gabarito nao encontrado, usando "A" como padrao`,
      });
    }

    result.push({
      numero: rq.numero,
      instituicao: null,
      ano: null,
      dificuldade: null,
      textoBase,
      enunciado,
      alternativas: alternatives,
      gabarito: gabaritoLetra ?? "A",
      resolucao,
    });
  }

  return result;
}
