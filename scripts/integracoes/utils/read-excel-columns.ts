/**
 * Script para ler as colunas do arquivo Excel da Hotmart
 */
import * as path from "path";
import ExcelJS from "exceljs";

async function main() {
  const filePath = path.join(
    __dirname,
    "..",
    "sales_history_ 23-11 a 20-01 (1).xlsx",
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("O arquivo XLSX não contém planilhas.");
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values
    .slice(1)
    .map((value) => String(value ?? "").trim());

  console.log("=== COLUNAS DO EXCEL ===");
  headers.forEach((col, idx) => {
    console.log(`${idx}: ${col}`);
  });

  // Mostrar uma amostra de dados (primeira linha de dados)
  const firstDataRow = worksheet.getRow(2);
  const firstRowValues = firstDataRow.values.slice(1);

  console.log("\n=== PRIMEIRA LINHA DE DADOS ===");
  headers.forEach((col, idx) => {
    console.log(`${col}: ${firstRowValues[idx] ?? ""}`);
  });

  const totalRows = Math.max(worksheet.rowCount - 1, 0);
  console.log(`\n=== TOTAL DE LINHAS: ${totalRows} ===`);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Erro ao ler planilha.",
  );
  process.exitCode = 1;
});
