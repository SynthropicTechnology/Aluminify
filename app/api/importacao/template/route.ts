import { NextResponse } from "next/server";
import JSZip from "jszip";
import pako from "pako";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const buf = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, data.length);
  buf.set(typeBytes, 4);
  buf.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return buf;
}

function generatePlaceholderPng(): Uint8Array {
  const w = 300;
  const h = 120;

  const raw = new Uint8Array((1 + w * 3) * h);
  let off = 0;

  const bars = [
    { x: 40, bw: 35, bh: 80, r: 66, g: 133, b: 244 },
    { x: 95, bw: 35, bh: 55, r: 52, g: 168, b: 83 },
    { x: 150, bw: 35, bh: 95, r: 234, g: 67, b: 53 },
    { x: 205, bw: 35, bh: 40, r: 251, g: 188, b: 4 },
  ];

  for (let y = 0; y < h; y++) {
    raw[off++] = 0;
    for (let x = 0; x < w; x++) {
      const isBorder =
        x === 0 || x === w - 1 || y === 0 || y === h - 1;

      if (isBorder) {
        raw[off++] = 210;
        raw[off++] = 210;
        raw[off++] = 210;
        continue;
      }

      let drawn = false;
      for (const bar of bars) {
        if (
          x >= bar.x &&
          x < bar.x + bar.bw &&
          y >= h - 10 - bar.bh &&
          y < h - 10
        ) {
          raw[off++] = bar.r;
          raw[off++] = bar.g;
          raw[off++] = bar.b;
          drawn = true;
          break;
        }
      }

      if (!drawn) {
        if (y === h - 10) {
          raw[off++] = 180;
          raw[off++] = 180;
          raw[off++] = 180;
        } else {
          raw[off++] = 248;
          raw[off++] = 249;
          raw[off++] = 250;
        }
      }
    }
  }

  const compressed = pako.deflate(raw);

  const signature = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, w);
  ihdrView.setUint32(4, h);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = pngChunk("IHDR", ihdrData);
  const idat = pngChunk("IDAT", compressed);
  const iend = pngChunk("IEND", new Uint8Array(0));

  const png = new Uint8Array(
    signature.length + ihdr.length + idat.length + iend.length,
  );
  let pos = 0;
  png.set(signature, pos);
  pos += signature.length;
  png.set(ihdr, pos);
  pos += ihdr.length;
  png.set(idat, pos);
  pos += idat.length;
  png.set(iend, pos);

  return png;
}

function inlineImageXml(rId: string, cx: number, cy: number): string {
  return `<w:drawing>
  <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${cx}" cy="${cy}"/>
    <wp:docPr id="1" name="Imagem Exemplo"/>
    <a:graphic>
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic>
          <pic:nvPicPr>
            <pic:cNvPr id="1" name="grafico-exemplo.png"/>
            <pic:cNvPicPr/>
          </pic:nvPicPr>
          <pic:blipFill>
            <a:blip r:embed="${rId}"/>
            <a:stretch><a:fillRect/></a:stretch>
          </pic:blipFill>
          <pic:spPr>
            <a:xfrm>
              <a:off x="0" y="0"/>
              <a:ext cx="${cx}" cy="${cy}"/>
            </a:xfrm>
            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          </pic:spPr>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>`;
}

interface ParagraphOptions {
  bold?: boolean;
  fontSize?: number;
  color?: string;
  spacing?: { before?: number; after?: number };
  heading?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: "center" | "left" | "right";
  border?: "bottom" | "box";
  shading?: string;
}

function wparagraph(text: string, opts: ParagraphOptions = {}): string {
  const {
    bold,
    fontSize = 22,
    color,
    spacing,
    heading,
    italic,
    underline,
    alignment,
    border,
  } = opts;

  let pPr = "";
  if (alignment) {
    pPr += `<w:jc w:val="${alignment}"/>`;
  }
  if (spacing) {
    const before = spacing.before ? `w:before="${spacing.before}"` : "";
    const after = spacing.after ? `w:after="${spacing.after}"` : "";
    pPr += `<w:spacing ${before} ${after}/>`;
  }
  if (border === "bottom") {
    pPr += `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="CCCCCC"/></w:pBdr>`;
  } else if (border === "box") {
    pPr += `<w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="2E74B5"/><w:left w:val="single" w:sz="6" w:space="6" w:color="2E74B5"/><w:bottom w:val="single" w:sz="6" w:space="4" w:color="2E74B5"/><w:right w:val="single" w:sz="6" w:space="6" w:color="2E74B5"/></w:pBdr>`;
  }
  if (opts.shading) {
    pPr += `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`;
  }
  if (heading) {
    pPr += `<w:pStyle w:val="Heading1"/>`;
  }

  let rPr = `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>`;
  if (bold) rPr += `<w:b/><w:bCs/>`;
  if (italic) rPr += `<w:i/><w:iCs/>`;
  if (underline) rPr += `<w:u w:val="single"/>`;
  if (color) rPr += `<w:color w:val="${color}"/>`;

  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

interface RunSegment {
  text: string;
  bold?: boolean;
}

function wmixedParagraph(
  segments: RunSegment[],
  opts: ParagraphOptions = {},
): string {
  const { fontSize = 22, color, spacing, alignment } = opts;

  let pPr = "";
  if (alignment) pPr += `<w:jc w:val="${alignment}"/>`;
  if (spacing) {
    const before = spacing.before ? `w:before="${spacing.before}"` : "";
    const after = spacing.after ? `w:after="${spacing.after}"` : "";
    pPr += `<w:spacing ${before} ${after}/>`;
  }

  const runs = segments
    .map((seg) => {
      let rPr = `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>`;
      if (seg.bold) rPr += `<w:b/><w:bCs/>`;
      if (color) rPr += `<w:color w:val="${color}"/>`;
      return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEscape(seg.text)}</w:t></w:r>`;
    })
    .join("");

  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${runs}</w:p>`;
}

function emptyParagraph(): string {
  return `<w:p/>`;
}

function buildDocumentXml(): string {
  const paragraphs: string[] = [];
  const p = (text: string, opts?: ParagraphOptions) =>
    paragraphs.push(wparagraph(text, opts));
  const pm = (segments: RunSegment[], opts?: ParagraphOptions) =>
    paragraphs.push(wmixedParagraph(segments, opts));
  const br = () => paragraphs.push(emptyParagraph());

  // ═══════════════════════════════════════════════════════════
  // PÁGINA 1 — Instruções
  // ═══════════════════════════════════════════════════════════

  p("MODELO DE IMPORTAÇÃO DE QUESTÕES", {
    bold: true,
    fontSize: 32,
    alignment: "center",
    spacing: { after: 120 },
  });

  p("Como formatar seu documento", {
    bold: true,
    fontSize: 26,
    color: "2E74B5",
    spacing: { before: 120, after: 80 },
    border: "bottom",
  });

  p(
    "Este modelo mostra o formato aceito pelo sistema para importação de questões via arquivo Word (.docx). " +
      "Apague todo o conteúdo deste arquivo e cole suas questões seguindo o mesmo padrão.",
    { fontSize: 21, spacing: { after: 80 } },
  );

  p("Estrutura obrigatória de cada questão:", {
    bold: true,
    fontSize: 22,
    spacing: { before: 80, after: 40 },
  });

  pm([
    { text: "1. Número da questão", bold: true },
    { text: " seguido de ponto ou parêntese. Ex: " },
    { text: "1.", bold: true },
    { text: " ou " },
    { text: "1)", bold: true },
  ], { fontSize: 20, color: "404040" });
  pm([
    { text: "2. Enunciado", bold: true },
    { text: " — texto base e/ou pergunta da questão" },
  ], { fontSize: 20, color: "404040" });
  pm([
    { text: "3. Alternativas", bold: true },
    { text: " com letras de " },
    { text: "a)", bold: true },
    { text: " até " },
    { text: "e)", bold: true },
    { text: " (mínimo 2, recomendado 4 ou 5)" },
  ], { fontSize: 20, color: "404040" });
  pm([
    { text: "4. Resposta", bold: true },
    { text: " no formato: " },
    { text: "Resposta: [LETRA]", bold: true },
  ], { fontSize: 20, color: "404040" });

  p("Campos opcionais (após as alternativas e resposta):", {
    bold: true,
    fontSize: 22,
    spacing: { before: 80, after: 40 },
  });

  pm([
    { text: "• Instituição e ano", bold: true },
    { text: " — entre parênteses no início do enunciado. Ex: " },
    { text: "(Enem 2024)", bold: true },
  ], { fontSize: 20, color: "404040" });
  pm([
    { text: "• Resolução", bold: true },
    { text: " — texto explicando a resposta correta, logo após a linha de Resposta" },
  ], { fontSize: 20, color: "404040" });
  pm([
    { text: "• ", bold: false },
    { text: "Link:", bold: true },
    { text: " URL do vídeo de resolução. Ex: " },
    { text: "Link: https://youtube.com/watch?v=...", bold: true },
  ], { fontSize: 20, color: "404040" });
  pm([
    { text: "• ", bold: false },
    { text: "Dificuldade:", bold: true },
    { text: " nível da questão. Ex: " },
    { text: "Dificuldade: Fácil", bold: true },
    { text: "  |  " },
    { text: "Médio", bold: true },
    { text: "  |  " },
    { text: "Difícil", bold: true },
  ], { fontSize: 20, color: "404040" });

  p("Ordem após as alternativas:", {
    bold: true,
    fontSize: 22,
    spacing: { before: 80, after: 40 },
  });

  pm([
    { text: "Resposta: [C]", bold: true },
    { text: "  →  resolução  →  " },
    { text: "Link: ...", bold: true },
    { text: "  →  " },
    { text: "Dificuldade: ...", bold: true },
  ], { fontSize: 20, color: "404040", spacing: { after: 40 } });

  p("Imagens:", {
    bold: true,
    fontSize: 22,
    spacing: { before: 80, after: 40 },
  });

  p("• Insira imagens normalmente pelo Word: Inserir > Imagens.", {
    fontSize: 20,
    color: "404040",
  });
  p("• A imagem pode ficar no enunciado, nas alternativas ou na resolução.", {
    fontSize: 20,
    color: "404040",
  });
  p("• Formatos aceitos: PNG, JPG, BMP, GIF, TIFF. Evite imagens muito grandes (acima de 2 MB cada).", {
    fontSize: 20,
    color: "404040",
  });
  p("• Não use \"colar imagem\" de outro programa — insira o arquivo de imagem diretamente.", {
    fontSize: 20,
    color: "404040",
  });

  p("Fórmulas e equações:", {
    bold: true,
    fontSize: 22,
    spacing: { before: 80, after: 40 },
  });

  p("• Use o Editor de Equações do Word: Inserir > Equação (ou Alt + =).", {
    fontSize: 20,
    color: "404040",
  });
  p("• Não digite fórmulas como texto simples (ex: \"x^2 + 3x\"). Use sempre o editor de equações.", {
    fontSize: 20,
    color: "404040",
  });
  p("• As equações são convertidas automaticamente para formato LaTeX no sistema.", {
    fontSize: 20,
    color: "404040",
  });
  p("• Se o seu banco de questões tiver equações como imagens, clique duas vezes sobre cada uma e converta para o formato de equação do Word antes de importar.", {
    fontSize: 20,
    color: "404040",
  });

  p("Formatos alternativos aceitos:", {
    bold: true,
    fontSize: 22,
    spacing: { before: 80, after: 40 },
  });

  p('• Em vez de "Resposta: [C]", você pode usar uma seção GABARITO no final do documento.', {
    fontSize: 20,
    color: "404040",
  });
  p("• A resposta pode vir em duas linhas: \"Resposta:\" na primeira e \"[C]\" na segunda.", {
    fontSize: 20,
    color: "404040",
  });
  p('• Em vez de "1. Enunciado", você pode usar "QUESTÃO 1" em uma linha separada.', {
    fontSize: 20,
    color: "404040",
  });

  // ═══════════════════════════════════════════════════════════
  // QUEBRA DE PÁGINA → PÁGINA 2 (CTA + Aviso de revisão)
  // ═══════════════════════════════════════════════════════════
  paragraphs.push(
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`,
  );

  p("SIGA O MODELO A PARTIR DA PRÓXIMA PÁGINA", {
    bold: true,
    fontSize: 32,
    color: "FFFFFF",
    alignment: "center",
    shading: "2E74B5",
    border: "box",
    spacing: { after: 60 },
  });
  p("Apague todas as instruções e exemplos, e cole suas questões no mesmo formato.", {
    bold: true,
    fontSize: 24,
    color: "2E74B5",
    alignment: "center",
    spacing: { after: 400 },
  });

  p("Importante — Confira após importar", {
    bold: true,
    fontSize: 28,
    color: "C00000",
    alignment: "center",
    spacing: { after: 200 },
    border: "bottom",
  });

  p("Após enviar o arquivo, o sistema mostrará uma tela de revisão com todas as questões extraídas.", {
    fontSize: 24,
    spacing: { after: 160 },
  });
  p("Confira cada questão: enunciado, alternativas, gabarito, resolução, imagens e fórmulas.", {
    fontSize: 24,
    spacing: { after: 160 },
  });
  p("Caso encontre erros de formatação, você pode corrigir diretamente pelo app antes de publicar.", {
    fontSize: 24,
    spacing: { after: 160 },
  });
  p("Só publique a lista depois de revisar tudo. Uma vez publicada, as questões ficam disponíveis para os alunos.", {
    bold: true,
    fontSize: 24,
    color: "C00000",
    spacing: { after: 200 },
  });

  // ═══════════════════════════════════════════════════════════
  // QUEBRA DE PÁGINA → PÁGINA 3 (Questões de exemplo)
  // ═══════════════════════════════════════════════════════════
  paragraphs.push(
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`,
  );

  // ── Questão 1: Exemplo completo (texto base + resolução + link + dificuldade) ──
  p(
    "1. (Enem 2024) Um pesquisador analisou a variação da temperatura média global ao longo das últimas décadas. " +
      "Os dados coletados indicam que a temperatura média subiu de 14,0 °C em 1990 para 15,2 °C em 2020.",
    { fontSize: 22, spacing: { after: 60 } },
  );
  p("Com base nesses dados, a variação percentual da temperatura média global no período foi de:", {
    fontSize: 22,
    spacing: { after: 80 },
  });
  p("a) 5,7%", { fontSize: 22 });
  p("b) 7,1%", { fontSize: 22 });
  p("c) 8,6%", { fontSize: 22 });
  p("d) 10,2%", { fontSize: 22 });
  p("e) 12,0%", { fontSize: 22 });
  p("Resposta: [C]", {
    fontSize: 22,
    bold: true,
    spacing: { before: 80 },
  });
  p(
    "A variação percentual é calculada pela fórmula: ((valor final - valor inicial) / valor inicial) × 100. " +
      "Substituindo: ((15,2 - 14,0) / 14,0) × 100 = (1,2 / 14,0) × 100 ≈ 8,57%, ou seja, aproximadamente 8,6%.",
    { fontSize: 22, spacing: { after: 40 } },
  );
  pm([
    { text: "Link: ", bold: true },
    { text: "https://www.youtube.com/watch?v=exemplo1" },
  ], { fontSize: 22 });
  pm([
    { text: "Dificuldade: ", bold: true },
    { text: "Fácil" },
  ], { fontSize: 22 });

  br();

  // ── Questão 2: Com imagem no enunciado ──
  p(
    "2. (Fuvest 2023) O gráfico abaixo mostra o desempenho de vendas de quatro produtos ao longo de um trimestre.",
    { fontSize: 22, spacing: { after: 60 } },
  );

  // Imagem embutida (gráfico de barras placeholder)
  const imgCx = 2857500; // ~3 polegadas
  const imgCy = 1143000; // ~1.2 polegadas
  paragraphs.push(
    `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r>${inlineImageXml("rId2", imgCx, imgCy)}</w:r></w:p>`,
  );

  p("Com base no gráfico, qual produto teve o melhor desempenho no período?", {
    fontSize: 22,
    spacing: { after: 80 },
  });
  p("a) Produto A (azul)", { fontSize: 22 });
  p("b) Produto B (verde)", { fontSize: 22 });
  p("c) Produto C (vermelho)", { fontSize: 22 });
  p("d) Produto D (amarelo)", { fontSize: 22 });
  p("Resposta: [C]", {
    fontSize: 22,
    bold: true,
    spacing: { before: 80 },
  });
  p("O Produto C (vermelho) possui a barra mais alta no gráfico, indicando o melhor desempenho de vendas no trimestre.", {
    fontSize: 22,
    spacing: { after: 40 },
  });
  pm([
    { text: "Link: ", bold: true },
    { text: "https://www.youtube.com/watch?v=exemplo2" },
  ], { fontSize: 22 });
  pm([
    { text: "Dificuldade: ", bold: true },
    { text: "Médio" },
  ], { fontSize: 22 });

  br();

  // ── Questão 3: Exemplo mínimo (sem link, sem dificuldade) ──
  p(
    "3. Na frase \"Os alunos apresentaram seus trabalhos\", o sujeito é:",
    { fontSize: 22, spacing: { after: 80 } },
  );
  p("a) Os alunos", { fontSize: 22 });
  p("b) apresentaram", { fontSize: 22 });
  p("c) seus trabalhos", { fontSize: 22 });
  p("d) Os alunos apresentaram", { fontSize: 22 });
  p("Resposta: [A]", {
    fontSize: 22,
    bold: true,
    spacing: { before: 80 },
  });
  p("O sujeito é o termo que pratica a ação expressa pelo verbo. Neste caso, \"Os alunos\" praticam a ação de \"apresentar\".", {
    fontSize: 22,
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${paragraphs.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export async function GET() {
  const zip = new JSZip();

  const placeholderPng = generatePlaceholderPng();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/grafico-exemplo.png"/>
</Relationships>`,
  );

  zip.file("word/media/grafico-exemplo.png", placeholderPng);

  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="pt-BR"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="80" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
      <w:color w:val="2E74B5"/>
    </w:rPr>
  </w:style>
</w:styles>`,
  );

  zip.file("word/document.xml", buildDocumentXml());

  const buffer = await zip.generateAsync({ type: "arraybuffer" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        'attachment; filename="modelo-importacao-questoes.docx"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
