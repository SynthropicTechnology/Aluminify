"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Bot } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import { Textarea } from "@/components/forms/textarea";
import { Switch } from "@/components/forms/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/forms/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { MCPServerList } from "./mcp-server-list";
import type { AIAgent, MCPServerConfig, CopilotKitIntegrationConfig } from "@/app/shared/services/ai-agents";

const agentFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  slug: z
    .string()
    .min(2, "Slug deve ter pelo menos 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  systemPrompt: z.string().optional(),
  model: z.string().min(1, "Selecione um modelo"),
  temperature: z.number().min(0).max(2),
  greetingMessage: z.string().optional(),
  placeholderText: z.string().optional(),
  isActive: z.boolean(),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

const AVAILABLE_MODELS = [
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "openai/gpt-4.1", label: "GPT-4.1" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { value: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

interface AgentSettingsClientProps {
  empresaId: string;
  userId: string;
}

export function AgentSettingsClient({ empresaId, userId }: AgentSettingsClientProps) {
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "",
      slug: "assistente",
      systemPrompt: "",
      model: "openai/gpt-4o-mini",
      temperature: 0.7,
      greetingMessage: "",
      placeholderText: "Digite sua mensagem...",
      isActive: true,
    },
  });

  const loadAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-agents/${empresaId}`);
      if (!res.ok) throw new Error("Erro ao carregar agentes");

      const data = await res.json();
      const agents: AIAgent[] = data.data ?? [];

      // Buscar o agente padrão ou o primeiro copilotkit
      const defaultAgent =
        agents.find((a) => a.isDefault && a.integrationType === "copilotkit") ||
        agents.find((a) => a.integrationType === "copilotkit") ||
        agents[0];

      if (defaultAgent) {
        setAgent(defaultAgent);
        const integrationConfig = defaultAgent.integrationConfig as CopilotKitIntegrationConfig;
        setMcpServers(integrationConfig?.mcp_servers ?? []);
        form.reset({
          name: defaultAgent.name,
          slug: defaultAgent.slug,
          systemPrompt: defaultAgent.systemPrompt ?? "",
          model: defaultAgent.model,
          temperature: defaultAgent.temperature,
          greetingMessage: defaultAgent.greetingMessage ?? "",
          placeholderText: defaultAgent.placeholderText,
          isActive: defaultAgent.isActive,
        });
      }
    } catch (err) {
      console.error("Error loading agent:", err);
      toast.error("Erro ao carregar configuração do agente");
    } finally {
      setLoading(false);
    }
  }, [empresaId, form]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  async function onSubmit(values: AgentFormValues) {
    setSaving(true);
    try {
      const integrationConfig: CopilotKitIntegrationConfig = {
        actions_enabled: true,
        mcp_servers: mcpServers,
      };

      const body = {
        ...values,
        integrationType: "copilotkit" as const,
        integrationConfig,
      };

      if (agent) {
        // Atualizar agente existente
        const res = await fetch(`/api/ai-agents/${empresaId}/${agent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Erro ao atualizar agente");
        }
        const data = await res.json();
        setAgent(data.data);
        toast.success("Agente atualizado com sucesso!");
      } else {
        // Criar novo agente
        const res = await fetch(`/api/ai-agents/${empresaId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            empresaId,
            isDefault: true,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Erro ao criar agente");
        }
        const data = await res.json();
        setAgent(data.data);
        toast.success("Agente criado com sucesso!");
      }
    } catch (err) {
      console.error("Error saving agent:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar agente");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Suppress unused variable warning
  void userId;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Agente IA</h3>
        <p className="text-sm text-muted-foreground">
          Configure o assistente de IA da sua instituição. Cada empresa possui seu próprio agente
          com personalidade, comportamento e ferramentas customizáveis.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Identificação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Identificação
              </CardTitle>
              <CardDescription>Nome e identificador do agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Agente</FormLabel>
                      <FormControl>
                        <Input placeholder="Assistente Acadêmico" {...field} />
                      </FormControl>
                      <FormDescription>Nome exibido no chat</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="assistente" {...field} />
                      </FormControl>
                      <FormDescription>Identificador único (letras minúsculas, números, hífens)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Comportamento */}
          <Card>
            <CardHeader>
              <CardTitle>Comportamento</CardTitle>
              <CardDescription>Defina a personalidade e o modelo do agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt do Sistema</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Você é um assistente educacional especializado em ajudar alunos com dúvidas acadêmicas..."
                        className="min-h-40 resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Instruções que definem como o agente se comporta. Seja específico sobre o contexto da sua instituição.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o modelo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AVAILABLE_MODELS.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Modelo de IA utilizado pelo agente</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperatura: {field.value.toFixed(1)}</FormLabel>
                      <FormControl>
                        <Slider
                          min={0}
                          max={2}
                          step={0.1}
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormDescription>
                        Menor = mais preciso, maior = mais criativo
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Aparência do Chat */}
          <Card>
            <CardHeader>
              <CardTitle>Aparência do Chat</CardTitle>
              <CardDescription>Personalize a interface de conversa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="greetingMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem de Boas-vindas</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Olá! Como posso ajudar você hoje?"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Primeira mensagem exibida ao abrir o chat</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="placeholderText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placeholder</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Digite sua mensagem..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Texto exibido no campo de entrada quando vazio</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* MCP Servers */}
          <Card>
            <CardHeader>
              <CardTitle>Servidores MCP</CardTitle>
              <CardDescription>
                Configure servidores MCP (Model Context Protocol) para dar ferramentas ao agente.
                Cada servidor fornece um conjunto de capacidades adicionais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MCPServerList
                servers={mcpServers}
                onChange={setMcpServers}
              />
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Agente Ativo</FormLabel>
                      <FormDescription>
                        Quando desativado, o chat de IA não estará disponível para os usuários
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {agent ? "Salvar Alterações" : "Criar Agente"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
