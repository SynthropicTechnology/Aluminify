"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TipoDocumentoLegal } from "@/app/shared/types/entities/termos";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DocumentoProps {
  tipo: TipoDocumentoLegal;
  label: string;
  html: string;
}

interface AceiteTermosFormProps {
  empresaId: string;
  tenant: string;
  documentos: DocumentoProps[];
}

export function AceiteTermosForm({
  empresaId,
  tenant,
  documentos,
}: AceiteTermosFormProps) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openDocs, setOpenDocs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = documentos.every((doc) => checked[doc.tipo]);

  function toggleCheck(tipo: string) {
    setChecked((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  }

  function toggleDoc(tipo: string) {
    setOpenDocs((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/empresa/${empresaId}/termos/aceitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        let errorMessage = "Erro ao aceitar termos";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Response não é JSON
        }
        throw new Error(errorMessage);
      }

      // Aguardar um curto delay para garantir que o cache foi invalidado
      await new Promise((resolve) => setTimeout(resolve, 300));

      router.push(`/${tenant}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao aceitar os termos.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {documentos.map(({ tipo, label, html }) => (
        <div key={tipo} className="border border-border rounded-lg">
          <Collapsible
            open={!!openDocs[tipo]}
            onOpenChange={() => toggleDoc(tipo)}
          >
            <div className="flex items-center gap-3 p-4">
              <input
                type="checkbox"
                id={`check-${tipo}`}
                checked={!!checked[tipo]}
                onChange={() => toggleCheck(tipo)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label
                htmlFor={`check-${tipo}`}
                className="flex-1 font-medium text-sm cursor-pointer"
              >
                Li e aceito {label}
              </label>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {openDocs[tipo] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="ml-1 text-xs">
                    {openDocs[tipo] ? "Recolher" : "Visualizar"}
                  </span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="border-t border-border p-4 max-h-80 overflow-y-auto bg-muted/30">
                <article className="prose prose-zinc dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </article>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!allChecked || loading}
        className="w-full"
        size="lg"
      >
        {loading ? "Processando..." : "Aceitar e Continuar"}
      </Button>
    </div>
  );
}
