import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { RawParagraph, RawRun } from "./types";

type XNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  htmlEntities: true,
  isArray: (tagName) => {
    const arrayTags = new Set([
      "w:p", "w:r", "w:t", "w:drawing", "w:pict",
      "m:oMath", "m:oMathPara", "m:r", "m:e", "m:mr",
      "Relationship",
    ]);
    return arrayTags.has(tagName);
  },
});

export interface DocxReadResult {
  paragraphs: RawParagraph[];
  images: Map<string, Buffer>;
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

function extractRuns(para: XNode): RawRun[] {
  const runs: RawRun[] = [];
  const wRuns = getArray(para, "w:r");

  for (const r of wRuns) {
    const rPr = getChild(r, "w:rPr");
    const bold = rPr ? (getChild(rPr, "w:b") !== undefined) : false;
    const italic = rPr ? (getChild(rPr, "w:i") !== undefined) : false;

    const texts = getArray(r, "w:t");
    let text = "";
    for (const t of texts) {
      if (typeof t === "string") text += t;
      else if (t["#text"] != null) text += String(t["#text"]);
      else if (typeof t === "object") text += String(t);
    }

    let imageRId: string | undefined;
    const drawings = getArray(r, "w:drawing");
    for (const drawing of drawings) {
      imageRId = findImageRId(drawing);
      if (imageRId) break;
    }
    if (!imageRId) {
      const picts = getArray(r, "w:pict");
      for (const pict of picts) {
        imageRId = findImageRIdInPict(pict);
        if (imageRId) break;
      }
    }

    runs.push({ text, bold, italic, imageRId });
  }

  const oMathParas = getArray(para, "m:oMathPara");
  for (const omp of oMathParas) {
    const oMaths = getArray(omp, "m:oMath");
    for (const om of oMaths) {
      runs.push({ text: "", ommlNode: om });
    }
  }

  const oMaths = getArray(para, "m:oMath");
  for (const om of oMaths) {
    runs.push({ text: "", ommlNode: om });
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

function parseParagraphs(bodyNode: XNode): RawParagraph[] {
  const paragraphs: RawParagraph[] = [];
  const wps = getArray(bodyNode, "w:p");

  for (const p of wps) {
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

    const runs = extractRuns(p);

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

  const paragraphs = parseParagraphs(body);

  const relsFile = zip.file("word/_rels/document.xml.rels");
  let relMap = new Map<string, string>();
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    relMap = parseRelationships(relsXml);
  }

  const images = new Map<string, Buffer>();
  for (const [rId, target] of relMap) {
    if (!target.startsWith("media/")) continue;
    const filePath = `word/${target}`;
    const imgFile = zip.file(filePath);
    if (imgFile) {
      const data = await imgFile.async("nodebuffer");
      images.set(rId, data);
    }
  }

  return { paragraphs, images, relMap };
}
