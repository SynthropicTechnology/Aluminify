import "server-only";

import { marked } from "marked";
import {
  TERMOS_LABELS,
  type TipoDocumentoLegal,
} from "@/app/shared/types/entities/termos";
import { LEGAL_DOCUMENTS_MARKDOWN } from "./legal-documents.content";

export async function loadLegalDocumentHtml(tipo: TipoDocumentoLegal) {
  const markdown = LEGAL_DOCUMENTS_MARKDOWN[tipo];
  const html = await marked(markdown);

  return {
    tipo,
    label: TERMOS_LABELS[tipo],
    html,
  };
}

export async function loadLegalDocumentsHtml(tipos: TipoDocumentoLegal[]) {
  return Promise.all(tipos.map((tipo) => loadLegalDocumentHtml(tipo)));
}
