"use client";

import { useEffect, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useTenantContext } from "@/app/[tenant]/tenant-context";
import { Loader2, AlertCircle } from "lucide-react";
import type { AIAgentChatConfig } from "@/app/shared/services/ai-agents";

export default function AgentePage() {
  const tenant = useTenantContext();
  const [agentConfig, setAgentConfig] = useState<AIAgentChatConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.empresaId) return;

    fetch(`/api/ai-agents/${tenant.empresaId}?config=chat`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Nenhum assistente configurado para esta empresa.");
          if (res.status === 403) throw new Error("Você não tem acesso ao assistente deste curso.");
          if (res.status === 401) throw new Error("Sua sessão expirou. Faça login novamente.");
          throw new Error("Erro ao carregar configuração do agente");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.data) {
          setAgentConfig(data.data);
        } else {
          setError("Nenhum assistente configurado para esta empresa.");
        }
      })
      .catch((err) => {
        console.error("Error fetching agent config:", err);
        setError(err.message || "Erro ao carregar assistente. Tente novamente.");
      });
  }, [tenant?.empresaId]);

  if (error) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!agentConfig) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
        <CopilotChat
          className="flex-1 overflow-hidden rounded-lg border bg-background"
          labels={{
            title: agentConfig.name,
            initial: agentConfig.greetingMessage ?? "Olá! Como posso ajudar você hoje?",
            placeholder: agentConfig.placeholderText ?? "Digite sua mensagem...",
          }}
        />
      </div>
    </CopilotKit>
  );
}
