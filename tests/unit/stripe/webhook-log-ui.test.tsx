import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("webhook observability UI source contracts", () => {
  const componentPath = join(
    process.cwd(),
    "app/superadmin/(dashboard)/webhooks/components/webhook-events-list.tsx",
  );

  const sidebarPath = join(
    process.cwd(),
    "app/superadmin/(dashboard)/components/superadmin-sidebar.tsx",
  );

  it("renderiza colunas Evento, Status, Recebido em, Duracao e Acao", () => {
    const source = readFileSync(componentPath, "utf-8");

    expect(source).toContain("Evento");
    expect(source).toContain("Status");
    expect(source).toContain("Recebido em");
    expect(source).toContain("Duracao");
    expect(source).toContain("Acao");
  });

  it("contém estados processing, processed e failed", () => {
    const source = readFileSync(componentPath, "utf-8");

    expect(source).toContain("processing");
    expect(source).toContain("processed");
    expect(source).toContain("failed");
  });

  it("usa API de listagem e replay de webhooks", () => {
    const source = readFileSync(componentPath, "utf-8");

    expect(source).toContain("/api/superadmin/webhooks?");
    expect(source).toContain("/api/superadmin/webhooks/replay");
  });

  it("declara estado vazio e acao de reprocessamento", () => {
    const source = readFileSync(componentPath, "utf-8");

    expect(source).toContain("Nenhum webhook encontrado.");
    expect(source).toContain("Reprocessar");
  });

  it("adiciona navegação Webhooks no sidebar", () => {
    const sidebarSource = readFileSync(sidebarPath, "utf-8");

    expect(sidebarSource).toContain('title: "Webhooks"');
    expect(sidebarSource).toContain('url: "/superadmin/webhooks"');
  });
});
