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
  return para.runs.map((r) => r.ommlText ?? r.text).join("");
}
