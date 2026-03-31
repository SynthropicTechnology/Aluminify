"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MessageSquare, Trash2, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Thread {
  id: string;
  agent_id: string;
  title: string | null;
  created_at: string;
  last_message_at: string;
}

interface ThreadSidebarProps {
  empresaId: string;
  agentId: string;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
}

export function ThreadSidebar({
  empresaId,
  agentId,
  activeThreadId,
  onSelectThread,
  onNewThread,
}: ThreadSidebarProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ai-agents/${empresaId}/threads?agentId=${agentId}`,
      );
      if (!res.ok) throw new Error("Erro ao carregar conversas");
      const data = await res.json();
      setThreads(data.data ?? []);
    } catch (err) {
      console.error("Error loading threads:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, agentId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  async function handleArchive(threadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(
        `/api/ai-agents/${empresaId}/threads/${threadId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_archived: true }),
        },
      );
      if (!res.ok) throw new Error("Erro ao arquivar conversa");
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) onNewThread();
      toast.success("Conversa arquivada");
    } catch {
      toast.error("Erro ao arquivar conversa");
    }
  }

  async function handleDelete(threadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(
        `/api/ai-agents/${empresaId}/threads/${threadId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Erro ao excluir conversa");
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) onNewThread();
      toast.success("Conversa excluída");
    } catch {
      toast.error("Erro ao excluir conversa");
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="text-sm font-medium">Conversas</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewThread}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nenhuma conversa ainda.
            <br />
            Comece uma nova!
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                  activeThreadId === thread.id && "bg-muted font-medium",
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">
                    {thread.title || "Nova conversa"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(thread.last_message_at)}
                  </p>
                </div>
                <div className="hidden shrink-0 gap-0.5 group-hover:flex">
                  <button
                    onClick={(e) => handleArchive(thread.id, e)}
                    className="rounded p-1 hover:bg-background"
                    title="Arquivar"
                  >
                    <Archive className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(thread.id, e)}
                    className="rounded p-1 hover:bg-background"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
