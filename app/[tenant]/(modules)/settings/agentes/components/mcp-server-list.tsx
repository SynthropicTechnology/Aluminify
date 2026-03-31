"use client";

import { useState } from "react";
import { Plus, Trash2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/forms/input";
import { Label } from "@/components/forms/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/forms/select";
import { Card, CardContent } from "@/components/ui/card";
import type { MCPServerConfig } from "@/app/shared/services/ai-agents";

interface MCPServerListProps {
  servers: MCPServerConfig[];
  onChange: (servers: MCPServerConfig[]) => void;
}

export function MCPServerList({ servers, onChange }: MCPServerListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newServer, setNewServer] = useState<MCPServerConfig>({
    serverId: "",
    type: "http",
    url: "",
  });

  function handleAdd() {
    if (!newServer.serverId || !newServer.url) return;

    onChange([...servers, { ...newServer }]);
    setNewServer({ serverId: "", type: "http", url: "" });
    setIsAdding(false);
  }

  function handleRemove(index: number) {
    onChange(servers.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {servers.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum servidor MCP configurado. Adicione um para dar ferramentas ao agente.
        </p>
      )}

      {servers.map((server, index) => (
        <Card key={`${server.serverId}-${index}`}>
          <CardContent className="flex items-center gap-3 p-3">
            <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{server.serverId}</p>
              <p className="text-xs text-muted-foreground truncate">
                {server.type.toUpperCase()} &middot; {server.url}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => handleRemove(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {isAdding && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>ID do Servidor</Label>
                <Input
                  placeholder="meu-servidor-mcp"
                  value={newServer.serverId}
                  onChange={(e) =>
                    setNewServer((prev) => ({ ...prev, serverId: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Transporte</Label>
                <Select
                  value={newServer.type}
                  onValueChange={(value: "http" | "sse") =>
                    setNewServer((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP (Streamable)</SelectItem>
                    <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>URL do Servidor</Label>
              <Input
                placeholder="https://meu-mcp-server.com/mcp"
                value={newServer.url}
                onChange={(e) =>
                  setNewServer((prev) => ({ ...prev, url: e.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewServer({ serverId: "", type: "http", url: "" });
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!newServer.serverId || !newServer.url}
                onClick={handleAdd}
              >
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isAdding && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Servidor MCP
        </Button>
      )}
    </div>
  );
}
