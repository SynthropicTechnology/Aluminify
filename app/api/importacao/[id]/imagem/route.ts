import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function detectContentType(buf: ArrayBuffer, filename: string): string {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "image/svg+xml";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const storagePath = `importacoes/images/${params.id}/${key}`;
  const client = getDatabaseClient();
  const { data, error } = await client.storage
    .from("questoes-assets")
    .download(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404 },
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const contentType = detectContentType(arrayBuffer, key);

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return requireUserAuth(async (req: AuthenticatedRequest) => {
    const { id } = await context.params;
    return getHandler(req, { id });
  })(request);
}
