"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface WebhookEventItem {
  stripe_event_id: string;
  event_type: string;
  status: "processing" | "processed" | "failed";
  processing_error: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
  payload_summary?: {
    subscription_id: string | null;
    customer_id: string | null;
  };
}

const STATUS_LABELS: Record<WebhookEventItem["status"], { label: string; className: string }> = {
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700" },
  processed: { label: "Processed", className: "bg-green-100 text-green-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

export function WebhookEventsList() {
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const lastEventId = useMemo(
    () => (events.length > 0 ? events[events.length - 1].stripe_event_id : null),
    [events],
  );

  const fetchEvents = useCallback(async (cursor?: string) => {
    if (!cursor) {
      setLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "25");
      if (cursor) params.set("starting_after", cursor);

      const response = await fetch(`/api/superadmin/webhooks?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao buscar webhooks");
      }

      const nextEvents = payload?.events || [];
      setEvents((prev) => (cursor ? [...prev, ...nextEvents] : nextEvents));
      setHasMore(Boolean(payload?.has_more));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Erro ao buscar webhooks");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  async function handleReplay(eventId: string) {
    setReplayingId(eventId);
    setError(null);

    try {
      const response = await fetch("/api/superadmin/webhooks/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao reprocessar webhook");
      }

      await fetchEvents();
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Erro ao reprocessar webhook");
    } finally {
      setReplayingId(null);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("pt-BR");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="processing">Processing</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Evento</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Recebido em</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Duracao</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Payload</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Acao</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Carregando webhooks...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum webhook encontrado.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const statusInfo = STATUS_LABELS[event.status];
                return (
                  <tr key={event.stripe_event_id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{event.event_type}</div>
                      <div className="font-mono text-xs text-muted-foreground">{event.stripe_event_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(event.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {event.processing_time_ms ? `${event.processing_time_ms}ms` : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>subscription: {event.payload_summary?.subscription_id || "-"}</div>
                      <div>customer: {event.payload_summary?.customer_id || "-"}</div>
                      {event.processing_error && <div className="text-red-600">erro: {event.processing_error}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {event.status === "failed" ? (
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                          onClick={() => handleReplay(event.stripe_event_id)}
                          disabled={replayingId === event.stripe_event_id}
                        >
                          {replayingId === event.stripe_event_id ? "Reprocessando..." : "Reprocessar"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {hasMore && lastEventId && (
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          disabled={loading}
          onClick={() => fetchEvents(lastEventId)}
        >
          {loading ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </div>
  );
}
