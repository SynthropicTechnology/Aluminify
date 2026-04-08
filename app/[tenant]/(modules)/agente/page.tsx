"use client";

import { useEffect, useState, useCallback } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useTenantContext } from "@/app/[tenant]/tenant-context";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { ThreadSidebar } from "./components/thread-sidebar";
import type { AIAgentChatConfig } from "@/app/shared/services/ai-agents";
import { N8nChatSection } from "@/app/tobias/components/n8n-chat-section";

export default function AgentePage() {
  const tenant = useTenantContext();
  const params = useParams();
  const tenantSlug = String(params?.tenant ?? "").toLowerCase();
  const isCdfTenant =
    tenantSlug === "cdf" || tenantSlug === "cdf-curso-de-fsica";
  const [agentConfig, setAgentConfig] = useState<AIAgentChatConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

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

  // Criar nova thread via API
  const handleNewThread = useCallback(async () => {
    if (!agentConfig || !tenant?.empresaId) return;

    try {
      const res = await fetch(`/api/ai-agents/${tenant.empresaId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentConfig.id }),
      });
      if (!res.ok) throw new Error("Erro ao criar conversa");
      const data = await res.json();
      setThreadId(data.data.id);
    } catch (err) {
      console.error("Error creating thread:", err);
      // Fallback: gerar um ID local para nova conversa
      setThreadId(crypto.randomUUID());
    }
  }, [agentConfig, tenant?.empresaId]);

  // Auto-criar primeira thread quando agentConfig carrega
  useEffect(() => {
    if (agentConfig && !threadId) {
      handleNewThread();
    }
  }, [agentConfig, threadId, handleNewThread]);

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

  if (!agentConfig || !threadId) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isCdfTenant && agentConfig.integrationType === "n8n") {
    return <N8nChatSection agentConfig={agentConfig} />;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
      {/* Thread sidebar */}
      <ThreadSidebar
        empresaId={tenant.empresaId}
        agentId={agentConfig.id}
        activeThreadId={threadId}
        onSelectThread={setThreadId}
        onNewThread={handleNewThread}
      />

      {/* Chat area */}
      <CopilotKit
        key={threadId}
        runtimeUrl="/api/copilotkit"
        threadId={threadId}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <CopilotChat
            className="flex-1 overflow-hidden"
            labels={{
              title: agentConfig.name,
              initial: agentConfig.greetingMessage ?? "Olá! Como posso ajudar você hoje?",
              placeholder: agentConfig.placeholderText ?? "Digite sua mensagem...",
            }}
          />
        </div>
      </CopilotKit>
    </div>
  );
}
