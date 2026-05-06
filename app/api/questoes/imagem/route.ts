import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";

async function getHandler(request: AuthenticatedRequest) {
  const empresaId = request.user?.empresaId;
  if (!empresaId) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (!path.startsWith("importacoes/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const pathSegments = path.split("/");
  if (pathSegments.length < 2 || pathSegments[1] !== empresaId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
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
