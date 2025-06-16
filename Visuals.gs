function drawMostOwnedTable(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allCards = [];

  for (const sheet of getActiveSets()) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const qty = parseFloat(data[i][0]) || 0;
      if (qty > 0) {
        allCards.push({
          name: data[i][2],
          rarity: data[i][3],
          qty,
        });
      }
    }
  }

  allCards.sort((a, b) => b.qty - a.qty);
  const top = allCards.slice(0, 10);
  const table = [["Name", "Rarity", "Quantity"]].concat(top.map(c => [c.name, c.rarity, c.qty]));
  dashboard.getRange("H20:J20").setValues([table[0]]);
  dashboard.getRange(21, 8, table.length - 1, 3).setValues(table.slice(1));
}

function drawRarityStackedChart(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rarities = {};

  for (const sheet of getActiveSets()) {
    const name = sheet.getName();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) continue;
    if (!rarities[name]) rarities[name] = {};

    for (let i = 1; i < data.length; i++) {
      const qty = +data[i][0] || 0;
      const rarity = data[i][3]?.trim() || "Unknown";
      rarities[name][rarity] = (rarities[name][rarity] || 0) + qty;
    }
  }

  const allRarities = [...new Set(Object.values(rarities).flatMap(r => Object.keys(r)))];
  const table = [["Set", ...allRarities]];

  for (const setName in rarities) {
    const row = [setName];
    for (const rarity of allRarities) {
      row.push(rarities[setName][rarity] || 0);
    }
    table.push(row);
  }

  const anchor = 40;
  dashboard.getRange(anchor, 1).setValue("Collection Breakdown by Rarity (Stacked)");
  dashboard.getRange(anchor + 1, 1, table.length, table[0].length).setValues(table);

  const chart = dashboard.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dashboard.getRange(anchor + 2, 1, table.length - 1, table[0].length))
    .setPosition(anchor + 2, 5, 0, 0)
    .setOption("isStacked", true)
    .setOption("title", "Stacked Rarity by Set")
    .build();

  dashboard.insertChart(chart);
}
