import Link from "next/link";
import type { TipoDocumentoLegal } from "@/app/shared/types/entities/termos";
import { TERMOS_LABELS } from "@/app/shared/types/entities/termos";
import { loadLegalDocumentHtml } from "@/app/shared/core/services/termos/legal-documents.service";

interface LegalDocumentViewerProps {
  tipo: TipoDocumentoLegal;
}

/**
 * Server Component que renderiza um documento legal Markdown como HTML.
 * Lê o arquivo .md do disco e converte para HTML usando `marked`.
 */
export async function LegalDocumentViewer({ tipo }: LegalDocumentViewerProps) {
  const { html } = await loadLegalDocumentHtml(tipo);

  return (
    <article className="prose prose-zinc dark:prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}

/**
 * Layout padrão para páginas públicas de documentos legais.
 */
export async function LegalDocumentPage({ tipo }: LegalDocumentViewerProps) {
  const label = TERMOS_LABELS[tipo];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            &larr; Voltar para a página inicial
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-8">{label}</h1>
        <LegalDocumentViewer tipo={tipo} />
      </div>
    </div>
  );
}
