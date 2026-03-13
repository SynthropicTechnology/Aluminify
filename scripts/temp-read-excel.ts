import ExcelJS from "exceljs";

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("Alunos sem acesso à Aluminify.xlsx");

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("O arquivo XLSX não contém planilhas.");
  }

  const data = worksheet
    .getSheetValues()
    .slice(1)
    .map((row) =>
      Array.isArray(row)
        ? row.slice(1).map((value) => String(value ?? ""))
        : [],
    );

  console.log("Planilha:", worksheet.name);
  console.log("Total de linhas:", data.length);
  console.log("");
  console.log("Header:", JSON.stringify(data[0]));
  console.log("");
  console.log("Primeiras 10 linhas de dados:");
  data.slice(1, 11).forEach((row, i) => {
    console.log(`${i + 1}: ${JSON.stringify(row)}`);
  });
  console.log("");
  console.log("Últimas 3 linhas:");
  data.slice(-3).forEach((row, i) => {
    console.log(`${data.length - 3 + i}: ${JSON.stringify(row)}`);
  });
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Erro ao ler planilha.",
  );
  process.exitCode = 1;
});
