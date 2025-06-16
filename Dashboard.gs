function updateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashboard = ss.getSheetByName("Dashboard");
  if (!dashboard) dashboard = ss.insertSheet("Dashboard");
  else dashboard.clear();

  dashboard.getRange("A1").setValue("📊 Pokémon Collection Dashboard");
  dashboard.getRange("A1:E1").merge().setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center");

  dashboard.setRowHeight(1, 35).setRowHeight(2, 30).setRowHeight(3, 30);
  dashboard.getRange("E2").setValue("Last Updated:");
  dashboard.getRange("E3").setValue(new Date()).setNumberFormat("dd mmm yyyy HH:mm");

  const setSheets = getActiveSets();
  let totalValue = 0, totalOwned = 0;
  const setSummary = [["Set", "Cards in Set", "Cards Owned", "Progress", "Value (£)"]];
  const topCards = [];

  for (let sheet of setSheets) {
    const name = sheet.getName();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) continue;

    const totalCards = data.length - 1;
    let owned = 0, value = 0;

    for (let i = 1; i < data.length; i++) {
      const qty = +data[i][0] || 0;
      const price = +data[i][4] || 0;
      owned += qty > 0 ? 1 : 0;
      totalOwned += qty;
      value += price * qty;
      if (qty > 0) topCards.push({ name: data[i][2], set: name, price });
    }

    totalValue += value;
    const percent = totalCards ? ((owned / totalCards) * 100).toFixed(1) + "%" : "0.0%";
    setSummary.push([name, totalCards, owned, percent, value.toFixed(2)]);
  }

  dashboard.getRange("A2").setValue("Total Collection Value:");
  dashboard.getRange("B2").setValue(`£${totalValue.toFixed(2)}`);
  dashboard.getRange("A3").setValue("Total Cards Owned:");
  dashboard.getRange("B3").setValue(totalOwned);

  dashboard.getRange("A5").setValue("Set Completion & Value");
  dashboard.getRange("A6:E6").setValues([setSummary[0]]);
  dashboard.getRange(7, 1, setSummary.length - 1, 5).setValues(setSummary.slice(1));
  dashboard.getRange(7, 5, setSummary.length - 1, 1).setNumberFormat("£#,##0.00");

  topCards.sort((a, b) => b.price - a.price);
  const top10 = [["Card", "Set", "Market Price (£)"]].concat(
    topCards.slice(0, 10).map(c => [c.name, c.set, `£${c.price.toFixed(2)}`])
  );
  dashboard.getRange("G2").setValue("Top 10 Most Valuable Cards");
  dashboard.getRange("G3:I3").setValues([top10[0]]);
  dashboard.getRange(4, 7, top10.length - 1, 3).setValues(top10.slice(1));

  const valueRange = dashboard.getRange(7, 5, setSummary.length - 1, 1);
  const nameRange = dashboard.getRange(7, 1, setSummary.length - 1, 1);
  const chart1 = dashboard.newChart().setChartType(Charts.ChartType.PIE)
    .addRange(nameRange).addRange(valueRange).setPosition(15, 1, 0, 0)
    .setOption('title', 'Value by Set').build();
  dashboard.insertChart(chart1);

  const percentRange = dashboard.getRange(7, 4, setSummary.length - 1, 1);
  const chart2 = dashboard.newChart().setChartType(Charts.ChartType.BAR)
    .addRange(nameRange).addRange(percentRange).setPosition(15, 6, 0, 0)
    .setOption('title', 'Collection Progress by Set').build();
  dashboard.insertChart(chart2);

  drawMostOwnedTable(dashboard);
  drawRarityStackedChart(dashboard);
  dashboard.autoResizeColumns(1, 9);
}
