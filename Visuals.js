/**
 * Draws a table of the top 10 most owned cards on the dashboard.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} dashboard Dashboard sheet
 */
function drawMostOwnedTable(dashboard) {
  const allCards = [];

  getActiveSets().forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    const headerIndex = buildHeaderIndex(data[0] || []);
    for (let i = 1; i < data.length; i++) {
      const row = parseSetRow(data[i], headerIndex);
      if (row.qty > 0) {
        allCards.push({
          name: row.name,
          rarity: row.rarity,
          qty: row.qty
        });
      }
    }
  });

  allCards.sort((a, b) => b.qty - a.qty);
  const top = allCards.slice(0, 10);
  const table = [["Name", "Rarity", "Quantity"]].concat(top.map(c => [c.name, c.rarity, c.qty]));
  dashboard.getRange("H20:J20").setValues([table[0]]);
  if (table.length > 1) {
    dashboard.getRange(21, 8, table.length - 1, 3).setValues(table.slice(1));
  }
}

/**
 * Draws a stacked bar chart showing quantity of cards by rarity for each set.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} dashboard Dashboard sheet
 */
function drawRarityStackedChart(dashboard) {
  const rarities = {};

  getActiveSets().forEach(sheet => {
    const name = sheet.getName();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    const headerIndex = buildHeaderIndex(data[0]);
    if (!rarities[name]) rarities[name] = {};

    for (let i = 1; i < data.length; i++) {
      const row = parseSetRow(data[i], headerIndex);
      if (!row.rarity) continue;
      rarities[name][row.rarity] = (rarities[name][row.rarity] || 0) + row.qty;
    }
  });

  const allRarities = Object.keys(rarities).length
    ? [...new Set(Object.keys(rarities).flatMap(setName => Object.keys(rarities[setName])))]
    : [];
  const table = [["Set", ...allRarities]];

  Object.keys(rarities).forEach(setName => {
    const row = [setName];
    allRarities.forEach(rarity => {
      row.push(rarities[setName][rarity] || 0);
    });
    table.push(row);
  });

  const anchor = 40;
  dashboard.getRange(anchor, 1).setValue("Collection Breakdown by Rarity (Stacked)");
  if (table.length > 1) {
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
}
