#!/usr/bin/env ts-node

import { replayWebhookEvent } from "../app/shared/core/services/webhook-events.service";

function parseEventArg(argv: string[]): string | null {
  const eventFlagIndex = argv.indexOf("--event");
  if (eventFlagIndex === -1) return null;

  const value = argv[eventFlagIndex + 1];
  if (!value || value.startsWith("--")) return null;

  return value;
}

async function main() {
  const eventId = parseEventArg(process.argv);
  if (!eventId) {
    console.error("Uso: ts-node scripts/replay-webhook-event.ts --event <stripe_event_id>");
    process.exit(1);
  }

  try {
    const result = await replayWebhookEvent(eventId);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      "Falha ao reprocessar webhook:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
