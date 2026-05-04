import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { RawParagraph, RawRun } from "./types";

type XNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  htmlEntities: true,
  parseTagValue: false,
  trimValues: false,
  isArray: (tagName) => {
    const arrayTags = new Set([
      "w:p", "w:r", "w:t", "w:drawing", "w:pict",
      "m:oMath", "m:oMathPara", "m:r", "m:e", "m:mr",
      "Relationship",
    ]);
    return arrayTags.has(tagName);
  },
});

const orderedParser = new XMLParser({
  ignoreAttributes: true,
  preserveOrder: true,
  stopNodes: [
    "*.m:oMath", "*.m:oMathPara",
    "*.w:rPr", "*.w:pPr",
    "*.w:drawing", "*.w:pict",
  ],
});

export interface DocxReadResult {
  paragraphs: RawParagraph[];
  images: Map<string, Buffer>;
  imageExtensions: Map<string, string>;
  relMap: Map<string, string>;
}

function getChild(node: XNode, key: string): XNode | undefined {
  const val = node[key];
  if (Array.isArray(val)) return val[0] as XNode;
  if (val && typeof val === "object") return val as XNode;
  return undefined;
}

function getArray(node: XNode, key: string): XNode[] {
  const val = node[key];
  if (Array.isArray(val)) return val as XNode[];
  if (val && typeof val === "object") return [val as XNode];
  return [];
}

function extractMathText(node: XNode): string {
  let result = "";
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_")) continue;
    const val = node[key];
    if (key === "m:t" || key === "#text") {
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        result += String(val);
      } else if (val != null && typeof val === "object" && !Array.isArray(val)) {
        const inner = (val as XNode)["#text"];
        if (inner != null) result += String(inner);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "object" && item !== null) {
          result += extractMathText(item as XNode);
        }
      }
    } else if (typeof val === "object" && val !== null) {
      result += extractMathText(val as XNode);
    }
  }
  return result;
}

function extractTextFromWt(t: unknown): string {
  if (typeof t === "string") return t;
  if (t != null && typeof t === "object") {
    const obj = t as XNode;
    if (obj["#text"] != null) return String(obj["#text"]);
  }
  return "";
}

function emuToPx(emu: number): number {
  return Math.round(emu / 9525);
}

function extractImageExtent(drawing: XNode): { widthPx?: number; heightPx?: number } {
  const inline = getChild(drawing, "wp:inline") ?? getChild(drawing, "wp:anchor");
  if (!inline) return {};
  const extent = getChild(inline, "wp:extent");
  if (!extent) return {};
  const cx = extent["@_cx"];
  const cy = extent["@_cy"];
  const widthPx = cx ? emuToPx(Number(cx)) : undefined;
  const heightPx = cy ? emuToPx(Number(cy)) : undefined;
  return { widthPx, heightPx };
}

function processWRun(r: XNode): RawRun {
  const rPr = getChild(r, "w:rPr");
  const bold = rPr ? (getChild(rPr, "w:b") !== undefined) : false;
  const italic = rPr ? (getChild(rPr, "w:i") !== undefined) : false;

  const texts = getArray(r, "w:t");
  let text = "";
  for (const t of texts) {
    text += extractTextFromWt(t);
  }

  let imageRId: string | undefined;
  let imageWidthPx: number | undefined;
  let imageHeightPx: number | undefined;
  const drawings = getArray(r, "w:drawing");
  for (const drawing of drawings) {
    imageRId = findImageRId(drawing);
    if (imageRId) {
      const dims = extractImageExtent(drawing);
      imageWidthPx = dims.widthPx;
      imageHeightPx = dims.heightPx;
      break;
    }
  }
  if (!imageRId) {
    const picts = getArray(r, "w:pict");
    for (const pict of picts) {
      imageRId = findImageRIdInPict(pict);
      if (imageRId) break;
    }
  }

  return { text, bold, italic, imageRId, imageWidthPx, imageHeightPx };
}

function getChildOrder(orderedPara: unknown[]): string[] {
  const order: string[] = [];
  if (!Array.isArray(orderedPara)) return order;
  for (const child of orderedPara) {
    if (child == null || typeof child !== "object") continue;
    const c = child as Record<string, unknown>;
    for (const key of Object.keys(c)) {
      if (key === ":@" || key === "#text") continue;
      if (key === "w:r" || key === "w:hyperlink" || key === "m:oMath" || key === "m:oMathPara") {
        order.push(key);
      }
    }
  }
  return order;
}

function extractRunsOrdered(
  para: XNode,
  childOrder: string[],
): RawRun[] {
  const runs: RawRun[] = [];
  const wRuns = getArray(para, "w:r");
  const hyperlinks = getArray(para, "w:hyperlink");
  const oMaths = getArray(para, "m:oMath");
  const oMathParas = getArray(para, "m:oMathPara");

  let wIdx = 0;
  let hlIdx = 0;
  let mathIdx = 0;
  let mathParaIdx = 0;

  for (const tag of childOrder) {
    if (tag === "w:r" && wIdx < wRuns.length) {
      runs.push(processWRun(wRuns[wIdx]));
      wIdx++;
    } else if (tag === "w:hyperlink" && hlIdx < hyperlinks.length) {
      const hl = hyperlinks[hlIdx];
      const innerRuns = getArray(hl, "w:r");
      for (const ir of innerRuns) {
        runs.push(processWRun(ir));
      }
      hlIdx++;
    } else if (tag === "m:oMath" && mathIdx < oMaths.length) {
      const om = oMaths[mathIdx];
      runs.push({ text: "", ommlNode: om, ommlText: extractMathText(om) });
      mathIdx++;
    } else if (tag === "m:oMathPara" && mathParaIdx < oMathParas.length) {
      const omp = oMathParas[mathParaIdx];
      const innerMaths = getArray(omp, "m:oMath");
      for (const om of innerMaths) {
        runs.push({ text: "", ommlNode: om, ommlText: extractMathText(om) });
      }
      mathParaIdx++;
    }
  }

  // Append any remaining elements not covered by childOrder (fallback)
  while (wIdx < wRuns.length) {
    runs.push(processWRun(wRuns[wIdx]));
    wIdx++;
  }
  while (hlIdx < hyperlinks.length) {
    const hl = hyperlinks[hlIdx];
    const innerRuns = getArray(hl, "w:r");
    for (const ir of innerRuns) {
      runs.push(processWRun(ir));
    }
    hlIdx++;
  }
  while (mathIdx < oMaths.length) {
    const om = oMaths[mathIdx];
    runs.push({ text: "", ommlNode: om, ommlText: extractMathText(om) });
    mathIdx++;
  }
  while (mathParaIdx < oMathParas.length) {
    const omp = oMathParas[mathParaIdx];
    const innerMaths = getArray(omp, "m:oMath");
    for (const om of innerMaths) {
      runs.push({ text: "", ommlNode: om, ommlText: extractMathText(om) });
    }
    mathParaIdx++;
  }

  return runs;
}

function findImageRId(drawing: XNode): string | undefined {
  const inline = getChild(drawing, "wp:inline") ?? getChild(drawing, "wp:anchor");
  if (!inline) return undefined;
  const graphic = getChild(inline, "a:graphic");
  if (!graphic) return undefined;
  const graphicData = getChild(graphic, "a:graphicData");
  if (!graphicData) return undefined;
  const pic = getChild(graphicData, "pic:pic");
  if (!pic) return undefined;
  const blipFill = getChild(pic, "pic:blipFill");
  if (!blipFill) return undefined;
  const blip = getChild(blipFill, "a:blip");
  if (!blip) return undefined;
  return (blip["@_r:embed"] ?? blip["@_r:link"]) as string | undefined;
}

function findImageRIdInPict(pict: XNode): string | undefined {
  const shape = getChild(pict, "v:shape") ?? getChild(pict, "v:rect");
  if (!shape) return undefined;
  const imagedata = getChild(shape, "v:imagedata");
  if (!imagedata) return undefined;
  return (imagedata["@_r:id"] ?? imagedata["@_o:relid"]) as string | undefined;
}

function getOrderedParagraphs(orderedDoc: unknown[]): unknown[][] {
  if (!Array.isArray(orderedDoc) || orderedDoc.length === 0) return [];

  let docChildren: unknown[] | null = null;
  for (const item of orderedDoc) {
    if (item == null || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key.includes("document")) {
        docChildren = obj[key] as unknown[];
        break;
      }
    }
    if (docChildren) break;
  }
  if (!docChildren) return [];

  let bodyChildren: unknown[] | null = null;
  for (const child of docChildren) {
    if (child == null || typeof child !== "object") continue;
    const c = child as Record<string, unknown>;
    if ("w:body" in c) {
      bodyChildren = c["w:body"] as unknown[];
      break;
    }
  }
  if (!bodyChildren) return [];

  const paragraphs: unknown[][] = [];
  for (const child of bodyChildren) {
    if (child == null || typeof child !== "object") continue;
    const c = child as Record<string, unknown>;
    if ("w:p" in c) {
      paragraphs.push(c["w:p"] as unknown[]);
    }
  }
  return paragraphs;
}

function parseParagraphs(
  bodyNode: XNode,
  orderedParagraphs: unknown[][],
): RawParagraph[] {
  const paragraphs: RawParagraph[] = [];
  const wps = getArray(bodyNode, "w:p");

  for (let i = 0; i < wps.length; i++) {
    const p = wps[i];
    const pPr = getChild(p, "w:pPr");

    let styleId: string | undefined;
    let numId: number | undefined;
    let numLevel: number | undefined;

    if (pPr) {
      const pStyle = getChild(pPr, "w:pStyle");
      if (pStyle) {
        styleId = pStyle["@_w:val"] as string | undefined;
      }

      const numPr = getChild(pPr, "w:numPr");
      if (numPr) {
        const ilvl = getChild(numPr, "w:ilvl");
        const nId = getChild(numPr, "w:numId");
        if (ilvl) numLevel = Number(ilvl["@_w:val"] ?? 0);
        if (nId) numId = Number(nId["@_w:val"] ?? 0);
      }
    }

    const childOrder = i < orderedParagraphs.length
      ? getChildOrder(orderedParagraphs[i])
      : [];
    const runs = extractRunsOrdered(p, childOrder);

    paragraphs.push({ styleId, numId, numLevel, runs });
  }

  return paragraphs;
}

function parseRelationships(xml: string): Map<string, string> {
  const parsed = xmlParser.parse(xml);
  const rels = parsed?.Relationships;
  if (!rels) return new Map();

  const relArray = getArray(rels, "Relationship");
  const map = new Map<string, string>();

  for (const rel of relArray) {
    const id = rel["@_Id"] as string | undefined;
    const target = rel["@_Target"] as string | undefined;
    if (id && target) {
      map.set(id, target);
    }
  }

  return map;
}

export async function readDocx(buffer: Buffer): Promise<DocxReadResult> {
  const zip = await JSZip.loadAsync(buffer);

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("Not a valid .docx file: missing word/document.xml");
  }

  const docXml = await docXmlFile.async("string");
  const doc = xmlParser.parse(docXml);

  const body = doc?.["w:document"]?.["w:body"];
  if (!body) {
    throw new Error("Not a valid .docx file: missing w:body");
  }

  let orderedParagraphs: unknown[][] = [];
  try {
    const orderedDoc = orderedParser.parse(docXml);
    orderedParagraphs = getOrderedParagraphs(orderedDoc);
  } catch {
    // Fallback: if ordered parsing fails, proceed without ordering
  }

  const paragraphs = parseParagraphs(body, orderedParagraphs);

  const relsFile = zip.file("word/_rels/document.xml.rels");
  let relMap = new Map<string, string>();
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    relMap = parseRelationships(relsXml);
  }

  const images = new Map<string, Buffer>();
  const imageExtensions = new Map<string, string>();
  for (const [rId, target] of relMap) {
    if (!target.startsWith("media/")) continue;
    const filePath = `word/${target}`;
    const imgFile = zip.file(filePath);
    if (imgFile) {
      const data = await imgFile.async("nodebuffer");
      images.set(rId, data);
      const ext = target.split(".").pop()?.toLowerCase() ?? "png";
      imageExtensions.set(rId, ext);
    }
  }

  return { paragraphs, images, imageExtensions, relMap };
}
