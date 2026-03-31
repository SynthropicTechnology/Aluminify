/**
 * AI Agents Types
 *
 * Multi-tenant AI agent configuration types.
 * Each tenant can have their own agents with custom branding and behavior.
 */

// ============================================
// Integration Types
// ============================================

// TOBIAS-LEGACY: Remover 'n8n' e N8nIntegrationConfig quando TobIAs for deletado
export type IntegrationType = 'copilotkit' | 'mastra' | 'n8n' | 'custom';

export interface N8nIntegrationConfig {
  webhook_url: string;
}

export interface MCPServerConfig {
  serverId: string;
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface CopilotKitIntegrationConfig {
  actions_enabled?: boolean;
  mcp_servers?: MCPServerConfig[];
}

export interface MastraIntegrationConfig {
  streaming_enabled?: boolean;
  max_steps?: number;
}

export interface CustomIntegrationConfig {
  endpoint_url: string;
  api_key?: string;
  headers?: Record<string, string>;
}

export type IntegrationConfig =
  | N8nIntegrationConfig
  | CopilotKitIntegrationConfig
  | MastraIntegrationConfig
  | CustomIntegrationConfig
  | Record<string, unknown>;

// ============================================
// AI Agent Types
// ============================================

export interface AIAgent {
  id: string;
  empresaId: string;

  // Identification
  slug: string;
  name: string;
  description: string | null;

  // Appearance
  avatarUrl: string | null;
  greetingMessage: string | null;
  placeholderText: string;

  // Behavior
  systemPrompt: string | null;
  model: string;
  temperature: number;

  // Integration
  integrationType: IntegrationType;
  integrationConfig: IntegrationConfig;

  // Features
  supportsAttachments: boolean;
  supportsVoice: boolean;

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Minimal agent data for sidebar/navigation
 */
export interface AIAgentSummary {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  isDefault: boolean;
}

/**
 * Agent config for the chat UI
 */
export interface AIAgentChatConfig {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  greetingMessage: string | null;
  placeholderText: string;
  systemPrompt: string | null;
  model: string;
  temperature: number;
  integrationType: IntegrationType;
  integrationConfig: IntegrationConfig;
  supportsAttachments: boolean;
}

// ============================================
// Input Types
// ============================================

export interface CreateAIAgentInput {
  empresaId: string;
  slug: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  greetingMessage?: string | null;
  placeholderText?: string;
  systemPrompt?: string | null;
  model?: string;
  temperature?: number;
  integrationType?: IntegrationType;
  integrationConfig?: IntegrationConfig;
  supportsAttachments?: boolean;
  supportsVoice?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateAIAgentInput {
  slug?: string;
  name?: string;
  description?: string | null;
  avatarUrl?: string | null;
  greetingMessage?: string | null;
  placeholderText?: string;
  systemPrompt?: string | null;
  model?: string;
  temperature?: number;
  integrationType?: IntegrationType;
  integrationConfig?: IntegrationConfig;
  supportsAttachments?: boolean;
  supportsVoice?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
}

// ============================================
// Database Row Types
// ============================================

export interface AIAgentRow {
  id: string;
  empresa_id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  greeting_message: string | null;
  placeholder_text: string;
  system_prompt: string | null;
  model: string;
  temperature: number;
  integration_type: string;
  integration_config: Record<string, unknown>;
  supports_attachments: boolean;
  supports_voice: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}
