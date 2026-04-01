/**
 * Script para gerar PNGs a partir dos SVGs da marca Aluminify.
 *
 * Requer: npm install sharp (ou npx)
 * Uso:    node brand-assets/generate-pngs.mjs
 *
 * Gera PNGs em brand-assets/png/ mantendo a estrutura de pastas.
 */

import { readdir, readFile, mkdir } from "node:fs/promises";
import { join, basename, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tenta importar sharp
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "❌ sharp nao encontrado. Instale com:\n   npm install --save-dev sharp\n\nOu use:\n   npx --yes sharp-cli\n"
  );
  process.exit(1);
}

// Configuracao de saida
const OUTPUT_DIR = join(__dirname, "png");

// Escalas extras para icones (gera multiplos tamanhos)
const ICON_EXTRA_SIZES = [32, 64, 128, 192, 256, 512, 1024];

// Pastas para processar
const FOLDERS = ["icon", "logotype", "social-media"];

async function getSvgFiles(folder) {
  const dir = join(__dirname, folder);
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith(".svg")).map((f) => join(dir, f));
}

async function convertSvg(svgPath, outputPath, width, height) {
  const svgBuffer = await readFile(svgPath);
  await mkdir(dirname(outputPath), { recursive: true });

  await sharp(svgBuffer)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);

  console.log(`  ✅ ${relative(__dirname, outputPath)} (${width}x${height})`);
}

async function processFolder(folder) {
  const svgFiles = await getSvgFiles(folder);

  for (const svgPath of svgFiles) {
    const name = basename(svgPath, ".svg");
    const svgBuffer = await readFile(svgPath);
    const metadata = await sharp(svgBuffer).metadata();
    const w = metadata.width || 512;
    const h = metadata.height || 512;

    // PNG no tamanho original
    const outDir = join(OUTPUT_DIR, folder);
    await convertSvg(svgPath, join(outDir, `${name}.png`), w, h);

    // Para icones, gerar tamanhos extras
    if (folder === "icon") {
      for (const size of ICON_EXTRA_SIZES) {
        if (size !== w) {
          await convertSvg(
            svgPath,
            join(outDir, `${name}-${size}x${size}.png`),
            size,
            size
          );
        }
      }
    }

    // Para social-media profiles, gerar tambem @2x
    if (folder === "social-media" && name.startsWith("profile-")) {
      const doubleW = w * 2;
      const doubleH = h * 2;
      await convertSvg(
        svgPath,
        join(outDir, `${name}@2x.png`),
        doubleW,
        doubleH
      );
    }
  }
}

async function main() {
  console.log("🎨 Gerando PNGs da marca Aluminify...\n");

  for (const folder of FOLDERS) {
    console.log(`📁 ${folder}/`);
    await processFolder(folder);
    console.log("");
  }

  console.log("✨ Pronto! PNGs gerados em brand-assets/png/");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
