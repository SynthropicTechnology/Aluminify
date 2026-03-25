import type { Metadata } from "next";
import { WebhookEventsList } from "./components/webhook-events-list";

export const metadata: Metadata = {
  title: "Webhooks | Superadmin",
};

export default function SuperadminWebhooksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Webhooks</h2>
        <p className="text-muted-foreground">
          Monitore eventos Stripe recebidos, status de processamento e reprocesse falhas.
        </p>
      </div>
      <WebhookEventsList />
    </div>
  );
}
