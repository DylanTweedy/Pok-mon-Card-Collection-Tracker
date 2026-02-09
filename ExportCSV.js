/**
 * Exports separate CSV files per set with owned cards.
 * Each file includes: Card Name, Unit Price, Quantity, Currency.
 */
function exportSetsToCSV() {
  const exportFolderName = "Kubera Card CSV Exports";
  const exportMimeType = MimeType.CSV;

  const folders = DriveApp.getFoldersByName(exportFolderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(exportFolderName);

  const sets = getActiveSets();

  sets.forEach(sheet => {
    const setName = sheet.getName();
    const data = sheet.getDataRange().getValues();
    const headerIndex = buildHeaderIndex(data[0] || []);
    const dataRows = data.slice(1);

    const ownedCards = dataRows.filter(r => toNumber(r[SET_SHEET_COLUMNS.QUANTITY - 1]) > 0);
    if (ownedCards.length === 0) return;

    const csvRows = [["Asset Name", "Unit Price", "Qty", "Currency"]];

    ownedCards.forEach(r => {
      const row = parseSetRow(r, headerIndex);
      if (!row.qty || !row.price || !row.name) return;

      const assetName = (row.rarity.toLowerCase() === "rare holo") ? `${row.name} - Rare Holo` : row.name;
      csvRows.push([assetName, row.price.toFixed(2), row.qty, "GBP"]);
    });

    const csv = csvRows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\r\n");

    const fileName = `${setName}.csv`;
    const existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);

    folder.createFile(fileName, csv, exportMimeType);
  });

  SpreadsheetApp.getUi().alert("CSV files generated in Drive folder: " + exportFolderName);
}
