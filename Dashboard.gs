// Dashboard.gs – refined layout and fixed logic for progress + top card diversity
function updateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  //updateAllSetSheets();

  const dashboard = ss.getSheetByName("Dashboard") || ss.insertSheet("Dashboard");
  dashboard.clear();
  logValueSnapshot();
  dashboard.getCharts().forEach(chart => dashboard.removeChart(chart));

  // Header
  dashboard.setFrozenRows(1);
  dashboard.getRange("A1").setValue("📊 Pokémon Collection Dashboard")
    .setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center")
    .setBackground("#1a1a1a").setFontColor("#ffffff");
  dashboard.getRange("A1:F1").merge();

  dashboard.getRange("A2").setValue("📅 Last updated: " + new Date().toLocaleString())
    .setFontStyle("italic").setFontColor("#aaaaaa").setFontSize(10);

  dashboard.getRange("A4").setValue("🧾 Summary").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  dashboard.getRange("A5").setValue("💷 Total Collection Value:").setFontWeight("bold");
  dashboard.getRange("B5").setNumberFormat("£#,##0.00");
  dashboard.getRange("A6").setValue("📦 Total Cards Owned:").setFontWeight("bold");
  dashboard.getRange("B6").setNumberFormat("0");

  // Prepare Data
  const setSheets = getActiveSets();
  let totalValue = 0, totalOwned = 0;
  const setSummary = [["📚 Set", "📇 Cards in Set", "✅ Cards Owned", "📈 Progress", "💰 Value (£)"]];
  const topCards = [], rarityCounts = {}, conditionCounts = {};

  for (let sheet of setSheets) {
    const name = sheet.getName();
    const label = getLabelWithEmoji(name);
    const data = sheet.getDataRange().getValues().filter(r => r[2]);
    const totalCards = data.reduce((acc, row, i) => i === 0 ? acc : acc + (row[2] ? 1 : 0), 0);
    let owned = 0, value = 0;

    for (let i = 1; i < data.length; i++) {
      if (!data[i][2]) continue;
      const qty = +data[i][0] || 0;
      const price = +data[i][4] || 0;
      const rarity = typeof data[i][3] === 'string' ? data[i][3].trim() : "Unknown";
      const condition = typeof data[i][1] === 'string' ? data[i][1].trim() : "Unknown";
      if (qty > 0) {
        if (price > 0) topCards.push({ name: data[i][2], set: name, price });
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + qty;
        conditionCounts[condition] = (conditionCounts[condition] || 0) + qty;
        owned++;
        totalOwned += qty;
      }
      value += price * qty;
    }

    totalValue += value;
    const percent = totalCards ? (owned / totalCards) : 0;
    setSummary.push([label, totalCards, owned, percent, value]);
  }

  dashboard.getRange("B5").setValue(totalValue);
  dashboard.getRange("B6").setValue(totalOwned);

  const setTableStart = 9;
  dashboard.getRange(`A${setTableStart - 1}:F${setTableStart - 1}`).merge()
    .setValue("📦 Set Completion & Value").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  dashboard.getRange(setTableStart, 1, 1, 5).setValues([setSummary[0]]).setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffffff");
  dashboard.getRange(setTableStart + 1, 1, setSummary.length - 1, 5).setValues(setSummary.slice(1));
  dashboard.getRange(setTableStart + 1, 4, setSummary.length - 1, 1).setNumberFormat("0.0%");
  dashboard.getRange(setTableStart + 1, 5, setSummary.length - 1, 1).setNumberFormat("£#,##0.00");
  applyRowBanding(dashboard.getRange(setTableStart + 1, 1, setSummary.length - 1, 5), setSummary.length - 1);

  const topStartRow = setTableStart + setSummary.length + 2;
  dashboard.getRange(`A${topStartRow - 1}:C${topStartRow - 1}`).merge()
    .setValue("🔝 Top 10 Most Valuable Cards").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  dashboard.getRange(topStartRow, 1, 1, 3).setValues([["⭐ Card", "📁 Set", "💷 Market Price (£)"]])
    .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffffff");
  const top10 = topCards.sort((a, b) => b.price - a.price).slice(0, 10);
  if (top10.length)
    dashboard.getRange(topStartRow + 1, 1, top10.length, 3).setValues(top10.map(c => [c.name, c.set, c.price]))
      .setNumberFormat("£#,##0.00");

  const rarityStart = topStartRow;
  dashboard.getRange(`E${rarityStart - 1}:F${rarityStart - 1}`).merge()
    .setValue("📊 Rarity Breakdown").setFontWeight("bold").setFontSize(14).setFontColor("#ffffff").setBackground("#222222");
  const rarityRows = Object.entries(rarityCounts).map(([k, v]) => [k, v]);
  dashboard.getRange(rarityStart, 5, 1, 2).setValues([["⭐ Rarity", "📦 Count"]]).setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffffff");
  if (rarityRows.length)
    dashboard.getRange(rarityStart + 1, 5, rarityRows.length, 2).setValues(rarityRows);

  dashboard.setColumnWidths(1, 1, 180);
  dashboard.setColumnWidths(5, 1, 140);
  dashboard.setHiddenGridlines(true);
}
