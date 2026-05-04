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
const ALTERNATIVE_RE = /^\s*\(?([a-eA-E])\s*[.)]\s*(.*)/s;
const GABARITO_HEADER_RE = /^\s*(?:GABARITO|Gabarito)\s*:?\s*$/i;
const GABARITO_ENTRY_RE = /(\d+)\s*[-–:.)\s]+\s*([A-Ea-e])/g;
const RESOLUCAO_RE = /^\s*(?:RESOLU[ÇC][ÃA]O|Resolu[çc][ãa]o)\s*:?\s*$/i;
const RESPOSTA_INLINE_RE = /^\s*Resposta\s*:\s*\[([A-Ea-e])\]/i;
const RESPOSTA_HEADER_RE = /^\s*Resposta\s*:\s*$/i;
const RESPOSTA_LETTER_RE = /^\s*\[([A-Ea-e])\]\s*$/;
const RESPOSTA_ANULADA_RE = /^\s*Resposta\s*:\s*ANULADA/i;
const RESPOSTA_ANULADA_STANDALONE_RE = /^\s*(?:ANULADA|anulada)\s*$/;
const INSTITUICAO_ANO_RE = /\(([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s\-\/]*?)\s+(\d{4})\)/;
const LINK_RE = /^\s*Link\s*:\s*(https?:\/\/\S+)/i;
const DIFICULDADE_RE = /^\s*Dificuldade\s*:\s*(f[áa]cil|m[ée]di[oa]|dif[íi]cil)\s*$/i;

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
  let hasMathInline = false;

  for (const run of para.runs) {
    if (run.ommlNode) {
      const latex = ommlToLatex(run.ommlNode, ctx, questaoNum);
      if (latex) {
        hasMathInline = true;
        textAccum += ` $${latex}$ `;
      }
    } else if (run.imageRId) {
      if (textAccum.trim()) {
        blocks.push(buildTextBlock(textAccum.trim(), hasMathInline));
        textAccum = "";
        hasMathInline = false;
      }
      const imgData = ctx.images.get(run.imageRId);
      if (imgData) {
        ctx.imageCounter++;
        const ext = ctx.imageExtensions.get(run.imageRId) ?? "png";
        const key = `q${questaoNum}_img${ctx.imageCounter}.${ext}`;
        ctx.images.set(key, imgData);
        blocks.push({
          type: "image",
          storagePath: `pending:${key}`,
          width: run.imageWidthPx,
          height: run.imageHeightPx,
        });
      }
    } else {
      textAccum += run.text;
    }
  }

  if (textAccum.trim()) {
    blocks.push(buildTextBlock(textAccum.trim(), hasMathInline));
  }

  return blocks;
}

function buildTextBlock(text: string, hasMath: boolean): ContentBlock {
  if (hasMath) {
    const withoutMath = text.replace(/\$[^$]*\$/g, "").trim();
    if (!withoutMath) {
      const allLatex = [...text.matchAll(/\$([^$]*)\$/g)]
        .map((m) => m[1])
        .join(" ");
      return { type: "math", latex: allLatex };
    }
  }
  return { type: "paragraph", text };
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
          const ext = ctx.imageExtensions.get(run.imageRId) ?? "png";
          const key = `q${questaoNum}_alt_${letra}_img${ctx.imageCounter}.${ext}`;
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
  const nonEmpty = paragraphs.filter((p) => {
    const text = plainText(p).trim();
    return text.length > 0 || p.runs.some((r) => r.imageRId || r.ommlNode);
  });

  if (nonEmpty.length === 0) {
    return { textoBase: [], enunciado: [] };
  }

  if (nonEmpty.length <= 2) {
    return {
      textoBase: [],
      enunciado: nonEmpty.flatMap((p) =>
        paragraphToContentBlocks(p, ctx, questaoNum),
      ),
    };
  }

  let enunciadoStart = -1;
  for (let i = nonEmpty.length - 1; i >= 0; i--) {
    const text = plainText(nonEmpty[i]).trim();
    if (text.endsWith("?") || text.endsWith(":")) {
      enunciadoStart = i;
      break;
    }
  }

  if (enunciadoStart === -1) {
    return {
      textoBase: [],
      enunciado: nonEmpty.flatMap((p) =>
        paragraphToContentBlocks(p, ctx, questaoNum),
      ),
    };
  }

  const textoBaseParagraphs = nonEmpty.slice(0, enunciadoStart);
  const enunciadoParagraphs = nonEmpty.slice(enunciadoStart);

  return {
    textoBase: textoBaseParagraphs.flatMap((p) =>
      paragraphToContentBlocks(p, ctx, questaoNum),
    ),
    enunciado: enunciadoParagraphs.flatMap((p) =>
      paragraphToContentBlocks(p, ctx, questaoNum),
    ),
  };
}

function extractInlineGabarito(
  paragraphs: RawParagraph[],
  ctx: ParseContext,
  questaoNum: number,
): {
  gabarito: LetraGabarito | null;
  resolucao: ContentBlock[];
  remaining: RawParagraph[];
} {
  for (let i = 0; i < paragraphs.length; i++) {
    const text = plainText(paragraphs[i]).trim();

    if (RESPOSTA_ANULADA_RE.test(text)) {
      ctx.warnings.push({
        questao: questaoNum,
        code: "ANULADA",
        message: `Questao ${questaoNum}: marcada como ANULADA`,
      });
      const resolParagraphs = paragraphs.slice(i + 1);
      return {
        gabarito: null,
        resolucao: resolParagraphs.flatMap((p) =>
          paragraphToContentBlocks(p, ctx, questaoNum),
        ),
        remaining: paragraphs.slice(0, i),
      };
    }

    const inlineMatch = RESPOSTA_INLINE_RE.exec(text);
    if (inlineMatch) {
      const letra = inlineMatch[1].toUpperCase() as LetraGabarito;
      const resolParagraphs = paragraphs.slice(i + 1);
      return {
        gabarito: letra,
        resolucao: resolParagraphs.flatMap((p) =>
          paragraphToContentBlocks(p, ctx, questaoNum),
        ),
        remaining: paragraphs.slice(0, i),
      };
    }

    if (RESPOSTA_HEADER_RE.test(text) && i + 1 < paragraphs.length) {
      const nextText = plainText(paragraphs[i + 1]).trim();

      if (RESPOSTA_ANULADA_STANDALONE_RE.test(nextText)) {
        ctx.warnings.push({
          questao: questaoNum,
          code: "ANULADA",
          message: `Questao ${questaoNum}: marcada como ANULADA`,
        });
        const resolParagraphs = paragraphs.slice(i + 2);
        return {
          gabarito: null,
          resolucao: resolParagraphs.flatMap((p) =>
            paragraphToContentBlocks(p, ctx, questaoNum),
          ),
          remaining: paragraphs.slice(0, i),
        };
      }

      const letterMatch = RESPOSTA_LETTER_RE.exec(nextText);
      if (letterMatch) {
        const letra = letterMatch[1].toUpperCase() as LetraGabarito;
        const resolParagraphs = paragraphs.slice(i + 2);
        return {
          gabarito: letra,
          resolucao: resolParagraphs.flatMap((p) =>
            paragraphToContentBlocks(p, ctx, questaoNum),
          ),
          remaining: paragraphs.slice(0, i),
        };
      }
    }
  }

  return { gabarito: null, resolucao: [], remaining: paragraphs };
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

function extractMetadataFromBlocks(
  blocks: ContentBlock[],
): { instituicao: string | null; ano: number | null } {
  const idx = blocks.findIndex((b) => b.type === "paragraph");
  if (idx === -1) return { instituicao: null, ano: null };

  const block = blocks[idx];
  if (block.type !== "paragraph") return { instituicao: null, ano: null };

  let text = block.text;
  let instituicao: string | null = null;
  let ano: number | null = null;

  const numMatch = QUESTION_START_RE.exec(text);
  if (numMatch) {
    text = text.slice(numMatch[0].length);
  }
  const labelMatch = !numMatch ? QUESTION_LABEL_RE.exec(text) : null;
  if (labelMatch) {
    text = text.slice(labelMatch[0].length);
  }

  const metaMatch = INSTITUICAO_ANO_RE.exec(text);
  if (metaMatch && metaMatch.index < 20) {
    instituicao = metaMatch[1].trim();
    ano = parseInt(metaMatch[2], 10);
    text = (
      text.slice(0, metaMatch.index) +
      text.slice(metaMatch.index + metaMatch[0].length)
    ).trim();
  } else {
    text = text.trim();
  }

  if (!text) {
    blocks.splice(idx, 1);
  } else {
    blocks[idx] = { type: "paragraph", text };
  }

  return { instituicao, ano };
}

type DificuldadeQuestao = "facil" | "medio" | "dificil";

function normalizeDificuldade(raw: string): DificuldadeQuestao {
  const lower = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (lower.startsWith("f")) return "facil";
  if (lower.startsWith("d")) return "dificil";
  return "medio";
}

function extractTrailingMetadata(
  resolucao: ContentBlock[],
): {
  resolucao: ContentBlock[];
  resolucaoVideoUrl: string | null;
  dificuldade: DificuldadeQuestao | null;
} {
  let resolucaoVideoUrl: string | null = null;
  let dificuldade: DificuldadeQuestao | null = null;

  const cleaned = [...resolucao];

  for (let i = cleaned.length - 1; i >= 0; i--) {
    const block = cleaned[i];
    if (block.type !== "paragraph") break;
    const text = block.text.trim();
    if (!text) {
      cleaned.splice(i, 1);
      continue;
    }

    const linkMatch = LINK_RE.exec(text);
    if (linkMatch) {
      resolucaoVideoUrl = linkMatch[1];
      cleaned.splice(i, 1);
      continue;
    }

    const difMatch = DIFICULDADE_RE.exec(text);
    if (difMatch) {
      dificuldade = normalizeDificuldade(difMatch[1]);
      cleaned.splice(i, 1);
      continue;
    }

    break;
  }

  return { resolucao: cleaned, resolucaoVideoUrl, dificuldade };
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
        code: "SKIPPED_NO_ALTERNATIVES",
        message: `Questao ${rq.numero}: nenhuma alternativa encontrada, ignorada (possivel falso positivo)`,
      });
      continue;
    }

    if (alternatives.length < 4) {
      ctx.warnings.push({
        questao: rq.numero,
        code: "FEW_ALTERNATIVES",
        message: `Questao ${rq.numero}: apenas ${alternatives.length} alternativa(s) encontrada(s)`,
      });
    }

    const resolResult = parseResolucao(after, ctx, rq.numero);
    let resolucao = resolResult.resolucao;
    const afterWithoutResol = resolResult.remaining;

    const inlineResult = extractInlineGabarito(afterWithoutResol, ctx, rq.numero);
    const inlineGabarito = inlineResult.gabarito;
    const afterRemaining = inlineResult.remaining;

    if (inlineResult.resolucao.length > 0 && resolucao.length === 0) {
      resolucao = inlineResult.resolucao;
    }

    const trailing = extractTrailingMetadata(resolucao);
    resolucao = trailing.resolucao;

    const contentBefore = [...before];
    if (afterRemaining.length > 0) {
      contentBefore.push(...afterRemaining);
    }

    const { textoBase, enunciado } = splitEnunciadoTextoBase(
      contentBefore,
      ctx,
      rq.numero,
    );

    const meta = textoBase.some((b) => b.type === "paragraph")
      ? extractMetadataFromBlocks(textoBase)
      : extractMetadataFromBlocks(enunciado);

    const gabaritoLetra = inlineGabarito ?? gabarito.get(rq.numero);
    if (!gabaritoLetra) {
      ctx.warnings.push({
        questao: rq.numero,
        code: "MISSING_GABARITO",
        message: `Questao ${rq.numero}: gabarito nao encontrado, usando "A" como padrao`,
      });
    }

    result.push({
      numero: rq.numero,
      instituicao: meta.instituicao,
      ano: meta.ano,
      dificuldade: trailing.dificuldade,
      textoBase,
      enunciado,
      alternativas: alternatives,
      gabarito: gabaritoLetra ?? "A",
      resolucao,
      resolucaoVideoUrl: trailing.resolucaoVideoUrl,
    });
  }

  return result;
}
