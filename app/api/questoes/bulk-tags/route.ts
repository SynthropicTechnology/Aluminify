import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { z } from "zod";

const bulkTagsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["add", "remove", "set"]),
  tags: z.array(z.string().min(1).max(100)).min(1).max(50),
});

async function postHandler(request: AuthenticatedRequest) {
  const user = request.user;
  if (user?.role !== "usuario") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const empresaId = user.empresaId;
  if (!empresaId) {
    return NextResponse.json(
      { error: "Empresa não encontrada" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const parsed = bulkTagsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { ids, action, tags } = parsed.data;
    const client = getDatabaseClient();

    const { data: questoes, error: fetchError } = await client
      .from("banco_questoes")
      .select("id, tags")
      .in("id", ids)
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);

    if (fetchError) {
      throw new Error(`Failed to fetch questoes: ${fetchError.message}`);
    }

    if (!questoes || questoes.length === 0) {
      return NextResponse.json({ error: "Nenhuma questão encontrada" }, { status: 404 });
    }

    let updated = 0;
    for (const q of questoes) {
      const currentTags: string[] = (q.tags as string[]) ?? [];
      let newTags: string[];

      if (action === "add") {
        newTags = [...new Set([...currentTags, ...tags])];
      } else if (action === "remove") {
        const removeSet = new Set(tags);
        newTags = currentTags.filter((t) => !removeSet.has(t));
      } else {
        newTags = [...new Set(tags)];
      }

      const { error: updateError } = await client
        .from("banco_questoes")
        .update({ tags: newTags })
        .eq("id", q.id);

      if (!updateError) updated++;
    }

    return NextResponse.json({ data: { updated } });
  } catch (error) {
    console.error("[Questoes Bulk Tags API]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return requireUserAuth((req) => postHandler(req))(request);
}
