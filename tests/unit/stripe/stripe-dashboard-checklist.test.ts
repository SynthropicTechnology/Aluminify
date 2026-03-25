import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("stripe dashboard checklist contracts", () => {
  const checklistPath = join(process.cwd(), "docs/guides/stripe-dashboard-checklist.md");

  it("contém seções obrigatórias para STRP-07", () => {
    const content = readFileSync(checklistPath, "utf-8");

    expect(content).toContain("Smart Retries");
    expect(content).toContain("Customer Portal");
    expect(content).toContain("billing emails");
  });
});
