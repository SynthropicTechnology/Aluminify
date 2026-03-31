import { requireUser } from "@/app/shared/core/auth";
import { AgentSettingsClient } from "./components/agent-settings-client";

export default async function AgentesSettingsPage() {
  const user = await requireUser({ allowedRoles: ["usuario"] });

  if (!user.empresaId) {
    return (
      <div className="page-container">
        <div className="flex flex-col gap-2">
          <h1 className="page-title">Agente IA</h1>
          <p className="page-subtitle">
            Você precisa estar vinculado a uma empresa para gerenciar o agente de IA.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AgentSettingsClient
      empresaId={user.empresaId}
      userId={user.id}
    />
  );
}
