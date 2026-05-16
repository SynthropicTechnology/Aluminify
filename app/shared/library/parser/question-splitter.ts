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
const EMPTY_LINK_RE = /^\s*Link\s*:\s*$/i;
const DIFICULDADE_RE = /^\s*Dificuldade\s*:\s*(.*?)\s*$/i;
const EMPTY_DIFICULDADE_RE = /^\s*Dificuldade\s*:\s*$/i;

type GabaritoMap = Map<number, LetraGabarito>;

interface RawQuestion {
  numero: number;
  paragraphs: RawParagraph[];
}

function isQuestionHeader(text: string): boolean {
  const numbered = QUESTION_START_RE.exec(text);
  if (numbered) {
    return INSTITUICAO_ANO_RE.test(text);
  }
  return QUESTION_LABEL_RE.test(text);
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
  let lastQuestionNum = 0;
  let currentHasAlternatives = false;

  for (const para of paragraphs) {
    const text = plainText(para);

    if (currentQuestion && ALTERNATIVE_RE.test(text)) {
      currentHasAlternatives = true;
    }

    let match = QUESTION_START_RE.exec(text);
    if (!match) match = QUESTION_LABEL_RE.exec(text);

    if (match && !ALTERNATIVE_RE.test(text)) {
      const num = parseInt(match[1], 10);
      const isSequential = num === lastQuestionNum + 1 || lastQuestionNum === 0;
      const prevComplete = !currentQuestion || currentHasAlternatives;
      if (isSequential && prevComplete) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = { numero: num, paragraphs: [para] };
        currentHasAlternatives = false;
        lastQuestionNum = num;
        continue;
      }
      if (isSequential && currentQuestion && isQuestionHeader(text)) {
        questions.push(currentQuestion);
        currentQuestion = { numero: num, paragraphs: [para] };
        currentHasAlternatives = false;
        lastQuestionNum = num;
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
      textAccum += formatRunText(run);
    }
  }

  if (textAccum.trim()) {
    blocks.push(buildTextBlock(textAccum.trim(), hasMathInline));
  }

  return blocks;
}

function paragraphToInlineText(
  para: RawParagraph,
  ctx: ParseContext,
  questaoNum: number,
): string {
  let text = "";

  for (const run of para.runs) {
    if (run.ommlNode) {
      const latex = ommlToLatex(run.ommlNode, ctx, questaoNum);
      if (latex) {
        text += ` $${latex}$ `;
      }
    } else {
      text += formatRunText(run);
    }
  }

  return text.replace(/\s+/g, " ").trim();
}

function formatRunText(run: { text: string; bold?: boolean; italic?: boolean }): string {
  if (!run.text || (!run.bold && !run.italic)) return run.text;

  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(run.text);
  const leading = match?.[1] ?? "";
  let content = match?.[2] ?? run.text;
  const trailing = match?.[3] ?? "";
  if (!content) return run.text;

  if (run.italic) content = `_${content}_`;
  if (run.bold) content = `**${content}**`;

  return `${leading}${content}${trailing}`;
}

function stripAlternativeLabel(text: string): string {
  return text.replace(ALTERNATIVE_RE, "$2").trim();
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
    } else if (altStart !== -1 && isAlternativeTerminator(text)) {
      break;
    } else if (altStart !== -1 && hasParagraphMedia(paragraphs[i])) {
      altEnd = i;
    } else if (altStart !== -1 && text.trim() && !hasParagraphMedia(paragraphs[i])) {
      break;
    }
  }

  if (altStart === -1) {
    const mediaOnly = parseMediaOnlyAlternatives(paragraphs, ctx, questaoNum);
    if (mediaOnly) return mediaOnly;
    return { before: paragraphs, alternatives: [], after: [] };
  }

  const before = paragraphs.slice(0, altStart);
  const altParas = paragraphs.slice(altStart, altEnd + 1);
  const after = paragraphs.slice(altEnd + 1);

  const alternatives: Array<{ letra: LetraAlternativa; texto: string; imagemPath?: string | null }> = [];

  for (let i = 0; i < altParas.length; i++) {
    const p = altParas[i];
    const text = plainText(p);
    const match = ALTERNATIVE_RE.exec(text);
    if (!match) continue;

    const letra = match[1].toLowerCase() as LetraAlternativa;
    const continuation: RawParagraph[] = [];
    for (let j = i + 1; j < altParas.length; j++) {
      const nextText = plainText(altParas[j]);
      if (ALTERNATIVE_RE.test(nextText)) break;
      continuation.push(altParas[j]);
    }

    const texto = [
      stripAlternativeLabel(paragraphToInlineText(p, ctx, questaoNum)),
      ...continuation.map((paragraph) => paragraphToInlineText(paragraph, ctx, questaoNum)),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const imagemPath = extractAlternativeImagePath(
      [p, ...continuation],
      ctx,
      questaoNum,
      letra,
    );

    alternatives.push({ letra, texto, imagemPath });
  }

  return { before, alternatives, after };
}

function hasParagraphMedia(paragraph: RawParagraph): boolean {
  return paragraph.runs.some((run) => run.imageRId || run.ommlNode);
}

function parseMediaOnlyAlternatives(
  paragraphs: RawParagraph[],
  ctx: ParseContext,
  questaoNum: number,
): {
  before: RawParagraph[];
  alternatives: Array<{ letra: LetraAlternativa; texto: string; imagemPath?: string | null }>;
  after: RawParagraph[];
} | null {
  for (let i = 0; i < paragraphs.length; i++) {
    if (!hasParagraphMedia(paragraphs[i])) continue;

    const mediaParagraphs: RawParagraph[] = [];
    let j = i;
    while (j < paragraphs.length && hasParagraphMedia(paragraphs[j])) {
      mediaParagraphs.push(paragraphs[j]);
      j++;
    }

    if (mediaParagraphs.length >= 2 && mediaParagraphs.length <= 5) {
      const letters = ["a", "b", "c", "d", "e"] as const;
      return {
        before: paragraphs.slice(0, i),
        alternatives: mediaParagraphs.map((paragraph, idx) => ({
          letra: letters[idx],
          texto: "",
          imagemPath: extractAlternativeImagePath(
            [paragraph],
            ctx,
            questaoNum,
            letters[idx],
          ),
        })),
        after: paragraphs.slice(j),
      };
    }
  }

  return null;
}

function isAlternativeTerminator(text: string): boolean {
  const trimmed = text.trim();
  return (
    RESPOSTA_INLINE_RE.test(trimmed) ||
    RESPOSTA_HEADER_RE.test(trimmed) ||
    RESPOSTA_ANULADA_RE.test(trimmed) ||
    RESOLUCAO_RE.test(trimmed) ||
    LINK_RE.test(trimmed) ||
    EMPTY_LINK_RE.test(trimmed) ||
    DIFICULDADE_RE.test(trimmed) ||
    EMPTY_DIFICULDADE_RE.test(trimmed) ||
    QUESTION_START_RE.test(trimmed) ||
    QUESTION_LABEL_RE.test(trimmed)
  );
}

function extractAlternativeImagePath(
  paragraphs: RawParagraph[],
  ctx: ParseContext,
  questaoNum: number,
  letra: LetraAlternativa,
): string | null {
  for (const paragraph of paragraphs) {
    for (const run of paragraph.runs) {
      if (run.imageRId) {
        const imgData = ctx.images.get(run.imageRId);
        if (imgData) {
          ctx.imageCounter++;
          const ext = ctx.imageExtensions.get(run.imageRId) ?? "png";
          const key = `q${questaoNum}_alt_${letra}_img${ctx.imageCounter}.${ext}`;
          ctx.images.set(key, imgData);
          return `pending:${key}`;
        }
      }
    }
  }
  return null;
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

function normalizeDificuldade(raw: string): DificuldadeQuestao | null {
  const lower = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!lower || lower === "n/d" || lower === "nd" || lower === "-") return null;
  if (lower.includes("dificil")) return "dificil";
  if (lower.includes("facil")) return "facil";
  if (lower.includes("medio") || lower.includes("media")) return "medio";
  if (lower.startsWith("d")) return "dificil";
  if (lower.startsWith("f")) return "facil";
  if (lower.startsWith("m")) return "medio";
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
    if (EMPTY_LINK_RE.test(text)) {
      cleaned.splice(i, 1);
      continue;
    }

    const difMatch = DIFICULDADE_RE.exec(text);
    if (difMatch) {
      dificuldade = normalizeDificuldade(difMatch[1]);
      cleaned.splice(i, 1);
      continue;
    }
    if (EMPTY_DIFICULDADE_RE.test(text)) {
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
