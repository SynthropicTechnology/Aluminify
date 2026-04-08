/**
 * CopilotKit Runtime Endpoint
 *
 * Self-hosted runtime that dynamically loads agent configuration
 * (system prompt, model, MCP servers) from the database per tenant.
 * Uses OpenRouter as the LLM provider via createOpenAI compatibility layer.
 */

import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkit/runtime/v2";
import { MCPAppsMiddleware } from "@ag-ui/mcp-apps-middleware";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { NextRequest } from "next/server";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { AIAgentsService } from "@/app/shared/services/ai-agents/ai-agents.service";
import type {
  CopilotKitIntegrationConfig,
  MCPServerConfig,
} from "@/app/shared/services/ai-agents/ai-agents.types";

export const dynamic = "force-dynamic";

function resolveModelProviderAndId(modelFromDb: string) {
  const normalizedModel = (modelFromDb || "").trim();
  const isOpenAIModel = normalizedModel.startsWith("openai/");
  const openAiModelId = isOpenAIModel
    ? normalizedModel.replace(/^openai\//, "")
    : normalizedModel;

  // Prefer OpenAI direta para modelos OpenAI quando a chave existir.
  // Fallback: OpenRouter (compatível com prefixos como "openai/").
  if (isOpenAIModel && process.env.OPENAI_API_KEY) {
    return {
      provider: createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      }),
      modelId: openAiModelId,
      providerLabel: "openai",
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
      }),
      modelId: normalizedModel,
      providerLabel: "openrouter",
    };
  }

  return null;
}

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

  const agentSlug = req.nextUrl.searchParams.get("agent") || undefined;
  const agentConfig = await service.getChatConfig(empresaId, agentSlug);

  if (!agentConfig) {
    return new Response(
      JSON.stringify({ error: "Nenhum agente configurado para este tenant" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. Montar o BuiltInAgent com OpenRouter como provider
  const integrationConfig = agentConfig.integrationConfig as CopilotKitIntegrationConfig;
  const mcpServers: MCPServerConfig[] = integrationConfig?.mcp_servers ?? [];

  const providerConfig = resolveModelProviderAndId(agentConfig.model);
  if (!providerConfig) {
    return new Response(
      JSON.stringify({
        error:
          "Configuração ausente para provedor de IA. Defina OPENAI_API_KEY (para modelos openai/*) ou OPENROUTER_API_KEY.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Cast: @ai-sdk/openai v3 retorna LanguageModelV3, CopilotKit espera LanguageModel (V2).
  // Runtime é compatível — apenas o tipo TypeScript está defasado no CopilotKit.
  const model = providerConfig.provider(providerConfig.modelId) as unknown as LanguageModel;

  let agent = new BuiltInAgent({
    model,
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
  const runtime = new CopilotRuntime({
    agents: { default: agent },
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
