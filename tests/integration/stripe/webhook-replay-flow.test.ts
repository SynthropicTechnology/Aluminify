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
 import { GET as listWebhooks } from "@/app/api/superadmin/webhooksplimport { POST as replayWebhook } from "@/app/api/superadmin/webhooks/ks();
import { requireSuperadminForAPI } from "@/app/shared/core/services/superadmin-aut (import {
  listWebhookEvents,
  replayWebhookEvent,
} from "@/app/shared/core/services/webhois  listWks  replayWebhookEvenue} from "@/app/shared/a
jest.mock("@/app/shared/core/services/superadmin-auth.seronse.status).toBe(401);
  });

  it("POST /api/superadmin/webhooks/replay co}));

jest.mock("@/app/shared/core/s()
je {
  listWebhookEvents: jest.fn(),
  replayWebhookEvent: jest.e({ id: "sa_1  replayWebhookEvent: jest.fn(ait replayWebhook(
      makeNextRe
jest(  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    erroet    info: ",    warn: jest.fn() "    error: jest.fn(li    debugon" },
        },
}));

function fy({}),
fu     const req = new Request(url, init) as Request & { nextUrl: URL };
 import { GET as lbe import { GET as listWebhooks } from "@/app/api/superadmin/webhookirimport { requireSuperadminForAPI } from "@/app/shared/core/services/superadmin-aut (import {
  listWebhookEvents,
  replayWebhookEvent,
} fromrue,
      stripe_event_id: "evt_1",
      status: "processed",
    });

    const response = await replayWebhook(
      makeNextRequest("jest.mock("@/app/shared/coadmin/webhooks/replay", {
        method: "POST",
        headers: {   });

  it("POST /api/superadmin/webhook     body: JSON.stringify({ eventId: "evt_1" })
jest.mock("@/app/shared/core/s()
je {
  listWeb.stje {
  listWebhookEvents: jest. =  lai  replayWebhookEvent: jespect(bo      makeNextRe
jest(  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    erroet ),
    );
  });

  it("GET /api/superadmin/webhooks retorna lista com has_more        },
}));

func(requireSuperadminForAPI as jest.Mock).mockResolvedValue({ }));

fun" 
fu
  fu     WebhookEve import { GET as lbe import { GET as listWebhooks } from "@/app/api/sup    listWebhookEvents,
  replayWebhookEvent,
} fromrue,
      stripe_event_id: "evt_1",
      status: "processed",
    });

    const response = await replayWebhook(
      makeNextRom  replayWebhookEven       },
        },
         st         status: "processed",
    c    });

    const respontW
    cs(
      makeNextRequest("jest.mock("@/app/ap        method: "POST",
        headers: {   });

  it("POST /api/superadpo        headers: {   }
 
  it("POST /api/superaespjest.mock("@/app/shared/core/s()
je {
  listWeb.stje {
  listWebhookEvents: jestveLength(1);
  });
});
