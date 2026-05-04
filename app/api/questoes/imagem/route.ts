import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";

async function getHandler(request: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (!path.startsWith("importacoes/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const client = getDatabaseClient();
  const { data, error } = await client.storage
    .from("questoes-assets")
    .download(path);

  if (error || !data) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const arrayBuffer = await data.arrayBuffer();
  const contentType = path.endsWith(".png")
    ? "image/png"
    : path.endsWith(".jpg") || path.endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}

export function GET(request: NextRequest) {
  return requireUserAuth(async (req: AuthenticatedRequest) => {
    return getHandler(req);
  })(request);
}
