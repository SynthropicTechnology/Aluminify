import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import { requireUser } from "@/app/shared/core/auth";
import { AceiteTermosForm } from "./components/aceite-termos-form";
import type { TipoDocumentoLegal } from "@/app/shared/types/entities/termos";
import {
  TERMOS_DOCUMENTO_PATH,
  TERMOS_LABELS,
} from "@/app/shared/types/entities/termos";

const DOCUMENTOS: TipoDocumentoLegal[] = [
  "termos_uso",
  "politica_privacidade",
  "dpa",
];

export default async function AceiteTermosPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const user = await requireUser({
    ignoreTermsRequirement: true,
    ignorePasswordRequirement: true,
  });

  if (!user.empresaId) {
    return null;
  }

  // Converter markdown para HTML strings no servidor
  const documentos = await Promise.all(
    DOCUMENTOS.map(async (tipo) => {
      const relativePath = TERMOS_DOCUMENTO_PATH[tipo];
      const absolutePath = path.join(process.cwd(), relativePath);
      const markdown = await fs.readFile(absolutePath, "utf-8");
      const html = await marked(markdown);
      return {
        tipo,
        label: TERMOS_LABELS[tipo],
        html,
      };
    }),
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Aceite de Termos</h1>
          <p className="text-muted-foreground mt-2">
            Para continuar usando a plataforma, é necessário que você aceite os
            documentos legais abaixo.
          </p>
        </div>
        <AceiteTermosForm
          empresaId={user.empresaId}
          tenant={tenant}
          documentos={documentos}
        />
      </div>
    </div>
  );
}
