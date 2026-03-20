import { redirect } from "next/navigation";
import { requireUser } from "@/app/shared/core/auth";
import { AceiteTermosForm } from "./components/aceite-termos-form";
import type { TipoDocumentoLegal } from "@/app/shared/types/entities/termos";
import { loadLegalDocumentsHtml } from "@/app/shared/core/services/termos/legal-documents.service";
import { verificarAceiteVigenteEmpresa } from "@/app/shared/core/services/termos/termos.service";

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

  if (user.empresaSlug && user.empresaSlug !== tenant) {
    redirect(`/${user.empresaSlug}/aceite-termos`);
  }

  if (!user.empresaId) {
    return null;
  }

  // Se os termos já foram aceitos por outro admin, redirecionar ao dashboard
  const jaAceito = await verificarAceiteVigenteEmpresa(user.empresaId);
  if (jaAceito) {
    redirect(`/${tenant}/dashboard`);
  }

  const documentos = await loadLegalDocumentsHtml(DOCUMENTOS);

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
