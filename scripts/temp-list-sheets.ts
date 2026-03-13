import ExcelJS from "exceljs";

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("Alunos sem acesso à Aluminify.xlsx");

  console.log("=".repeat(70));
  console.log("Planilhas (abas) no arquivo:");
  console.log("=".repeat(70));

  for (const worksheet of workbook.worksheets) {
    const sheetValues = worksheet.getSheetValues().slice(1);
    const data = sheetValues.map((row) =>
      Array.isArray(row) ? row.slice(1) : [],
    ) as unknown[][];
    const rowCount = Math.max(data.length - 1, 0); // minus header

    console.log(`\n📋 "${worksheet.name}" - ${rowCount} aluno(s)`);

    // Show header
    if (data[0]) {
      console.log(`   Colunas: ${JSON.stringify(data[0])}`);
    }

    // Show first row of data
    if (data[1]) {
      console.log(`   Exemplo: ${JSON.stringify(data[1])}`);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Erro ao ler planilha.",
  );
  process.exitCode = 1;
});
