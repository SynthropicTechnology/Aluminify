import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { listaService } from "@/app/shared/services/listas";
import { pdf, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import React from "react";

export const runtime = "nodejs";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
      fontWeight: 600,
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Inter", fontSize: 10 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 600, marginBottom: 8, marginTop: 16, color: "#374151" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#374151", paddingBottom: 4, marginBottom: 4 },
  cell: { flex: 1, textAlign: "center" },
  cellLeft: { flex: 2, textAlign: "left" },
  headerCell: { flex: 1, textAlign: "center", fontWeight: 600, fontSize: 9, color: "#6b7280" },
  headerCellLeft: { flex: 2, textAlign: "left", fontWeight: 600, fontSize: 9, color: "#6b7280" },
  summaryRow: { flexDirection: "row", gap: 20, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4 },
  summaryLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: 700 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9ca3af" },
});

function formatTempo(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m${s}s` : `${m}m`;
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user;
    if (user?.role === "aluno") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const empresaId = user?.empresaId;
    if (!empresaId) {
      return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 400 });
    }

    const relatorio = await listaService.getRelatorio(empresaId);

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Relatório de Listas de Exercícios</Text>
          <Text style={styles.subtitle}>Gerado em {new Date().toLocaleDateString("pt-BR")}</Text>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total de Listas</Text>
              <Text style={styles.summaryValue}>{relatorio.resumo.totalListas}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Alunos Participantes</Text>
              <Text style={styles.summaryValue}>{relatorio.resumo.totalAlunos}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Aproveitamento Médio</Text>
              <Text style={styles.summaryValue}>
                {relatorio.resumo.aproveitamentoMedio != null ? `${relatorio.resumo.aproveitamentoMedio}%` : "—"}
              </Text>
            </View>
          </View>

          {/* Performance by lista */}
          <Text style={styles.sectionTitle}>Desempenho por Lista</Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerCellLeft}>Lista</Text>
            <Text style={styles.headerCell}>Tipo</Text>
            <Text style={styles.headerCell}>Questões</Text>
            <Text style={styles.headerCell}>Iniciaram</Text>
            <Text style={styles.headerCell}>Aproveit.</Text>
            <Text style={styles.headerCell}>Tempo</Text>
          </View>
          {relatorio.porLista.map((l) => (
            <View key={l.listaId} style={styles.row}>
              <Text style={styles.cellLeft}>{l.titulo}</Text>
              <Text style={styles.cell}>{l.tipo === "simulado" ? "Simulado" : "Exercício"}</Text>
              <Text style={styles.cell}>{l.totalQuestoes}</Text>
              <Text style={styles.cell}>{l.totalAlunosIniciaram}</Text>
              <Text style={styles.cell}>{l.aproveitamento != null ? `${l.aproveitamento}%` : "—"}</Text>
              <Text style={styles.cell}>{formatTempo(l.tempoMedio)}</Text>
            </View>
          ))}

          {/* Performance by disciplina */}
          {relatorio.porDisciplina.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Desempenho por Disciplina</Text>
              <View style={styles.headerRow}>
                <Text style={styles.headerCellLeft}>Disciplina</Text>
                <Text style={styles.headerCell}>Total</Text>
                <Text style={styles.headerCell}>Acertos</Text>
                <Text style={styles.headerCell}>Aproveitamento</Text>
              </View>
              {relatorio.porDisciplina.map((d) => (
                <View key={d.disciplina} style={styles.row}>
                  <Text style={styles.cellLeft}>{d.disciplina}</Text>
                  <Text style={styles.cell}>{d.total}</Text>
                  <Text style={styles.cell}>{d.acertos}</Text>
                  <Text style={styles.cell}>{d.percentual}%</Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.footer}>Relatório gerado automaticamente — Aluminify</Text>
        </Page>

        {/* Page 2: Ranking + Most missed */}
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Ranking de Alunos</Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerCell}>#</Text>
            <Text style={styles.headerCellLeft}>Aluno</Text>
            <Text style={styles.headerCell}>Total</Text>
            <Text style={styles.headerCell}>Acertos</Text>
            <Text style={styles.headerCell}>%</Text>
          </View>
          {relatorio.ranking.slice(0, 30).map((a, idx) => (
            <View key={a.alunoId} style={styles.row}>
              <Text style={styles.cell}>{idx + 1}</Text>
              <Text style={styles.cellLeft}>{a.nome}</Text>
              <Text style={styles.cell}>{a.total}</Text>
              <Text style={styles.cell}>{a.acertos}</Text>
              <Text style={styles.cell}>{a.percentual}%</Text>
            </View>
          ))}

          {relatorio.maisErradas.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Questões Mais Erradas</Text>
              <View style={styles.headerRow}>
                <Text style={styles.headerCellLeft}>Questão</Text>
                <Text style={styles.headerCellLeft}>Disciplina</Text>
                <Text style={styles.headerCell}>Respostas</Text>
                <Text style={styles.headerCell}>Acerto</Text>
              </View>
              {relatorio.maisErradas.map((q) => (
                <View key={q.questaoId} style={styles.row}>
                  <Text style={styles.cellLeft}>{q.codigo ?? `#${q.numeroOriginal ?? "?"}`}</Text>
                  <Text style={styles.cellLeft}>{q.disciplina ?? "—"}</Text>
                  <Text style={styles.cell}>{q.total}</Text>
                  <Text style={styles.cell}>{q.percentualAcerto}%</Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.footer}>Relatório gerado automaticamente — Aluminify</Text>
        </Page>
      </Document>
    );

    const blob = await pdf(doc).toBlob();
    const arr = await blob.arrayBuffer();
    return new NextResponse(arr, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=relatorio-listas.pdf",
      },
    });
  } catch (error) {
    console.error("[Listas Relatorio PDF API]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = requireUserAuth(getHandler);
