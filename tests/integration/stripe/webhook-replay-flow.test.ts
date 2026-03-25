import { GET as listWebhooks } from "@/app/api/superadmin/webhooks/route";
import { POST as replayWebhook } from "@/app/api/superadmin/webhooks/replay/route";
import { requireSuperadminForAPI } from "@/app/shared/core/services/superadmin-auth.service";
import {
  listWebhookEvents,
  replayWebhookEvent,
} from "@/app/shared/core/services/webhook-events.service";

jest.mock("@/app/shared/core/services/superadmin-auth.service", () => ({
  requireSuperadminForAPI: jest.fn(),
}));

jest.mock("@/app/shared/core/services/webhook-events.service", () => ({
  listWebhookEvents: jest.fn(),
  replayWebhookEvent: jest.fn(),
}));

jest.mock("@/app/shared/core/services/logger.service", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function makeNextRequest(url: string, init?: RequestInit): Request & { nextUrl: URL } {
  const req = new Request(url, init) as Request & { nextUrl: URL };
  req.nextUrl = new URL(url);
  return req;
}

describe("webhook replay superadmin API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/superadmin/webhooks sem auth retorna 401", async () => {
    (requireSuperadminForAPI as jest.Mock).mockResolvedValue(null);

    const response = await listWebhooks(
      makeNextRequest("http://localhost/api/superadmin/webhooks") as never,
    );

    expect(response.status).toBe(401);
  });

  it("POST /api/superadmin/webhooks/replay com body invalido retorna 400", async () => {
    (requireSuperadminForAPI as jest.Mock).mockResolvedValue({ id: "sa_1" });

    const response = await replayWebhook(
      makeNextRequest("http://localhost/api/superadmin/webhooks/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
    );

    expect(response.status).toBe(400);
  });

  it("POST replay bem-sucedido retorna 200 com replayed true", async () => {
    (requireSuperadminForAPI as jest.Mock).mockResolvedValue({ id: "sa_1" });
    (replayWebhookEvent as jest.Mock).mockResolvedValue({
      replayed: true,
      stripe_event_id: "evt_1",
      status: "processed",
    });

    const response = await replayWebhook(
      makeNextRequest("http://localhost/api/superadmin/webhooks/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: "evt_1" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({ replayed: true, stripe_event_id: "evt_1" }),
    );
  });

  it("GET /api/superadmin/webhooks retorna lista com has_more", async () => {
    (requireSuperadminForAPI as jest.Mock).mockResolvedValue({ id: "sa_1" });
    (listWebhookEvents as jest.Mock).mockResolvedValue({
      events: [
        {
          stripe_event_id: "evt_1",
          event_type: "invoice.paid",
          status: "processed",
          payload_summary: {
            subscription_id: "sub_1",
            customer_id: "cus_1",
          },
        },
      ],
      has_more: false,
    });

    const response = await listWebhooks(
      makeNextRequest("http://localhost/api/superadmin/webhooks?status=processed") as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.has_more).toBe(false);
    expect(body.events).toHaveLength(1);
  });
});
