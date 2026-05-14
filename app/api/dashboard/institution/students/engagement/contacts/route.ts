import { NextResponse } from "next/server";
import { requireAuth, type AuthenticatedRequest } from "@/app/[tenant]/auth/middleware";
import { studentEngagementService } from "@/app/[tenant]/(modules)/dashboard/services";
import type {
  StudentEngagementContactChannel,
  StudentEngagementContactReason,
} from "@/app/[tenant]/(modules)/dashboard/types";

const VALID_CHANNELS: StudentEngagementContactChannel[] = [
  "whatsapp",
  "email",
  "phone",
  "manual",
];

const VALID_REASONS: StudentEngagementContactReason[] = [
  "sem_acesso",
  "acessou_sem_estudo",
  "sem_cronograma",
  "baixo_engajamento",
  "sem_conclusao",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function postHandler(request: AuthenticatedRequest) {
  try {
    const empresaId = request.user?.empresaId;
    const adminId = request.user?.id;
    if (!adminId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
    }
    if (!request.user?.isAdmin) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores da instituição podem registrar contatos." },
        { status: 403 },
      );
    }
    if (!empresaId) {
      return NextResponse.json({ error: "Empresa não encontrada para o usuário" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const channel = typeof body.channel === "string" ? body.channel : "";
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!studentId) {
      return NextResponse.json({ error: "studentId é obrigatório" }, { status: 400 });
    }
    if (!VALID_CHANNELS.includes(channel as StudentEngagementContactChannel)) {
      return NextResponse.json({ error: "Canal de contato inválido" }, { status: 400 });
    }
    if (!VALID_REASONS.includes(reason as StudentEngagementContactReason)) {
      return NextResponse.json({ error: "Motivo de contato inválido" }, { status: 400 });
    }

    const contact = await studentEngagementService.recordContact({
      empresaId,
      adminId,
      studentId,
      channel: channel as StudentEngagementContactChannel,
      reason: reason as StudentEngagementContactReason,
      messageTemplate:
        typeof body.messageTemplate === "string" ? body.messageTemplate : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    console.error("[Student Engagement Contact API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao registrar contato",
      },
      { status: 500 },
    );
  }
}

export const POST = requireAuth(postHandler);
