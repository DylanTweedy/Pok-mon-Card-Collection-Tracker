/**
 * Logs a snapshot of collection totals and rarity counts to the ValueLog sheet.
 */
function logValueSnapshot() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("ValueLog") || ss.insertSheet("ValueLog");

  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy HH:mm");
  const sets = {}, rarities = {};
  let totalCards = 0, totalValue = 0;

  for (const s of getActiveSets()) {
    const name = s.getName();
    const data = s.getDataRange().getValues();
    const totalInSet = data.length - 1;
    let owned = 0, value = 0;

    for (let i = 1; i < data.length; i++) {
      const qty = +data[i][0] || 0;
      const total = +data[i][5] || 0;
      const rarity = data[i][3]?.trim() || "Unknown";
      totalCards += qty;
      value += total;
      if (qty > 0) owned++;
      rarities[rarity] = (rarities[rarity] || 0) + qty;
    }

    sets[`${name} %`] = totalInSet ? `${((owned / totalInSet) * 100).toFixed(1)}%` : "0.0%";
    sets[`${name} Value`] = `£${value.toFixed(2)}`;
    totalValue += value;
  }

  const row = {
    Timestamp: now,
    "Total Cards": totalCards,
    "Total Value": `£${totalValue.toFixed(2)}`,
    ...sets,
    ...rarities
  };

  const headers = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  const newHeaders = [...headers];
  for (const key of Object.keys(row)) if (!headers.includes(key)) newHeaders.push(key);
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

  const values = newHeaders.map(h => row[h] || "");
  const lastRow = sheet.getLastRow();
  const lastValues = lastRow > 1 ? sheet.getRange(lastRow, 1, 1, newHeaders.length).getValues()[0] : [];
  if (lastValues.join() === values.join()) return;

  sheet.appendRow(values);
}
