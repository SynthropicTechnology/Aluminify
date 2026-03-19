import "server-only";

import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import {
  TERMOS_DOCUMENTO_PATH,
  TERMOS_LABELS,
  type TipoDocumentoLegal,
} from "@/app/shared/types/entities/termos";

export async function loadLegalDocumentHtml(tipo: TipoDocumentoLegal) {
  const relativePath = TERMOS_DOCUMENTO_PATH[tipo];
  const absolutePath = path.join(process.cwd(), relativePath);

  try {
    const markdown = await fs.readFile(absolutePath, "utf-8");
    const html = await marked(markdown);

    return {
      tipo,
      label: TERMOS_LABELS[tipo],
      html,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha desconhecida";

    throw new Error(
      `Erro ao carregar documento legal ${tipo} em ${absolutePath}: ${message}`,
    );
  }
}

export async function loadLegalDocumentsHtml(tipos: TipoDocumentoLegal[]) {
  return Promise.all(tipos.map((tipo) => loadLegalDocumentHtml(tipo)));
}