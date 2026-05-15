import type {
  ContentBlock,
  LetraGabarito,
} from "@/app/shared/types/entities/questao";
import type {
  QuestaoParseadaSerializada,
  ParseWarning,
} from "@/app/shared/types/entities/importacao";

export type { ContentBlock, LetraGabarito, QuestaoParseadaSerializada, ParseWarning };

export interface RawRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  imageRId?: string;
  imageWidthPx?: number;
  imageHeightPx?: number;
  ommlNode?: Record<string, unknown>;
  ommlText?: string;
}

export interface RawParagraph {
  styleId?: string;
  numId?: number;
  numLevel?: number;
  runs: RawRun[];
}

export interface ImageEntry {
  rId: string;
  contentType: string;
  data: Buffer;
  extension: string;
}

export interface ParseContext {
  warnings: ParseWarning[];
  images: Map<string, Buffer>;
  imageExtensions: Map<string, string>;
  imageCounter: number;
}

export function plainText(para: RawParagraph): string {
  return para.runs.reduce((text, run) => {
    const next = run.ommlText ?? run.text;
    if (!next) return text;
    return `${text}${shouldInsertSpace(text, next) ? " " : ""}${next}`;
  }, "");
}

function shouldInsertSpace(current: string, next: string): boolean {
  if (!current || !next) return false;
  if (/\s$/.test(current) || /^\s/.test(next)) return false;

  const last = current[current.length - 1];
  const first = next[0];

  if (/[A-Za-zÀ-ÿ0-9\)]/.test(last) && /[A-Za-zÀ-ÿ0-9\(]/.test(first)) {
    return true;
  }

  return last === "." && first === "(";
}
