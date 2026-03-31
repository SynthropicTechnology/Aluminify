/**
 * CopilotKit Runtime Endpoint
 *
 * Self-hosted runtime that dynamically loads agent configuration
 * (system prompt, model, MCP servers) from the database per tenant.
 */

import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkit/runtime/v2";
import { MCPAppsMiddleware } from "@ag-ui/mcp-apps-middleware";
import { NextRequest } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { AIAgentsService } from "@/app/shared/services/ai-agents/ai-agents.service";
import type {
  CopilotKitIntegrationConfig,
  MCPServerConfig,
} from "@/app/shared/services/ai-agents/ai-agents.types";

export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  // 1. Resolver tenant via header injetado pelo middleware
  const empresaId = req.headers.get("x-tenant-id");
  if (!empresaId) {
    return new Response(
      JSON.stringify({ error: "Tenant não identificado" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. Buscar config do agente padrão do tenant no banco
  const supabase = getDatabaseClient();
  const service = new AIAgentsService(supabase);

  // Suporta slug via query param para selecionar agente específico
  const agentSlug = req.nextUrl.searchParams.get("agent") || undefined;
  const agentConfig = await service.getChatConfig(empresaId, agentSlug);

  if (!agentConfig) {
    return new Response(
      JSON.stringify({ error: "Nenhum agente configurado para este tenant" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. Montar o BuiltInAgent com config do banco
  const integrationConfig = agentConfig.integrationConfig as CopilotKitIntegrationConfig;
  const mcpServers: MCPServerConfig[] = integrationConfig?.mcp_servers ?? [];

  let agent = new BuiltInAgent({
    model: agentConfig.model,
    prompt: agentConfig.systemPrompt ?? "Você é um assistente educacional útil e amigável.",
  });

  // 4. Aplicar MCP middleware se houver servers configurados
  if (mcpServers.length > 0) {
    agent = agent.use(
      new MCPAppsMiddleware({
        mcpServers: mcpServers.map((server) => ({
          type: server.type,
          url: server.url,
          serverId: server.serverId,
          ...(server.headers ? { headers: server.headers } : {}),
        })),
      }),
    ) as BuiltInAgent;
  }

  // 5. Criar runtime e processar a request
  const serviceAdapter = new ExperimentalEmptyAdapter();
  const runtime = new CopilotRuntime({
    agents: { default: agent },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
