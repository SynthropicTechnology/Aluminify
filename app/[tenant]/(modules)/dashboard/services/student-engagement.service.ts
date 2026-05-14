import { getDatabaseClient } from "@/app/shared/core/database/database";
import { fetchAllRowsChunked } from "@/app/shared/core/database/chunked-query";
import {
  fetchCanonicalEnrollments,
  type CanonicalEnrollment,
} from "@/app/shared/core/enrollments/canonical-enrollments";
import type {
  StudentEngagementContact,
  StudentEngagementContactChannel,
  StudentEngagementContactReason,
  StudentEngagementData,
  StudentEngagementFilter,
  StudentEngagementRow,
  StudentEngagementStatus,
} from "@/app/[tenant]/(modules)/dashboard/types";

type DashboardPeriod = "semanal" | "mensal" | "anual";

interface StudentEngagementOptions {
  period?: DashboardPeriod;
  filter?: StudentEngagementFilter;
  includeEngaged?: boolean;
}

interface ContactInput {
  empresaId: string;
  studentId: string;
  adminId: string;
  channel: StudentEngagementContactChannel;
  reason: StudentEngagementContactReason;
  messageTemplate?: string | null;
  notes?: string | null;
}

type DatabaseClient = ReturnType<typeof getDatabaseClient>;

type UserRow = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  numero_matricula: string | null;
};

type CourseRow = {
  id: string;
  nome: string | null;
};

type LoginRow = {
  usuario_id: string | null;
  occurred_at: string | null;
};

type StudyRow = {
  usuario_id: string | null;
  created_at: string | null;
  tempo_total_liquido_segundos: number | null;
};

type ScheduleRow = {
  id: string;
  usuario_id: string | null;
};

type ActivityRow = {
  usuario_id: string | null;
  status: string | null;
  data_conclusao: string | null;
  updated_at: string | null;
};

type FlashcardProgressRow = {
  usuario_id: string | null;
  numero_revisoes: number | null;
  updated_at: string | null;
};

type AppointmentRow = {
  aluno_id: string | null;
  created_at: string | null;
};

type ContactRow = {
  id: string;
  student_id: string | null;
  channel: StudentEngagementContactChannel | null;
  reason: StudentEngagementContactReason | null;
  notes: string | null;
  contacted_at: string | null;
  created_at: string | null;
};

const LOW_ENGAGEMENT_MINUTES_BY_PERIOD: Record<DashboardPeriod, number> = {
  semanal: 10,
  mensal: 30,
  anual: 180,
};

const STATUS_LABELS: Record<StudentEngagementStatus, string> = {
  sem_acesso: "Sem acesso",
  acessou_sem_estudo: "Acessou e não estudou",
  sem_cronograma: "Sem cronograma",
  baixo_engajamento: "Baixo engajamento",
  sem_conclusao: "Sem conclusão",
  engajado: "Engajado",
};

const RECOMMENDATIONS: Record<StudentEngagementStatus, string> = {
  sem_acesso: "Enviar convite de primeiro acesso e oferecer suporte.",
  acessou_sem_estudo: "Incentivar o início de uma sessão de estudo ou criação de rotina.",
  sem_cronograma: "Orientar a criação do cronograma personalizado.",
  baixo_engajamento: "Sugerir uma meta curta de estudo para retomar o hábito.",
  sem_conclusao: "Acompanhar se o aluno está travado nas atividades previstas.",
  engajado: "Manter acompanhamento e reforço positivo.",
};

function getPeriodDates(period: DashboardPeriod): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date(endDate);

  if (period === "semanal") {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === "mensal") {
    startDate.setMonth(startDate.getMonth() - 1);
  } else {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  return { startDate, endDate };
}

function formatStudyTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours === 0) return `${remainder}m`;
  return `${hours}h ${remainder}m`;
}

function maxIso(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  return new Date(next) > new Date(current) ? next : current;
}

function createEmptySetMap(ids: string[]): Map<string, Set<string>> {
  return new Map(ids.map((id) => [id, new Set<string>()]));
}

export class StudentEngagementService {
  async getEngagementData(
    empresaId: string,
    options: StudentEngagementOptions = {},
  ): Promise<StudentEngagementData> {
    const client = getDatabaseClient();
    const period = options.period ?? "mensal";
    const filter = options.filter ?? "todos";
    const includeEngaged = options.includeEngaged ?? false;
    const { startDate, endDate } = getPeriodDates(period);
    const since = startDate.toISOString();
    const until = endDate.toISOString();

    const enrollments = await fetchCanonicalEnrollments(client, { empresaId });
    const studentIds = [...new Set(enrollments.map((row) => row.usuarioId))];

    if (studentIds.length === 0) {
      return {
        summary: {
          totalStudents: 0,
          accessedApp: 0,
          studied: 0,
          loggedWithoutStudy: 0,
          withoutAccess: 0,
          withoutSchedule: 0,
          lowEngagement: 0,
          withoutCompletion: 0,
          engaged: 0,
          contacted: 0,
          recovered: 0,
          recoveryRate: 0,
          flashcardsAvailable: false,
          generatedAt: new Date().toISOString(),
        },
        students: [],
      };
    }

    const courseIds = [...new Set(enrollments.map((row) => row.cursoId))];
    const [users, courses, loginRows, studyRows, scheduleRows] = await Promise.all([
      this.fetchUsers(client, studentIds),
      this.fetchCourses(client, courseIds),
      this.fetchLoginRows(client, empresaId, studentIds, since, until),
      this.fetchStudyRows(client, empresaId, studentIds, since),
      this.fetchScheduleRows(client, empresaId, studentIds),
    ]);

    const [
      activityRows,
      flashcardRows,
      appointmentRows,
      flashcardsAvailable,
      contactRows,
    ] = await Promise.all([
      this.fetchActivityRows(client, empresaId, studentIds, since),
      this.fetchFlashcardRows(client, empresaId, studentIds, since),
      this.fetchAppointmentRows(client, empresaId, studentIds, since),
      this.hasFlashcards(client, empresaId),
      this.fetchContactRows(client, empresaId, studentIds),
    ]);

    const students = this.buildRows({
      studentIds,
      enrollments,
      users,
      courses,
      loginRows,
      studyRows,
      scheduleRows,
      activityRows,
      flashcardRows,
      appointmentRows,
      contactRows,
      period,
    });

    const summary = this.buildSummary(students, flashcardsAvailable);
    const filteredStudents = students.filter((student) => {
      if (!includeEngaged && student.status === "engajado") return false;
      if (filter === "todos") return true;
      return student.status === filter;
    });

    filteredStudents.sort((a, b) => {
      if (a.status !== b.status) {
        return this.statusPriority(a.status) - this.statusPriority(b.status);
      }
      return (a.lastLoginAt ?? "").localeCompare(b.lastLoginAt ?? "");
    });

    return { summary, students: filteredStudents };
  }

  async recordContact(input: ContactInput): Promise<StudentEngagementContact> {
    const client = getDatabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("student_engagement_contacts" as never)
      .insert({
        empresa_id: input.empresaId,
        student_id: input.studentId,
        admin_id: input.adminId,
        channel: input.channel,
        reason: input.reason,
        message_template: input.messageTemplate ?? null,
        notes: input.notes ?? null,
        contacted_at: now,
      } as never)
      .select("id, channel, reason, notes, contacted_at, created_at")
      .single();

    if (error) {
      throw new Error(`Erro ao registrar contato: ${error.message}`);
    }

    const row = data as unknown as ContactRow;
    return {
      id: row.id,
      channel: row.channel ?? input.channel,
      reason: row.reason ?? input.reason,
      contactedAt: row.contacted_at ?? row.created_at ?? now,
      notes: row.notes ?? null,
    };
  }

  toCsv(rows: StudentEngagementRow[]): string {
    const separator = ";";
    const headers = [
      "Nome",
      "Email",
      "Telefone",
      "Matricula",
      "Cursos",
      "Status",
      "Ultimo login",
      "Ultimo estudo",
      "Logins no periodo",
      "Tempo estudado",
      "Cronograma",
      "Conclusoes",
      "Recomendacao",
    ];

    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const lines = rows.map((row) =>
      [
        row.name,
        row.email,
        row.telefone,
        row.matricula,
        row.cursos.join("; "),
        row.statusLabel,
        row.lastLoginAt,
        row.lastStudyAt,
        row.loginsNoPeriodo,
        row.studyTimeLabel,
        row.hasSchedule ? "Sim" : "Nao",
        row.completionsNoPeriodo,
        row.recommendation,
      ]
        .map(escape)
        .join(separator),
    );

    return `\uFEFF${[headers.map(escape).join(separator), ...lines].join("\r\n")}`;
  }

  private async fetchUsers(client: DatabaseClient, studentIds: string[]): Promise<UserRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("usuarios")
          .select("id, nome_completo, email, telefone, numero_matricula")
          .in("id", ids),
      studentIds,
    );
  }

  private async fetchCourses(client: DatabaseClient, courseIds: string[]): Promise<CourseRow[]> {
    if (courseIds.length === 0) return [];
    return fetchAllRowsChunked(
      (ids) => client.from("cursos").select("id, nome").in("id", ids),
      courseIds,
    );
  }

  private async fetchLoginRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
    since: string,
    until: string,
  ): Promise<LoginRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("tenant_login_events")
          .select("usuario_id, occurred_at")
          .in("usuario_id", ids)
          .eq("empresa_id", empresaId)
          .gte("occurred_at", since)
          .lte("occurred_at", until),
      studentIds,
    );
  }

  private async fetchStudyRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
    since: string,
  ): Promise<StudyRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("usuario_id, created_at, tempo_total_liquido_segundos")
          .in("usuario_id", ids)
          .eq("empresa_id", empresaId)
          .gte("created_at", since),
      studentIds,
    );
  }

  private async fetchScheduleRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
  ): Promise<ScheduleRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("cronogramas")
          .select("id, usuario_id")
          .in("usuario_id", ids)
          .eq("empresa_id", empresaId),
      studentIds,
    );
  }

  private async fetchActivityRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
    since: string,
  ): Promise<ActivityRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("progresso_atividades")
          .select("usuario_id, status, data_conclusao, updated_at")
          .in("usuario_id", ids)
          .eq("empresa_id", empresaId)
          .gte("updated_at", since),
      studentIds,
    );
  }

  private async fetchFlashcardRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
    since: string,
  ): Promise<FlashcardProgressRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("progresso_flashcards")
          .select("usuario_id, numero_revisoes, updated_at")
          .in("usuario_id", ids)
          .eq("empresa_id", empresaId)
          .gt("numero_revisoes", 0)
          .gte("updated_at", since),
      studentIds,
    );
  }

  private async fetchAppointmentRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
    since: string,
  ): Promise<AppointmentRow[]> {
    return fetchAllRowsChunked(
      (ids) =>
        client
          .from("agendamentos")
          .select("aluno_id, created_at")
          .in("aluno_id", ids)
          .eq("empresa_id", empresaId)
          .gte("created_at", since),
      studentIds,
    );
  }

  private async hasFlashcards(client: DatabaseClient, empresaId: string): Promise<boolean> {
    const { count } = await client
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    return (count ?? 0) > 0;
  }

  private async fetchContactRows(
    client: DatabaseClient,
    empresaId: string,
    studentIds: string[],
  ): Promise<ContactRow[]> {
    try {
      const rows = await fetchAllRowsChunked(
        (ids) =>
          client
            .from("student_engagement_contacts" as never)
            .select("id, student_id, channel, reason, notes, contacted_at, created_at")
            .in("student_id", ids)
            .eq("empresa_id", empresaId)
            .order("contacted_at", { ascending: false }),
        studentIds,
      );

      return rows as unknown as ContactRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("student_engagement_contacts")) {
        console.warn("[student-engagement] Histórico de contato indisponível:", error);
      }
      return [];
    }
  }

  private buildRows(input: {
    studentIds: string[];
    enrollments: CanonicalEnrollment[];
    users: UserRow[];
    courses: CourseRow[];
    loginRows: LoginRow[];
    studyRows: StudyRow[];
    scheduleRows: ScheduleRow[];
    activityRows: ActivityRow[];
    flashcardRows: FlashcardProgressRow[];
    appointmentRows: AppointmentRow[];
    contactRows: ContactRow[];
    period: DashboardPeriod;
  }): StudentEngagementRow[] {
    const usersById = new Map(input.users.map((user) => [user.id, user]));
    const coursesById = new Map(input.courses.map((course) => [course.id, course]));
    const courseNamesByStudent = createEmptySetMap(input.studentIds);
    for (const enrollment of input.enrollments) {
      const courseName = coursesById.get(enrollment.cursoId)?.nome;
      if (courseName) {
        courseNamesByStudent.get(enrollment.usuarioId)?.add(courseName);
      }
    }

    const loginsByStudent = new Map<string, { count: number; last: string | null }>();
    for (const row of input.loginRows) {
      if (!row.usuario_id) continue;
      const current = loginsByStudent.get(row.usuario_id) ?? { count: 0, last: null };
      current.count += 1;
      current.last = maxIso(current.last, row.occurred_at);
      loginsByStudent.set(row.usuario_id, current);
    }

    const studyByStudent = new Map<string, { seconds: number; last: string | null }>();
    for (const row of input.studyRows) {
      if (!row.usuario_id) continue;
      const current = studyByStudent.get(row.usuario_id) ?? { seconds: 0, last: null };
      current.seconds += row.tempo_total_liquido_segundos ?? 0;
      current.last = maxIso(current.last, row.created_at);
      studyByStudent.set(row.usuario_id, current);
    }

    const scheduleIdsByStudent = new Map<string, string[]>();
    for (const row of input.scheduleRows) {
      if (!row.usuario_id) continue;
      const ids = scheduleIdsByStudent.get(row.usuario_id) ?? [];
      ids.push(row.id);
      scheduleIdsByStudent.set(row.usuario_id, ids);
    }

    const scheduleCompletionsByStudent = new Map<string, number>();

    const activitiesByStudent = new Map<string, number>();
    for (const row of input.activityRows) {
      if (!row.usuario_id || row.status !== "Concluido") continue;
      activitiesByStudent.set(
        row.usuario_id,
        (activitiesByStudent.get(row.usuario_id) ?? 0) + 1,
      );
    }

    const flashcardsByStudent = new Map<string, number>();
    for (const row of input.flashcardRows) {
      if (!row.usuario_id) continue;
      flashcardsByStudent.set(
        row.usuario_id,
        (flashcardsByStudent.get(row.usuario_id) ?? 0) + Math.max(1, row.numero_revisoes ?? 0),
      );
    }

    const appointmentsByStudent = new Map<string, number>();
    for (const row of input.appointmentRows) {
      if (!row.aluno_id) continue;
      appointmentsByStudent.set(row.aluno_id, (appointmentsByStudent.get(row.aluno_id) ?? 0) + 1);
    }

    const lastContactByStudent = new Map<string, StudentEngagementContact>();
    for (const row of input.contactRows) {
      if (!row.student_id || !row.channel || !row.reason) continue;
      if (lastContactByStudent.has(row.student_id)) continue;
      lastContactByStudent.set(row.student_id, {
        id: row.id,
        channel: row.channel,
        reason: row.reason,
        notes: row.notes ?? null,
        contactedAt: row.contacted_at ?? row.created_at ?? new Date().toISOString(),
      });
    }

    const lowEngagementThreshold = LOW_ENGAGEMENT_MINUTES_BY_PERIOD[input.period];

    return input.studentIds.map((studentId) => {
      const user = usersById.get(studentId);
      const login = loginsByStudent.get(studentId) ?? { count: 0, last: null };
      const study = studyByStudent.get(studentId) ?? { seconds: 0, last: null };
      const studyMinutes = Math.floor(study.seconds / 60);
      const scheduleCount = scheduleIdsByStudent.get(studentId)?.length ?? 0;
      const activitiesCompletedNoPeriodo = activitiesByStudent.get(studentId) ?? 0;
      const flashcardsReviewedNoPeriodo = flashcardsByStudent.get(studentId) ?? 0;
      const scheduleCompletions = scheduleCompletionsByStudent.get(studentId) ?? 0;
      const completionsNoPeriodo =
        scheduleCompletions + activitiesCompletedNoPeriodo + flashcardsReviewedNoPeriodo;
      const status = this.classify({
        loginsNoPeriodo: login.count,
        studyMinutes,
        hasSchedule: scheduleCount > 0,
        completionsNoPeriodo,
        lowEngagementThreshold,
      });
      const lastContact = lastContactByStudent.get(studentId) ?? null;
      const recoveredAfterContact = !!(
        lastContact &&
        ((login.last && new Date(login.last) > new Date(lastContact.contactedAt)) ||
          (study.last && new Date(study.last) > new Date(lastContact.contactedAt)))
      );

      return {
        id: studentId,
        name: user?.nome_completo || user?.email || "Aluno",
        email: user?.email ?? null,
        telefone: user?.telefone ?? null,
        matricula: user?.numero_matricula ?? null,
        cursos: [...(courseNamesByStudent.get(studentId) ?? new Set<string>())],
        status,
        statusLabel: STATUS_LABELS[status],
        recommendation: RECOMMENDATIONS[status],
        lastLoginAt: login.last,
        lastStudyAt: study.last,
        loginsNoPeriodo: login.count,
        studyMinutes,
        studyTimeLabel: formatStudyTime(studyMinutes),
        hasSchedule: scheduleCount > 0,
        scheduleCount,
        completionsNoPeriodo,
        activitiesCompletedNoPeriodo,
        flashcardsReviewedNoPeriodo,
        appointmentsNoPeriodo: appointmentsByStudent.get(studentId) ?? 0,
        lastContact,
        recoveredAfterContact,
      };
    });
  }

  private buildSummary(
    students: StudentEngagementRow[],
    flashcardsAvailable: boolean,
  ): StudentEngagementData["summary"] {
    const totalStudents = students.length;
    const accessedApp = students.filter((student) => student.loginsNoPeriodo > 0).length;
    const studied = students.filter((student) => student.studyMinutes > 0).length;
    const loggedWithoutStudy = students.filter(
      (student) => student.loginsNoPeriodo > 0 && student.studyMinutes === 0,
    ).length;
    const withoutAccess = students.filter((student) => student.loginsNoPeriodo === 0).length;
    const withoutSchedule = students.filter((student) => !student.hasSchedule).length;
    const lowEngagement = students.filter((student) => student.status === "baixo_engajamento").length;
    const withoutCompletion = students.filter((student) => student.status === "sem_conclusao").length;
    const engaged = students.filter((student) => student.status === "engajado").length;
    const contacted = students.filter((student) => !!student.lastContact).length;
    const recovered = students.filter((student) => student.recoveredAfterContact).length;

    return {
      totalStudents,
      accessedApp,
      studied,
      loggedWithoutStudy,
      withoutAccess,
      withoutSchedule,
      lowEngagement,
      withoutCompletion,
      engaged,
      contacted,
      recovered,
      recoveryRate: contacted > 0 ? Math.round((recovered / contacted) * 100) : 0,
      flashcardsAvailable,
      generatedAt: new Date().toISOString(),
    };
  }

  private classify(input: {
    loginsNoPeriodo: number;
    studyMinutes: number;
    hasSchedule: boolean;
    completionsNoPeriodo: number;
    lowEngagementThreshold: number;
  }): StudentEngagementStatus {
    if (input.loginsNoPeriodo === 0) return "sem_acesso";
    if (input.studyMinutes === 0) return "acessou_sem_estudo";
    if (!input.hasSchedule) return "sem_cronograma";
    if (input.studyMinutes < input.lowEngagementThreshold) return "baixo_engajamento";
    if (input.completionsNoPeriodo === 0) return "sem_conclusao";
    return "engajado";
  }

  private statusPriority(status: StudentEngagementStatus): number {
    const priorities: Record<StudentEngagementStatus, number> = {
      sem_acesso: 1,
      acessou_sem_estudo: 2,
      sem_cronograma: 3,
      baixo_engajamento: 4,
      sem_conclusao: 5,
      engajado: 6,
    };
    return priorities[status];
  }
}

export const studentEngagementService = new StudentEngagementService();
